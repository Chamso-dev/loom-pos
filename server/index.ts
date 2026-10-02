import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError, handle, JWT_SECRET, prisma, requireAdmin, requireAdminOrKey, sendError } from './context';
import { salesRouter } from './routes/sales';
import { customersRouter } from './routes/customers';
import { suppliersRouter } from './routes/suppliers';
import { reportsRouter } from './routes/reports';
import {
  addDays,
  EXPIRY_SOON_DAYS,
  isUnitCode,
  localDay,
  normalizeAlgerianPhone,
  PAYMENT_METHOD_CODES,
  roundMoney,
  roundQuantity,
  toExpiryDay,
  UNIT_CODES,
  UNITS,
} from '../src/lib/domain';

/** A calendar day as the Date Prisma stores in a DATE column. */
const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** The last expiry day that still counts as "expiring soon", from the shop's today. */
const expiringBefore = () => dayToDate(addDays(localDay(), EXPIRY_SOON_DAYS));

const app = express();

app.use(cors());
app.use(express.json());

const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .refine((v) => !v || normalizeAlgerianPhone(v) !== null, { message: 'INVALID_PHONE' })
  // Left out of a partial update (undefined), the current phone is kept.
  .transform((v) => (v === undefined ? undefined : v ? normalizeAlgerianPhone(v) : null));

const productSchema = z.object({
  name: z.string().trim().min(1),
  // Internal code, assigned by the server when left out. The app no longer shows or asks for it.
  sku: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unit: z.enum(UNIT_CODES).default('piece'),
  size: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  costPrice: z.number().min(0),
  sellingPrice: z.number().positive(),
  taxRate: z.number().min(0).max(100).default(0),
  stock: z.number().min(0),
  // YYYY-MM-DD; empty or null clears it. Left out, it stays as it is (undefined is passed through,
  // since a partial update still runs this transform for a missing key).
  expiryDate: z
    .string()
    .nullish()
    .refine((v) => !v || toExpiryDay(v) !== null, { message: 'INVALID_DATE' })
    .transform((v) => (v === undefined ? undefined : v ? dayToDate(toExpiryDay(v)!) : null)),
  supplier: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
});

const userSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'CASHIER']),
  phone: optionalPhone,
  password: z.string().min(6),
  isActive: z.boolean().optional(),
});

const loginSchema = z.object({
  employeeId: z.string().min(1),
  password: z.string().min(1),
});

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).default(''),
  phone: z
    .string()
    .trim()
    .max(30)
    .default('')
    .refine((v) => !v || normalizeAlgerianPhone(v) !== null, { message: 'INVALID_PHONE' })
    .transform((v) => (v ? normalizeAlgerianPhone(v)! : '')),
  nif: z.string().trim().max(20).default(''),
  rc: z.string().trim().max(30).default(''),
  nis: z.string().trim().max(20).default(''),
  articleNo: z.string().trim().max(20).default(''),
  currency: z.literal('DZD').default('DZD'),
  language: z.enum(['ar', 'en']).default('ar'),
  defaultPaymentMethod: z.enum(PAYMENT_METHOD_CODES.filter((m) => m !== 'CREDIT') as [string, ...string[]]).default('CASH'),
  ripAccount: z.string().trim().max(30).default(''),
  ribAccount: z.string().trim().max(30).default(''),
  receiptWidth: z.union([z.literal(58), z.literal(80)]).default(80),
  receiptFooter: z.string().trim().max(200).default(''),
  receiptShowTax: z.boolean().default(true),
  /** A new shared cashier password, null to remove it, or absent to keep the current one. */
  cashierPassword: z.string().min(6).nullish(),
});

/** Settings as sent to browsers: never the cashier password hash. */
const publicSettings = (s: any) => {
  const { cashierPassword, ...rest } = s;
  return { ...rest, hasCashierPassword: Boolean(cashierPassword) };
};

// Auth & Users API

app.post('/api/auth/login', handle(async (req, res) => {
  const { employeeId, password } = loginSchema.parse(req.body);

  // 1. Try the staff member's own password
  let user = await prisma.user.findFirst({ where: { employeeId, isActive: true } });
  let isValid = Boolean(user && (await bcrypt.compare(password, user.password)));

  // 2. Otherwise try the shared cashier password (cashiers only)
  if (!isValid && (!user || user.role === 'CASHIER')) {
    const settings = await prisma.storeSettings.findFirst();
    if (settings?.cashierPassword && (await bcrypt.compare(password, settings.cashierPassword))) {
      user = user || (await prisma.user.findFirst({ where: { employeeId, isActive: true, role: 'CASHIER' } }));
      if (user) isValid = true;
    }
  }

  if (!user || !isValid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials or account deactivated');

  const token = jwt.sign({ id: user.id, employeeId: user.employeeId, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
}));

app.post('/api/auth/change-password', handle(async (req, res) => {
  const { employeeId, currentPassword, newPassword } = z
    .object({ employeeId: z.string(), currentPassword: z.string(), newPassword: z.string().min(6) })
    .parse(req.body);

  const user = await prisma.user.findFirst({ where: { employeeId } });
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    throw new ApiError(401, 'WRONG_CURRENT_PASSWORD', 'Current password verification failed');
  }
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 10) } });
  res.json({ message: 'Password changed successfully' });
}));

app.get('/api/users', requireAdmin, handle(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users.map(({ password, ...u }) => u));
}));

app.post('/api/users', requireAdmin, handle(async (req, res) => {
  const data = userSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { employeeId: data.employeeId } });
  if (exists) throw new ApiError(409, 'EMPLOYEE_ID_TAKEN');
  const user = await prisma.user.create({
    data: { ...data, password: await bcrypt.hash(data.password, 10), id: crypto.randomUUID(), updatedAt: new Date() },
  });
  const { password, ...safeUser } = user;
  res.status(201).json(safeUser);
}));

app.put('/api/users/:id', requireAdmin, handle(async (req, res) => {
  const data = userSchema.partial().parse(req.body);
  if (data.password) data.password = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  const { password, ...safeUser } = user;
  res.json(safeUser);
}));

const resetTokens = new Map<string, { expiresAt: number }>();

app.post('/api/users/:id/reset-token', requireAdmin, handle(async (req, res) => {
  const token = crypto.randomUUID();
  resetTokens.set(`${req.params.id}-${token}`, { expiresAt: Date.now() + 15 * 60 * 1000 });
  res.json({ token });
}));

app.post('/api/users/:id/reset-password', handle(async (req, res) => {
  const { token, newPassword } = z.object({ token: z.string(), newPassword: z.string().min(6) }).parse(req.body);
  const tokenKey = `${req.params.id}-${token}`;
  const tokenData = resetTokens.get(tokenKey);
  if (!tokenData || tokenData.expiresAt < Date.now()) throw new ApiError(401, 'RESET_TOKEN_EXPIRED');
  await prisma.user.update({ where: { id: req.params.id }, data: { password: await bcrypt.hash(newPassword, 10) } });
  resetTokens.delete(tokenKey);
  res.json({ message: 'Password reset successfully' });
}));

const initializeAdmin = async () => {
  const admin = await prisma.user.findUnique({ where: { employeeId: 'admin' } });
  if (!admin) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        employeeId: 'admin',
        name: 'Admin',
        role: 'ADMIN',
        password: await bcrypt.hash('admin123', 10),
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.log('Default admin created: admin / admin123');
  }
};
initializeAdmin().catch((error) => console.error('Admin setup failed', error));

// Products

app.get('/api/products', handle(async (req, res) => {
  const { page = '1', limit = '50', search = '', expiring } = req.query;
  const p = Math.max(1, parseInt(String(page)) || 1);
  const l = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));

  const where: any = {};
  if (search) {
    const s = String(search);
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { sku: { contains: s, mode: 'insensitive' } },
      { barcode: { contains: s } },
      { category: { contains: s, mode: 'insensitive' } },
    ];
  }
  // Expired or expiring soon, soonest first.
  const onlyExpiring = expiring === '1' || expiring === 'true';
  if (onlyExpiring) where.expiryDate = { not: null, lte: expiringBefore() };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, skip: (p - 1) * l, take: l, orderBy: onlyExpiring ? { expiryDate: 'asc' } : { createdAt: 'desc' } }),
  ]);
  res.json({ products, total, page: p, limit: l, hasMore: (p - 1) * l + products.length < total });
}));

const normalizeProduct = <T extends { unit?: string; stock?: number; costPrice?: number; sellingPrice?: number }>(data: T): T => ({
  ...data,
  ...(data.stock !== undefined ? { stock: roundQuantity(data.stock, data.unit) } : {}),
  ...(data.costPrice !== undefined ? { costPrice: roundMoney(data.costPrice) } : {}),
  ...(data.sellingPrice !== undefined ? { sellingPrice: roundMoney(data.sellingPrice) } : {}),
});

/** A unique internal code for a new product, e.g. P-7K2Q9XWM. */
async function newSku(): Promise<string> {
  for (;;) {
    const sku = `P-${crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8)}`;
    if (!(await prisma.product.findUnique({ where: { sku } }))) return sku;
  }
}

async function assertCodesFree(sku?: string, barcode?: string, exceptId?: string) {
  if (sku) {
    const p = await prisma.product.findUnique({ where: { sku } });
    if (p && p.id !== exceptId) throw new ApiError(409, 'SKU_TAKEN', undefined, { product: p.name });
  }
  if (barcode) {
    const p = await prisma.product.findUnique({ where: { barcode } });
    if (p && p.id !== exceptId) throw new ApiError(409, 'BARCODE_TAKEN', undefined, { product: p.name });
  }
}

app.post('/api/products', requireAdminOrKey, handle(async (req, res) => {
  const data = normalizeProduct(productSchema.parse(req.body));
  const sku = data.sku ?? (await newSku());
  await assertCodesFree(sku, data.barcode);
  const product = await prisma.product.create({ data: { ...data, sku, id: crypto.randomUUID(), updatedAt: new Date() } });
  res.status(201).json(product);
}));

app.put('/api/products/:id', requireAdminOrKey, handle(async (req, res) => {
  const partial = productSchema.partial().parse(req.body);
  const current = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!current) throw new ApiError(404, 'PRODUCT_NOT_FOUND');
  const data = normalizeProduct({ unit: current.unit, ...partial });
  await assertCodesFree(data.sku, data.barcode, current.id);
  res.json(await prisma.product.update({ where: { id: current.id }, data }));
}));

app.delete('/api/products/:id', requireAdminOrKey, handle(async (req, res) => {
  const used = await prisma.orderItem.count({ where: { productId: req.params.id } });
  if (used) throw new ApiError(409, 'PRODUCT_HAS_SALES', 'Products with sales cannot be deleted');
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// Low stock: each unit has its own threshold (10 pieces, 5 kg, 1 000 g…).
app.get('/api/inventory/low-stock', handle(async (_req, res) => {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        ...UNIT_CODES.map((unit) => ({ unit, stock: { lte: UNITS[unit].lowStockAt } })),
        { unit: { notIn: [...UNIT_CODES] }, stock: { lte: UNITS.piece.lowStockAt } },
      ],
    },
    orderBy: { stock: 'asc' },
    take: 20,
  });
  // Most urgent first, relative to each unit's threshold.
  products.sort(
    (a, b) =>
      a.stock / UNITS[isUnitCode(a.unit) ? a.unit : 'piece'].lowStockAt - b.stock / UNITS[isUnitCode(b.unit) ? b.unit : 'piece'].lowStockAt
  );
  res.json(products.slice(0, 10));
}));

// Expiry: products in stock that are expired or expire within EXPIRY_SOON_DAYS, soonest first.
app.get('/api/inventory/expiring', handle(async (_req, res) => {
  res.json(
    await prisma.product.findMany({
      where: { stock: { gt: 0 }, expiryDate: { not: null, lte: expiringBefore() } },
      orderBy: { expiryDate: 'asc' },
      take: 20,
    })
  );
}));

// Settings

async function currentSettings() {
  return (await prisma.storeSettings.findFirst()) ?? (await prisma.storeSettings.create({ data: { id: '1' } }));
}

app.get('/api/settings', handle(async (_req, res) => {
  res.json(publicSettings(await currentSettings()));
}));

app.put('/api/settings', requireAdmin, handle(async (req, res) => {
  const { cashierPassword, ...data } = settingsSchema.parse(req.body);
  const settings = await currentSettings();
  const passwordUpdate =
    cashierPassword === undefined ? {} : { cashierPassword: cashierPassword ? await bcrypt.hash(cashierPassword, 10) : null };
  const updated = await prisma.storeSettings.update({ where: { id: settings.id }, data: { ...data, ...passwordUpdate } });
  res.json(publicSettings(updated));
}));

app.use('/api', salesRouter);
app.use('/api', customersRouter);
app.use('/api', suppliersRouter);
app.use('/api', reportsRouter);

app.use('/api', (_req, res) => {
  sendError(res, new ApiError(404, 'NOT_FOUND', 'Unknown API route'));
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

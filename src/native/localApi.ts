/**
 * Local re-implementation of the Express REST API (server/index.ts) backed by
 * on-device SQLite. Every route returns the same JSON shape the web backend did,
 * so the existing React store/components work unchanged on the native build.
 */
import bcrypt from 'bcryptjs';
import { query, run, transaction } from './db';
import { computeIntelligence, predictiveLowStock, type IntelligenceInput } from '@/lib/intelligence';

export interface LocalRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: any;
  headers: Record<string, string>;
}

export interface LocalResponse {
  status: number;
  body: any;
}

interface SessionToken {
  id: string;
  role: 'ADMIN' | 'CASHIER';
  employeeId: string;
}

const ok = (body: any = {}, status = 200): LocalResponse => ({ status, body });
const err = (status: number, message: string): LocalResponse => ({ status, body: { error: message } });

function encodeToken(payload: SessionToken): string {
  return btoa(JSON.stringify(payload));
}

function decodeToken(headers: Record<string, string>): SessionToken | null {
  const auth = headers['authorization'] || headers['Authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return JSON.parse(atob(auth.slice(7))) as SessionToken;
  } catch {
    return null;
  }
}

function uuid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function toUser(row: any) {
  if (!row) return row;
  const { password, ...rest } = row;
  return { ...rest, isActive: !!row.isActive };
}

// ---- Auth ---------------------------------------------------------------

async function login(req: LocalRequest): Promise<LocalResponse> {
  const { employeeId, password } = req.body || {};
  if (!employeeId || !password) return err(400, 'Login failed');

  // Accept either the employee ID or the full name (PIN signups identify by name).
  let users = await query<any>(`SELECT * FROM User WHERE employeeId = ? AND isActive = 1`, [employeeId]);
  if (users.length === 0) {
    users = await query<any>(`SELECT * FROM User WHERE LOWER(name) = LOWER(?) AND isActive = 1`, [employeeId]);
  }
  let user = users[0];
  let isValid = !!user && (await bcrypt.compare(password, user.password));

  if (!isValid && (!user || user.role === 'CASHIER')) {
    const settings = (await query<any>(`SELECT * FROM StoreSettings LIMIT 1`))[0];
    if (settings?.cashierPassword && (await bcrypt.compare(password, settings.cashierPassword))) {
      user =
        user ||
        (await query<any>(`SELECT * FROM User WHERE employeeId = ? AND isActive = 1 AND role = 'CASHIER'`, [employeeId]))[0];
      if (user) isValid = true;
    }
  }

  if (!user || !isValid) return err(401, 'Invalid credentials or account deactivated');

  const token = encodeToken({ id: user.id, role: user.role, employeeId: user.employeeId });
  return ok({ user: toUser(user), token });
}

async function changePassword(req: LocalRequest): Promise<LocalResponse> {
  const { employeeId, currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return err(400, 'Failed to change password');

  const user = (await query<any>(`SELECT * FROM User WHERE employeeId = ?`, [employeeId]))[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return err(401, 'Current password verification failed');
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await run(`UPDATE User SET password = ?, updatedAt = ? WHERE id = ?`, [hashed, nowIso(), user.id]);
  return ok({ message: 'Password changed successfully' });
}

/**
 * Self-service sign up with Full Name + PIN. The very first account created on
 * a device becomes ADMIN; everyone after is a CASHIER. The PIN is stored only
 * as a bcrypt hash (reusing the password column).
 */
async function register(req: LocalRequest): Promise<LocalResponse> {
  const name = String(req.body?.name || '').trim();
  const pin = String(req.body?.pin || '').trim();
  if (!name) return err(400, 'Full name is required');
  if (!/^\d{4,8}$/.test(pin)) return err(400, 'PIN must be 4 to 8 digits');

  const userCount = (await query<{ c: number }>(`SELECT COUNT(*) AS c FROM User`))[0]?.c ?? 0;
  const role = userCount === 0 ? 'ADMIN' : 'CASHIER';

  // Derive a unique employeeId from the name.
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 16) || 'user';
  let employeeId = base;
  for (let i = 1; (await query<any>(`SELECT id FROM User WHERE employeeId = ?`, [employeeId])).length > 0; i++) {
    employeeId = `${base}-${i}`;
  }

  const ts = nowIso();
  const id = uuid();
  const hashed = await bcrypt.hash(pin, 10);
  await run(
    `INSERT INTO User (id, employeeId, name, role, phone, password, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, ?, 1, ?, ?)`,
    [id, employeeId, name, role, hashed, ts, ts]
  );
  const user = (await query<any>(`SELECT * FROM User WHERE id = ?`, [id]))[0];
  const token = encodeToken({ id: user.id, role: user.role, employeeId: user.employeeId });
  return ok({ user: toUser(user), token }, 201);
}

// ---- Authorization guards ----------------------------------------------

async function getAdmin(req: LocalRequest): Promise<any | null> {
  const session = decodeToken(req.headers);
  if (!session) return null;
  const user = (await query<any>(`SELECT * FROM User WHERE id = ?`, [session.id]))[0];
  if (!user || user.role !== 'ADMIN' || !user.isActive) return null;
  return user;
}

async function authorizeAdminOrKey(req: LocalRequest): Promise<boolean> {
  const session = decodeToken(req.headers);
  if (!session) return false;
  const user = (await query<any>(`SELECT * FROM User WHERE id = ?`, [session.id]))[0];
  if (!user || !user.isActive) return false;
  if (user.role === 'ADMIN') return true;

  const adminKey = req.headers['x-admin-verification-key'];
  if (adminKey) {
    const admin = (await query<any>(`SELECT * FROM User WHERE role = 'ADMIN' AND isActive = 1 LIMIT 1`))[0];
    if (admin && (await bcrypt.compare(adminKey, admin.password))) return true;
  }
  return false;
}

// ---- Users --------------------------------------------------------------

const resetTokens = new Map<string, { expiresAt: number }>();

async function listUsers(req: LocalRequest): Promise<LocalResponse> {
  if (!(await getAdmin(req))) return err(403, 'Forbidden: Admin access required');
  const rows = await query<any>(`SELECT * FROM User ORDER BY createdAt DESC`);
  return ok(rows.map(toUser));
}

async function createUser(req: LocalRequest): Promise<LocalResponse> {
  if (!(await getAdmin(req))) return err(403, 'Forbidden: Admin access required');
  const d = req.body || {};
  if (!d.employeeId || !d.name || !d.role || !d.password || d.password.length < 6) {
    return err(400, 'Failed to create user');
  }
  const ts = nowIso();
  const id = uuid();
  const hashed = await bcrypt.hash(d.password, 10);
  try {
    await run(
      `INSERT INTO User (id, employeeId, name, role, phone, password, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, d.employeeId, d.name, d.role, d.phone ?? null, hashed, d.isActive === false ? 0 : 1, ts, ts]
    );
  } catch {
    return err(400, 'Failed to create user');
  }
  const user = (await query<any>(`SELECT * FROM User WHERE id = ?`, [id]))[0];
  return ok(toUser(user), 201);
}

async function updateUser(req: LocalRequest, id: string): Promise<LocalResponse> {
  if (!(await getAdmin(req))) return err(403, 'Forbidden: Admin access required');
  const d = req.body || {};
  const fields: string[] = [];
  const params: any[] = [];
  const setField = (col: string, val: any) => {
    fields.push(`${col} = ?`);
    params.push(val);
  };

  if (d.employeeId !== undefined) setField('employeeId', d.employeeId);
  if (d.name !== undefined) setField('name', d.name);
  if (d.role !== undefined) setField('role', d.role);
  if (d.phone !== undefined) setField('phone', d.phone);
  if (d.isActive !== undefined) setField('isActive', d.isActive ? 1 : 0);
  if (d.password !== undefined && !String(d.password).startsWith('$2')) {
    setField('password', await bcrypt.hash(d.password, 10));
  } else if (d.password !== undefined) {
    setField('password', d.password);
  }
  setField('updatedAt', nowIso());

  try {
    await run(`UPDATE User SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  } catch {
    return err(500, 'Failed to update user');
  }
  const user = (await query<any>(`SELECT * FROM User WHERE id = ?`, [id]))[0];
  return ok(toUser(user));
}

async function createResetToken(req: LocalRequest, id: string): Promise<LocalResponse> {
  if (!(await getAdmin(req))) return err(403, 'Forbidden: Admin access required');
  const token = uuid();
  resetTokens.set(`${id}-${token}`, { expiresAt: Date.now() + 15 * 60 * 1000 });
  return ok({ token });
}

async function resetPassword(req: LocalRequest, id: string): Promise<LocalResponse> {
  const { token, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return err(400, 'Failed to reset password');
  const key = `${id}-${token}`;
  const data = resetTokens.get(key);
  if (!data || data.expiresAt < Date.now()) return err(401, 'Invalid or expired token');
  const hashed = await bcrypt.hash(newPassword, 10);
  await run(`UPDATE User SET password = ?, updatedAt = ? WHERE id = ?`, [hashed, nowIso(), id]);
  resetTokens.delete(key);
  return ok({ message: 'Password reset successfully' });
}

// ---- Products -----------------------------------------------------------

async function listProducts(req: LocalRequest): Promise<LocalResponse> {
  const page = parseInt(req.query.get('page') || '1', 10);
  const limit = parseInt(req.query.get('limit') || '50', 10);
  const search = req.query.get('search') || '';
  const skip = (page - 1) * limit;

  let where = '';
  const params: any[] = [];
  if (search) {
    where = `WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ?`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const total = (await query<{ c: number }>(`SELECT COUNT(*) AS c FROM Product ${where}`, params))[0]?.c ?? 0;
  const products = await query<any>(
    `SELECT * FROM Product ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [...params, limit, skip]
  );
  return ok({ products, total, page, limit, hasMore: skip + products.length < total });
}

const PRODUCT_FIELDS = ['name', 'sku', 'barcode', 'category', 'productType', 'size', 'color', 'costPrice', 'sellingPrice', 'gst', 'stock', 'minSellWeight', 'supplier', 'expiryDate'];

async function createProduct(req: LocalRequest): Promise<LocalResponse> {
  if (!(await authorizeAdminOrKey(req))) return err(403, 'Forbidden: Admin verification required');
  const d = req.body || {};
  const ts = nowIso();
  const id = uuid();
  try {
    await run(
      `INSERT INTO Product (id, name, sku, barcode, category, productType, size, color, costPrice, sellingPrice, gst, stock, minSellWeight, supplier, expiryDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, d.name, d.sku, d.barcode, d.category, d.productType === 'WEIGHTED' ? 'WEIGHTED' : 'UNIT',
        d.size ?? null, d.color ?? null, d.costPrice, d.sellingPrice, d.gst ?? 0, d.stock ?? 0,
        d.minSellWeight ?? null, d.supplier ?? null, d.expiryDate ?? null, ts, ts,
      ]
    );
  } catch {
    return err(500, 'Failed to create product');
  }
  const product = (await query<any>(`SELECT * FROM Product WHERE id = ?`, [id]))[0];
  return ok(product, 201);
}

async function updateProduct(req: LocalRequest, id: string): Promise<LocalResponse> {
  if (!(await authorizeAdminOrKey(req))) return err(403, 'Forbidden: Admin verification required');
  const d = req.body || {};
  const fields: string[] = [];
  const params: any[] = [];
  for (const f of PRODUCT_FIELDS) {
    if (d[f] !== undefined) {
      fields.push(`${f} = ?`);
      params.push(d[f]);
    }
  }
  fields.push('updatedAt = ?');
  params.push(nowIso());
  try {
    await run(`UPDATE Product SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  } catch {
    return err(500, 'Failed to update product');
  }
  const product = (await query<any>(`SELECT * FROM Product WHERE id = ?`, [id]))[0];
  return ok(product);
}

async function deleteProduct(req: LocalRequest, id: string): Promise<LocalResponse> {
  if (!(await authorizeAdminOrKey(req))) return err(403, 'Forbidden: Admin verification required');
  try {
    await run(`DELETE FROM Product WHERE id = ?`, [id]);
  } catch {
    return err(500, 'Failed to delete product');
  }
  return ok(null, 204);
}

/** Raw rows for the intelligence engine. */
async function fetchIntelInput(): Promise<IntelligenceInput> {
  const products = await query<any>(
    `SELECT id, name, sku, category, supplier, costPrice, sellingPrice, gst, stock, createdAt FROM Product`
  );
  const orders = await query<any>(
    `SELECT id, date, totalAmount, gstAmount, customerName, customerMobile FROM "Order" WHERE status != 'REFUNDED'`
  );
  const items = await query<any>(
    `SELECT oi.orderId, oi.productId, oi.quantity, oi.price
     FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId WHERE o.status != 'REFUNDED'`
  );
  return { products, orders, items };
}

async function lowStock(): Promise<LocalResponse> {
  // Predictive: flag products at/below their demand-based reorder point, not a
  // flat stock<=10 rule. Keeps the same JSON shape the notifications UI expects.
  const input = await fetchIntelInput();
  const flagged = predictiveLowStock(input, 20).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: '',
    stock: p.stock,
    velocityPerDay: p.velocityPerDay,
    daysOfCover: p.daysOfCover,
    suggestedReorderQty: p.suggestedReorderQty,
    status: p.status,
  }));
  return ok(flagged);
}

async function analyticsIntelligence(): Promise<LocalResponse> {
  const input = await fetchIntelInput();
  return ok(computeIntelligence(input));
}

// ---- Orders -------------------------------------------------------------

async function buildOrderWithItems(orderId: string): Promise<any> {
  const order = (await query<any>(`SELECT * FROM "Order" WHERE id = ?`, [orderId]))[0];
  if (!order) return null;
  const items = await query<any>(
    `SELECT oi.id, oi.orderId, oi.productId, oi.quantity, oi.price FROM OrderItem oi WHERE oi.orderId = ?`,
    [orderId]
  );
  for (const item of items) {
    item.product = (await query<any>(`SELECT * FROM Product WHERE id = ?`, [item.productId]))[0] ?? null;
  }
  const processedBy = order.userId
    ? (await query<any>(`SELECT name, employeeId, isActive FROM User WHERE id = ?`, [order.userId]))[0] ?? null
    : null;
  return { ...order, items, processedBy: processedBy ? { ...processedBy, isActive: !!processedBy.isActive } : null };
}

async function createOrder(req: LocalRequest): Promise<LocalResponse> {
  const d = req.body || {};
  const items: any[] = Array.isArray(d.items) ? d.items : [];
  if (!d.totalAmount || items.length === 0) return err(400, 'Invalid order payload');

  try {
    const orderId = await transaction(async () => {
      const count = (await query<{ c: number }>(`SELECT COUNT(*) AS c FROM "Order"`))[0]?.c ?? 0;
      const invoiceNo = `INV-${(count + 1).toString().padStart(4, '0')}`;
      const id = uuid();
      await run(
        `INSERT INTO "Order" (id, invoiceNo, date, totalAmount, gstAmount, paymentMethod, status, customerName, customerMobile, customerId, userId)
         VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)`,
        [
          id, invoiceNo, nowIso(), d.totalAmount, d.gstAmount ?? 0, d.paymentMethod,
          d.customerName ?? null, d.customerMobile ?? null, d.customerId ?? null, d.userId ?? null,
        ],
        false
      );

      for (const item of items) {
        const product = (await query<any>(`SELECT * FROM Product WHERE id = ?`, [item.productId]))[0];
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
        await run(
          `INSERT INTO OrderItem (id, orderId, productId, quantity, price) VALUES (?, ?, ?, ?, ?)`,
          [uuid(), id, item.productId, item.quantity, item.price],
          false
        );
        await run(`UPDATE Product SET stock = stock - ? WHERE id = ?`, [item.quantity, item.productId], false);
      }
      return id;
    });

    return ok(await buildOrderWithItems(orderId), 201);
  } catch (e: any) {
    return err(500, e?.message || 'Failed to process order');
  }
}

async function listOrders(req: LocalRequest): Promise<LocalResponse> {
  const page = parseInt(req.query.get('page') || '1', 10);
  const limit = parseInt(req.query.get('limit') || '50', 10);
  const skip = (page - 1) * limit;
  const search = req.query.get('search');
  const startDate = req.query.get('startDate');
  const endDate = req.query.get('endDate');
  const methods = req.query.getAll('methods').filter((m) => m && m.trim() !== '');

  const clauses: string[] = [];
  const params: any[] = [];
  if (search) {
    clauses.push(`(invoiceNo LIKE ? OR customerMobile LIKE ? OR customerName LIKE ?)`);
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (startDate) {
    clauses.push(`date >= ?`);
    params.push(new Date(startDate).toISOString());
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    clauses.push(`date <= ?`);
    params.push(end.toISOString());
  }
  if (methods.length > 0) {
    clauses.push(`paymentMethod IN (${methods.map(() => '?').join(', ')})`);
    params.push(...methods);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const total = (await query<{ c: number }>(`SELECT COUNT(*) AS c FROM "Order" ${where}`, params))[0]?.c ?? 0;
  const rows = await query<any>(
    `SELECT o.*,
       (SELECT COUNT(*) FROM OrderItem oi WHERE oi.orderId = o.id) AS itemCount,
       u.name AS u_name, u.employeeId AS u_employeeId, u.isActive AS u_isActive
     FROM "Order" o LEFT JOIN User u ON u.id = o.userId
     ${where} ORDER BY o.date DESC LIMIT ? OFFSET ?`,
    [...params, limit, skip]
  );

  const orders = rows.map((r) => {
    const { itemCount, u_name, u_employeeId, u_isActive, ...order } = r;
    return {
      ...order,
      _count: { items: itemCount },
      processedBy: u_name ? { name: u_name, employeeId: u_employeeId, isActive: !!u_isActive } : null,
    };
  });

  return ok({ orders, total, page, limit, hasMore: skip + orders.length < total });
}

async function getOrder(orderId: string): Promise<LocalResponse> {
  const order = await buildOrderWithItems(orderId);
  if (!order) return err(404, 'Order not found');
  return ok(order);
}

/**
 * Refunds an order: restocks every line item and marks the order REFUNDED.
 * Profit/revenue analytics exclude refunded orders, so the reversal is
 * reflected automatically. Idempotent — refunding twice is a no-op error.
 */
async function refundOrder(req: LocalRequest, orderId: string): Promise<LocalResponse> {
  if (!(await authorizeAdminOrKey(req))) return err(403, 'Forbidden: Admin verification required');
  try {
    await transaction(async () => {
      const order = (await query<any>(`SELECT * FROM "Order" WHERE id = ?`, [orderId]))[0];
      if (!order) throw new Error('Order not found');
      if (order.status === 'REFUNDED') throw new Error('Order already refunded');

      const items = await query<any>(`SELECT productId, quantity FROM OrderItem WHERE orderId = ?`, [orderId]);
      for (const item of items) {
        await run(`UPDATE Product SET stock = stock + ? WHERE id = ?`, [item.quantity, item.productId], false);
      }
      await run(`UPDATE "Order" SET status = 'REFUNDED', refundedAt = ? WHERE id = ?`, [nowIso(), orderId], false);
    });
  } catch (e: any) {
    return err(400, e?.message || 'Failed to refund order');
  }
  return ok(await buildOrderWithItems(orderId));
}

// ---- Customers ----------------------------------------------------------

async function listCustomers(): Promise<LocalResponse> {
  const rows = await query<any>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM "Order" o WHERE o.customerId = c.id AND o.status != 'REFUNDED') AS totalOrders,
       (SELECT COALESCE(SUM(o.totalAmount), 0) FROM "Order" o WHERE o.customerId = c.id AND o.status != 'REFUNDED') AS totalSpent
     FROM Customer c ORDER BY c.name ASC`
  );
  return ok(rows);
}

async function getCustomer(id: string): Promise<LocalResponse> {
  const customer = (await query<any>(`SELECT * FROM Customer WHERE id = ?`, [id]))[0];
  if (!customer) return err(404, 'Customer not found');
  const orders = await query<any>(
    `SELECT id, invoiceNo, date, totalAmount, status, paymentMethod FROM "Order" WHERE customerId = ? ORDER BY date DESC`,
    [id]
  );
  const totalSpent = orders.filter((o) => o.status !== 'REFUNDED').reduce((s, o) => s + o.totalAmount, 0);
  return ok({ ...customer, orders, totalOrders: orders.filter((o) => o.status !== 'REFUNDED').length, totalSpent });
}

async function createCustomer(req: LocalRequest): Promise<LocalResponse> {
  const d = req.body || {};
  if (!d.name) return err(400, 'Customer name is required');
  const ts = nowIso();
  const id = uuid();
  await run(
    `INSERT INTO Customer (id, name, phone, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, d.name, d.phone ?? null, d.notes ?? null, ts, ts]
  );
  return ok((await query<any>(`SELECT * FROM Customer WHERE id = ?`, [id]))[0], 201);
}

async function updateCustomer(req: LocalRequest, id: string): Promise<LocalResponse> {
  const d = req.body || {};
  const fields: string[] = [];
  const params: any[] = [];
  for (const f of ['name', 'phone', 'notes']) {
    if (d[f] !== undefined) { fields.push(`${f} = ?`); params.push(d[f]); }
  }
  if (fields.length === 0) return err(400, 'Nothing to update');
  fields.push('updatedAt = ?'); params.push(nowIso());
  await run(`UPDATE Customer SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  return ok((await query<any>(`SELECT * FROM Customer WHERE id = ?`, [id]))[0]);
}

async function deleteCustomer(id: string): Promise<LocalResponse> {
  await run(`UPDATE "Order" SET customerId = NULL WHERE customerId = ?`, [id]);
  await run(`DELETE FROM Customer WHERE id = ?`, [id]);
  return ok(null, 204);
}

// ---- Suppliers ----------------------------------------------------------

async function listSuppliers(): Promise<LocalResponse> {
  const rows = await query<any>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM Product p WHERE p.supplier = s.name) AS linkedProducts
     FROM Supplier s ORDER BY s.name ASC`
  );
  return ok(rows);
}

async function createSupplier(req: LocalRequest): Promise<LocalResponse> {
  const d = req.body || {};
  if (!d.name) return err(400, 'Supplier name is required');
  const ts = nowIso();
  const id = uuid();
  await run(
    `INSERT INTO Supplier (id, name, phone, address, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, d.name, d.phone ?? null, d.address ?? null, d.notes ?? null, ts, ts]
  );
  return ok((await query<any>(`SELECT * FROM Supplier WHERE id = ?`, [id]))[0], 201);
}

async function updateSupplier(req: LocalRequest, id: string): Promise<LocalResponse> {
  const d = req.body || {};
  const fields: string[] = [];
  const params: any[] = [];
  for (const f of ['name', 'phone', 'address', 'notes']) {
    if (d[f] !== undefined) { fields.push(`${f} = ?`); params.push(d[f]); }
  }
  if (fields.length === 0) return err(400, 'Nothing to update');
  fields.push('updatedAt = ?'); params.push(nowIso());
  await run(`UPDATE Supplier SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  return ok((await query<any>(`SELECT * FROM Supplier WHERE id = ?`, [id]))[0]);
}

async function deleteSupplier(id: string): Promise<LocalResponse> {
  await run(`DELETE FROM Supplier WHERE id = ?`, [id]);
  return ok(null, 204);
}

// ---- Settings -----------------------------------------------------------

async function getSettings(): Promise<LocalResponse> {
  const s = (await query<any>(`SELECT * FROM StoreSettings LIMIT 1`))[0];
  if (!s) return ok(s);
  return ok({
    ...s,
    taxEnabled: s.taxEnabled === undefined ? true : !!s.taxEnabled,
    defaultTaxRate: s.defaultTaxRate ?? 19,
    pricesIncludeTax: !!s.pricesIncludeTax,
  });
}

async function updateSettings(req: LocalRequest): Promise<LocalResponse> {
  const d = req.body || {};
  let cashierPassword = d.cashierPassword;
  if (cashierPassword && !String(cashierPassword).startsWith('$2')) {
    cashierPassword = await bcrypt.hash(cashierPassword, 10);
  }
  const taxEnabled = d.taxEnabled === false ? 0 : 1;
  const defaultTaxRate = Number(d.defaultTaxRate ?? 19) || 0;
  const pricesIncludeTax = d.pricesIncludeTax ? 1 : 0;
  const existing = (await query<any>(`SELECT * FROM StoreSettings LIMIT 1`))[0];
  if (existing) {
    await run(
      `UPDATE StoreSettings SET name = ?, address = ?, nif = ?, nis = ?, rc = ?, phone = ?, taxEnabled = ?, defaultTaxRate = ?, pricesIncludeTax = ?, cashierPassword = ?, updatedAt = ? WHERE id = ?`,
      [d.name, d.address, d.nif ?? '', d.nis ?? '', d.rc ?? '', d.phone, taxEnabled, defaultTaxRate, pricesIncludeTax, cashierPassword ?? existing.cashierPassword ?? null, nowIso(), existing.id]
    );
  } else {
    await run(
      `INSERT INTO StoreSettings (id, name, address, nif, nis, rc, phone, taxEnabled, defaultTaxRate, pricesIncludeTax, cashierPassword, updatedAt) VALUES ('1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.name, d.address, d.nif ?? '', d.nis ?? '', d.rc ?? '', d.phone, taxEnabled, defaultTaxRate, pricesIncludeTax, cashierPassword ?? null, nowIso()]
    );
  }
  return getSettings();
}

// ---- Analytics ----------------------------------------------------------

function startOfTodayIso(): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString();
}

async function analyticsSummary(): Promise<LocalResponse> {
  const today = startOfTodayIso();
  const agg = (await query<any>(
    `SELECT COALESCE(SUM(totalAmount), 0) AS revenue, COALESCE(SUM(gstAmount), 0) AS gst, COUNT(*) AS orders
     FROM "Order" WHERE date >= ? AND status != 'REFUNDED'`,
    [today]
  ))[0];
  const breakdown = await query<any>(
    `SELECT paymentMethod, SUM(totalAmount) AS total FROM "Order" WHERE date >= ? AND status != 'REFUNDED' GROUP BY paymentMethod`,
    [today]
  );
  return ok({
    revenue: agg?.revenue || 0,
    gst: agg?.gst || 0,
    orders: agg?.orders || 0,
    paymentBreakdown: breakdown.map((b) => ({ paymentMethod: b.paymentMethod, _sum: { totalAmount: b.total } })),
  });
}

async function analyticsSales(): Promise<LocalResponse> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);
  const orders = await query<any>(`SELECT date, totalAmount FROM "Order" WHERE date >= ? AND status != 'REFUNDED' ORDER BY date ASC`, [since.toISOString()]);
  const daily: Record<string, number> = {};
  for (const o of orders) {
    const day = String(o.date).split('T')[0];
    daily[day] = (daily[day] || 0) + o.totalAmount;
  }
  const result = Object.entries(daily)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return ok(result);
}

/**
 * Single aggregate for the business dashboard: today's profit/revenue/units,
 * stock + refunds, best-seller & most-profitable products, low-stock & expiry
 * alerts, customer/supplier counts, and recent transactions.
 */
async function analyticsDashboard(): Promise<LocalResponse> {
  const today = startOfTodayIso();
  const now = Date.now();

  const products = await query<any>(`SELECT id, name, productType, costPrice, sellingPrice, stock, expiryDate FROM Product`);
  const productMap = new Map<string, any>(products.map((p) => [p.id, p]));

  const todayOrders = await query<any>(`SELECT id, totalAmount FROM "Order" WHERE date >= ? AND status != 'REFUNDED'`, [today]);
  const todayIds = new Set(todayOrders.map((o) => o.id));
  const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);

  const refunds = (await query<any>(`SELECT COUNT(*) AS c, COALESCE(SUM(totalAmount), 0) AS amt FROM "Order" WHERE refundedAt >= ?`, [today]))[0];

  // All non-refunded line items (all-time) for ranking + today's slice.
  const items = await query<any>(
    `SELECT oi.productId, oi.quantity, oi.price, oi.orderId
     FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId WHERE o.status != 'REFUNDED'`
  );

  let todayProfit = 0;
  let productsSoldToday = 0;
  const agg = new Map<string, { qty: number; profit: number }>();
  for (const it of items) {
    const cost = productMap.get(it.productId)?.costPrice ?? 0;
    const lineProfit = (it.price - cost) * it.quantity;
    if (todayIds.has(it.orderId)) {
      todayProfit += lineProfit;
      productsSoldToday += it.quantity;
    }
    const a = agg.get(it.productId) || { qty: 0, profit: 0 };
    a.qty += it.quantity;
    a.profit += lineProfit;
    agg.set(it.productId, a);
  }

  let bestSelling: any = null;
  let mostProfitable: any = null;
  for (const [pid, a] of agg) {
    const p = productMap.get(pid);
    if (!p) continue;
    if (!bestSelling || a.qty > bestSelling.qty) bestSelling = { id: pid, name: p.name, qty: round1(a.qty) };
    if (!mostProfitable || a.profit > mostProfitable.profit) mostProfitable = { id: pid, name: p.name, profit: a.profit };
  }

  const lowStock = products.filter((p) => p.stock < (p.productType === 'WEIGHTED' ? 2 : 10));
  const expiring = products
    .filter((p) => p.expiryDate)
    .map((p) => ({ id: p.id, name: p.name, days: Math.ceil((new Date(p.expiryDate).getTime() - now) / 86400000) }))
    .filter((p) => p.days <= 7)
    .sort((a, b) => a.days - b.days);

  // --- Sales trend: last 7 days vs the 7 days before that ---
  const d7 = new Date(now - 7 * 86400000).toISOString();
  const d14 = new Date(now - 14 * 86400000).toISOString();
  const this7 = (await query<any>(`SELECT COALESCE(SUM(totalAmount),0) AS v FROM "Order" WHERE date >= ? AND status != 'REFUNDED'`, [d7]))[0]?.v ?? 0;
  const prev7 = (await query<any>(`SELECT COALESCE(SUM(totalAmount),0) AS v FROM "Order" WHERE date >= ? AND date < ? AND status != 'REFUNDED'`, [d14, d7]))[0]?.v ?? 0;
  const trendPct = prev7 > 0 ? ((this7 - prev7) / prev7) * 100 : this7 > 0 ? 100 : 0;
  const salesTrend = {
    current: round1(this7),
    previous: round1(prev7),
    pct: Math.round(trendPct),
    direction: trendPct > 2 ? 'up' : trendPct < -2 ? 'down' : 'flat',
  };

  // --- Inventory health score (0-100): penalise low stock, expiry, dead stock ---
  const d30 = new Date(now - 30 * 86400000).toISOString();
  const soldRecentRows = await query<any>(
    `SELECT DISTINCT oi.productId AS pid FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId WHERE o.date >= ? AND o.status != 'REFUNDED'`,
    [d30]
  );
  const soldRecent = new Set(soldRecentRows.map((r) => r.pid));
  const totalP = products.length || 1;
  const deadCount = products.filter((p) => (p.stock || 0) > 0 && !soldRecent.has(p.id)).length;
  const expiredOrSoon = expiring.length;
  const lowRatio = lowStock.length / totalP;
  const expiryRatio = expiredOrSoon / totalP;
  const deadRatio = deadCount / totalP;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (lowRatio * 40 + expiryRatio * 30 + deadRatio * 30))));
  const inventoryHealth = {
    score: products.length ? healthScore : 100,
    label: healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Poor',
    deadStock: deadCount,
  };

  const totalCustomers = (await query<{ c: number }>(`SELECT COUNT(*) AS c FROM Customer`))[0]?.c ?? 0;
  const totalSuppliers = (await query<{ c: number }>(`SELECT COUNT(*) AS c FROM Supplier`))[0]?.c ?? 0;
  const recent = await query<any>(
    `SELECT id, invoiceNo, date, totalAmount, status, paymentMethod, customerName FROM "Order" ORDER BY date DESC LIMIT 8`
  );

  return ok({
    todayProfit,
    todayRevenue,
    productsSoldToday: round1(productsSoldToday),
    totalStock: round1(products.reduce((s, p) => s + (p.stock || 0), 0)),
    totalProducts: products.length,
    refundsToday: { count: refunds?.c ?? 0, amount: refunds?.amt ?? 0 },
    bestSelling,
    mostProfitable,
    lowStock: { count: lowStock.length, items: lowStock.slice(0, 3).map((p) => ({ id: p.id, name: p.name, stock: round1(p.stock), weighted: p.productType === 'WEIGHTED' })) },
    expiry: { count: expiring.length, items: expiring.slice(0, 3) },
    totalCustomers,
    totalSuppliers,
    salesTrend,
    inventoryHealth,
    recent,
  });
}

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ---- Router -------------------------------------------------------------

export async function handleLocalRequest(req: LocalRequest): Promise<LocalResponse> {
  const { method, path } = req;
  try {
    if (path === '/api/auth/login' && method === 'POST') return await login(req);
    if (path === '/api/auth/register' && method === 'POST') return await register(req);
    if (path === '/api/auth/change-password' && method === 'POST') return await changePassword(req);

    if (path === '/api/users' && method === 'GET') return await listUsers(req);
    if (path === '/api/users' && method === 'POST') return await createUser(req);

    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/api\/users\/([^/]+)\/reset-token$/)) && method === 'POST') return await createResetToken(req, m[1]);
    if ((m = path.match(/^\/api\/users\/([^/]+)\/reset-password$/)) && method === 'POST') return await resetPassword(req, m[1]);
    if ((m = path.match(/^\/api\/users\/([^/]+)$/)) && method === 'PUT') return await updateUser(req, m[1]);

    if (path === '/api/products' && method === 'GET') return await listProducts(req);
    if (path === '/api/products' && method === 'POST') return await createProduct(req);
    if ((m = path.match(/^\/api\/products\/([^/]+)$/)) && method === 'PUT') return await updateProduct(req, m[1]);
    if ((m = path.match(/^\/api\/products\/([^/]+)$/)) && method === 'DELETE') return await deleteProduct(req, m[1]);

    if (path === '/api/inventory/low-stock' && method === 'GET') return await lowStock();

    if (path === '/api/orders' && method === 'POST') return await createOrder(req);
    if (path === '/api/orders' && method === 'GET') return await listOrders(req);
    if ((m = path.match(/^\/api\/orders\/([^/]+)\/refund$/)) && method === 'POST') return await refundOrder(req, m[1]);
    if ((m = path.match(/^\/api\/orders\/([^/]+)$/)) && method === 'GET') return await getOrder(m[1]);

    if (path === '/api/customers' && method === 'GET') return await listCustomers();
    if (path === '/api/customers' && method === 'POST') return await createCustomer(req);
    if ((m = path.match(/^\/api\/customers\/([^/]+)$/)) && method === 'GET') return await getCustomer(m[1]);
    if ((m = path.match(/^\/api\/customers\/([^/]+)$/)) && method === 'PUT') return await updateCustomer(req, m[1]);
    if ((m = path.match(/^\/api\/customers\/([^/]+)$/)) && method === 'DELETE') return await deleteCustomer(m[1]);

    if (path === '/api/suppliers' && method === 'GET') return await listSuppliers();
    if (path === '/api/suppliers' && method === 'POST') return await createSupplier(req);
    if ((m = path.match(/^\/api\/suppliers\/([^/]+)$/)) && method === 'PUT') return await updateSupplier(req, m[1]);
    if ((m = path.match(/^\/api\/suppliers\/([^/]+)$/)) && method === 'DELETE') return await deleteSupplier(m[1]);

    if (path === '/api/settings' && method === 'GET') return await getSettings();
    if (path === '/api/settings' && method === 'PUT') return await updateSettings(req);

    if (path === '/api/analytics/dashboard' && method === 'GET') return await analyticsDashboard();
    if (path === '/api/analytics/summary' && method === 'GET') return await analyticsSummary();
    if (path === '/api/analytics/sales' && method === 'GET') return await analyticsSales();
    if (path === '/api/analytics/intelligence' && method === 'GET') return await analyticsIntelligence();

    return err(404, 'Not found');
  } catch (e: any) {
    return err(500, e?.message || 'Internal error');
  }
}

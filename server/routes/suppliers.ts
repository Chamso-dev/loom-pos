import { Router } from 'express';
import { z } from 'zod';
import { ApiError, handle, nextNumber, prisma, requireAdmin, requireAuth } from '../context';
import {
  allocateRepayment,
  isValidQuantity,
  normalizeAlgerianPhone,
  roundMoney,
  roundQuantity,
  SETTLING_METHOD_CODES,
  sumMoney,
} from '../../src/lib/domain';

export const suppliersRouter = Router();

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).nullish(),
  address: z.string().trim().max(200).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

const cleanPhone = (phone: string | null | undefined) => {
  if (!phone) return null;
  const normalized = normalizeAlgerianPhone(phone);
  if (!normalized) throw new ApiError(400, 'INVALID_PHONE');
  return normalized;
};

const settlingEnum = z.enum(SETTLING_METHOD_CODES as [string, ...string[]]);

suppliersRouter.get('/suppliers', requireAuth, handle(async (req, res) => {
  const { search } = req.query;
  const where: any = search ? { name: { contains: String(search), mode: 'insensitive' } } : {};
  const [suppliers, owed] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: [{ balance: 'desc' }, { name: 'asc' }], take: 200 }),
    prisma.supplier.aggregate({ _sum: { balance: true } }),
  ]);
  res.json({ suppliers, totalOwed: roundMoney(owed._sum.balance ?? 0) });
}));

suppliersRouter.post('/suppliers', requireAdmin, handle(async (req, res) => {
  const data = supplierSchema.parse(req.body);
  res.status(201).json(await prisma.supplier.create({ data: { ...data, phone: cleanPhone(data.phone) } }));
}));

suppliersRouter.put('/suppliers/:id', requireAdmin, handle(async (req, res) => {
  const data = supplierSchema.partial().parse(req.body);
  const update = { ...data, ...(data.phone !== undefined ? { phone: cleanPhone(data.phone) } : {}) };
  res.json(await prisma.supplier.update({ where: { id: req.params.id }, data: update }));
}));

suppliersRouter.get('/suppliers/:id', requireAuth, handle(async (req, res) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!supplier) throw new ApiError(404, 'SUPPLIER_NOT_FOUND');
  const [purchases, payments] = await Promise.all([
    prisma.purchase.findMany({ where: { supplierId: supplier.id }, orderBy: { date: 'desc' }, take: 50, include: { _count: { select: { items: true } } } }),
    prisma.supplierPayment.findMany({ where: { supplierId: supplier.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  res.json({ supplier, purchases, payments });
}));

const supplierPaymentSchema = z.object({
  method: settlingEnum,
  amount: z.number().positive(),
  reference: z.string().trim().max(80).nullish(),
});

// Pay a supplier. Settles their oldest unpaid purchases first.
suppliersRouter.post('/suppliers/:id/payments', requireAdmin, handle(async (req, res) => {
  const input = supplierPaymentSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) throw new ApiError(404, 'SUPPLIER_NOT_FOUND');
    const amount = roundMoney(input.amount);
    if (amount - supplier.balance > 0.004) {
      throw new ApiError(400, 'AMOUNT_EXCEEDS_BALANCE', 'Payment is larger than the amount owed', { balance: supplier.balance });
    }
    const unpaid = await tx.purchase.findMany({
      where: { supplierId: supplier.id, balanceDue: { gt: 0 } },
      orderBy: { date: 'asc' },
      select: { id: true, balanceDue: true, amountPaid: true },
    });
    const { allocations } = allocateRepayment(amount, unpaid);
    for (const a of allocations) {
      const p = unpaid.find((u) => u.id === a.id)!;
      await tx.purchase.update({
        where: { id: p.id },
        data: { balanceDue: roundMoney(p.balanceDue - a.amount), amountPaid: roundMoney(p.amountPaid + a.amount) },
      });
    }
    const payment = await tx.supplierPayment.create({
      data: {
        supplierId: supplier.id,
        purchaseId: allocations.length === 1 ? allocations[0].id : null,
        method: input.method,
        amount,
        reference: input.reference ?? null,
        userId: req.user!.id,
      },
    });
    const updated = await tx.supplier.update({ where: { id: supplier.id }, data: { balance: Math.max(0, roundMoney(supplier.balance - amount)) } });
    return { payment, supplier: updated };
  });
  res.status(201).json(result);
}));

suppliersRouter.get('/purchases', requireAuth, handle(async (req, res) => {
  const { page = '1', supplierId } = req.query;
  const p = Math.max(1, parseInt(String(page)) || 1);
  const where: any = supplierId ? { supplierId: String(supplierId) } : {};
  const [total, purchases] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (p - 1) * 50,
      take: 50,
      include: { supplier: { select: { id: true, name: true } }, _count: { select: { items: true } } },
    }),
  ]);
  res.json({ purchases, total, hasMore: p * 50 < total });
}));

suppliersRouter.get('/purchases/:id', requireAuth, handle(async (req, res) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id: req.params.id },
    include: { supplier: true, items: { include: { product: true } }, payments: true },
  });
  if (!purchase) throw new ApiError(404, 'PURCHASE_NOT_FOUND');
  res.json(purchase);
}));

const purchaseSchema = z.object({
  supplierId: z.string().nullish(),
  reference: z.string().trim().max(80).nullish(),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().positive(), unitCost: z.number().min(0) })).min(1),
  amountPaid: z.number().min(0).default(0),
  paymentMethod: settlingEnum.default('CASH'),
  /** Use this delivery's unit cost as the product's cost price. */
  updateCostPrice: z.boolean().default(true),
});

// Receive goods: stock goes up, cost prices follow the latest delivery,
// and any unpaid amount is added to what the shop owes the supplier.
suppliersRouter.post('/purchases', requireAdmin, handle(async (req, res) => {
  const input = purchaseSchema.parse(req.body);
  const purchase = await prisma.$transaction(async (tx) => {
    const supplier = input.supplierId ? await tx.supplier.findUnique({ where: { id: input.supplierId } }) : null;
    if (input.supplierId && !supplier) throw new ApiError(404, 'SUPPLIER_NOT_FOUND');

    const products = await tx.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
    const lines = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND');
      if (!isValidQuantity(item.quantity, product.unit)) throw new ApiError(400, 'INVALID_QUANTITY', undefined, { product: product.name });
      const quantity = roundQuantity(item.quantity, product.unit);
      return { product, quantity, unitCost: roundMoney(item.unitCost) };
    });

    const totalAmount = sumMoney(lines.map((l) => l.quantity * l.unitCost));
    const amountPaid = Math.min(roundMoney(input.amountPaid), totalAmount);
    const balanceDue = roundMoney(totalAmount - amountPaid);
    if (balanceDue > 0 && !supplier) throw new ApiError(400, 'SUPPLIER_REQUIRED_FOR_BALANCE');

    const created = await tx.purchase.create({
      data: {
        purchaseNo: await nextNumber(tx, 'purchase'),
        supplierId: supplier?.id ?? null,
        reference: input.reference ?? null,
        totalAmount,
        amountPaid,
        balanceDue,
        userId: req.user!.id,
        items: { create: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitCost: l.unitCost })) },
      },
    });

    for (const l of lines) {
      await tx.product.update({
        where: { id: l.product.id },
        data: {
          stock: roundQuantity(l.product.stock + l.quantity, l.product.unit),
          ...(input.updateCostPrice ? { costPrice: l.unitCost } : {}),
          ...(supplier ? { supplierId: supplier.id, supplier: supplier.name } : {}),
        },
      });
      l.product.stock = roundQuantity(l.product.stock + l.quantity, l.product.unit);
    }

    if (amountPaid > 0) {
      await tx.supplierPayment.create({
        data: { supplierId: supplier?.id ?? null, purchaseId: created.id, method: input.paymentMethod, amount: amountPaid, userId: req.user!.id },
      });
    }
    if (supplier) {
      if (balanceDue > 0) {
        await tx.supplier.update({ where: { id: supplier.id }, data: { balance: roundMoney(supplier.balance + balanceDue) } });
      }
    }

    return tx.purchase.findUnique({ where: { id: created.id }, include: { supplier: true, items: { include: { product: true } } } });
  });
  res.status(201).json(purchase);
}));

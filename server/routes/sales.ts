import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { ApiError, handle, isRequestIdClash, lockRows, nextNumber, prisma, requestIdSchema, requireAuth, type Tx } from '../context';
import {
  isValidQuantity,
  normalizeAlgerianPhone,
  orderStatus,
  PAYMENT_METHOD_CODES,
  priceSale,
  refundValue,
  roundMoney,
  roundQuantity,
  SETTLING_METHOD_CODES,
  settlePayments,
  splitRefund,
  type PaymentMethodCode,
} from '../../src/lib/domain';

export const salesRouter = Router();

const methodEnum = z.enum(PAYMENT_METHOD_CODES as [PaymentMethodCode, ...PaymentMethodCode[]]);
const settlingEnum = z.enum(SETTLING_METHOD_CODES as [string, ...string[]]);

const orderSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().positive() })).min(1),
  discount: z.object({ type: z.enum(['amount', 'percent']), value: z.number().min(0) }).nullish(),
  payments: z.array(z.object({ method: methodEnum, amount: z.number().min(0), reference: z.string().max(80).nullish() })).min(1),
  customerId: z.string().nullish(),
  /** Creates a customer on the fly, for a first credit sale. */
  newCustomer: z.object({ name: z.string().trim().min(1), phone: z.string().nullish() }).nullish(),
  customerName: z.string().trim().max(120).nullish(),
  customerMobile: z.string().trim().max(30).nullish(),
  requestId: requestIdSchema,
});

export const orderInclude = {
  items: { include: { product: true } },
  payments: { orderBy: { createdAt: 'asc' } },
  customer: true,
  processedBy: { select: { name: true, employeeId: true, isActive: true, role: true } },
  refunds: { include: { items: true }, orderBy: { createdAt: 'asc' } },
} as const;

/** Finds or creates the customer a sale is for. An existing customer is locked until the sale commits. */
async function resolveCustomer(tx: Tx, input: z.infer<typeof orderSchema>) {
  if (input.customerId) {
    await lockRows(tx, 'customer', [input.customerId]);
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND');
    return customer;
  }
  if (input.newCustomer) {
    const phone = input.newCustomer.phone ? normalizeAlgerianPhone(input.newCustomer.phone) : null;
    if (input.newCustomer.phone && !phone) throw new ApiError(400, 'INVALID_PHONE');
    if (phone) {
      const existing = await tx.customer.findUnique({ where: { phone } });
      if (existing) return existing;
    }
    return tx.customer.create({ data: { name: input.newCustomer.name, phone } });
  }
  return null;
}

// Create a sale. Prices, totals, tax, change and credit are all computed here.
salesRouter.post('/orders', requireAuth, handle(async (req, res) => {
  const input = orderSchema.parse(req.body);

  // The same requestId again means the till retried after losing the answer: return the
  // sale that was already recorded instead of selling twice.
  const already = () => prisma.order.findUnique({ where: { requestId: input.requestId! }, include: orderInclude });
  if (input.requestId) {
    const existing = await already();
    if (existing) return res.status(200).json(existing);
  }

  const order = await prisma.$transaction(async (tx) => {
    // Lock order: customer, then products. Reading after the lock gives current stock and
    // balance that no other till can change until this sale commits.
    const customer = await resolveCustomer(tx, input);
    const ids = [...new Set(input.items.map((i) => i.productId))];
    await lockRows(tx, 'product', ids);
    const products = await tx.product.findMany({ where: { id: { in: ids } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Merge repeated lines for the same product before checking stock.
    const merged = new Map<string, number>();
    for (const item of input.items) merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);

    const lines = [...merged.entries()].map(([productId, quantity]) => {
      const product = byId.get(productId);
      if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Product ${productId} not found`);
      // Check the quantity as sent: 1.5 pieces is an error, not 2 pieces.
      if (!isValidQuantity(quantity, product.unit)) {
        throw new ApiError(400, 'INVALID_QUANTITY', `Invalid quantity for ${product.name}`, { product: product.name });
      }
      const q = roundQuantity(quantity, product.unit);
      if (product.stock + 1e-9 < q) {
        throw new ApiError(409, 'INSUFFICIENT_STOCK', `Insufficient stock for ${product.name}`, {
          product: product.name,
          available: product.stock,
          unit: product.unit,
        });
      }
      return { product, quantity: q };
    });

    const totals = priceSale(
      lines.map(({ product, quantity }) => ({
        unitPrice: product.sellingPrice,
        quantity,
        unit: product.unit,
        taxRate: product.taxRate,
        costPrice: product.costPrice,
      })),
      input.discount ?? null
    );

    const settlement = settlePayments(totals.total, input.payments, Boolean(customer));
    if (settlement.errors.length) {
      throw new ApiError(400, settlement.errors[0], 'Payments do not settle the sale', {
        remaining: settlement.remaining,
        total: totals.total,
      });
    }

    if (customer && settlement.balanceDue > 0 && customer.creditLimit != null) {
      const after = roundMoney(customer.balance + settlement.balanceDue);
      if (after - customer.creditLimit > 0.004) {
        throw new ApiError(400, 'CREDIT_LIMIT_EXCEEDED', 'Credit limit exceeded', {
          limit: customer.creditLimit,
          balance: customer.balance,
        });
      }
    }

    const methods = new Set(settlement.applied.map((p) => p.method));
    if (settlement.balanceDue > 0) methods.add('CREDIT');
    const paymentMethod = methods.size === 1 ? [...methods][0] : 'SPLIT';

    const created = await tx.order.create({
      data: {
        id: crypto.randomUUID(),
        invoiceNo: await nextNumber(tx, 'order'),
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        totalAmount: totals.total,
        taxAmount: totals.taxAmount,
        amountPaid: settlement.amountPaid,
        changeGiven: settlement.change,
        balanceDue: settlement.balanceDue,
        status: orderStatus({ totalAmount: totals.total, refundedAmount: 0, balanceDue: settlement.balanceDue }),
        paymentMethod,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? input.customerName ?? null,
        customerMobile: customer?.phone ?? (input.customerMobile ? normalizeAlgerianPhone(input.customerMobile) ?? input.customerMobile : null),
        userId: req.user!.id,
        requestId: input.requestId ?? null,
      },
    });

    for (const [i, { product, quantity }] of lines.entries()) {
      await tx.orderItem.create({
        data: {
          id: crypto.randomUUID(),
          orderId: created.id,
          productId: product.id,
          quantity,
          unit: product.unit,
          price: product.sellingPrice,
          costPrice: product.costPrice,
          taxRate: product.taxRate,
        },
      });
      await tx.product.update({
        where: { id: product.id },
        data: { stock: roundQuantity(product.stock - totals.lines[i].quantity, product.unit) },
      });
    }

    for (const p of settlement.applied.filter((p) => p.method !== 'CREDIT')) {
      await tx.payment.create({
        data: {
          kind: 'SALE',
          method: p.method,
          amount: p.amount,
          tendered: p.tendered && p.tendered !== p.amount ? p.tendered : null,
          reference: p.reference ?? null,
          orderId: created.id,
          customerId: customer?.id ?? null,
          userId: req.user!.id,
        },
      });
    }

    if (customer && settlement.balanceDue > 0) {
      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: roundMoney(customer.balance + settlement.balanceDue) },
      });
    }

    return tx.order.findUnique({ where: { id: created.id }, include: orderInclude });
  }).catch(async (error) => {
    // Two copies of the same retry arrived together; the other one recorded the sale.
    if (input.requestId && isRequestIdClash(error)) return { replayed: await already() };
    throw error;
  });

  if (order && 'replayed' in order) return res.status(200).json(order.replayed);
  res.status(201).json(order);
}));

// List sales with search, date range and payment method filters.
salesRouter.get('/orders', requireAuth, handle(async (req, res) => {
  const { search, startDate, endDate, methods, status, customerId, page = '1', limit = '50' } = req.query;
  const p = Math.max(1, parseInt(String(page)) || 1);
  const l = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));

  const where: any = {};
  if (search) {
    const s = String(search);
    where.OR = [
      { invoiceNo: { contains: s, mode: 'insensitive' } },
      { customerMobile: { contains: s.replace(/\s/g, '') } },
      { customerName: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(`${startDate}T00:00:00`);
    if (endDate) where.date.lte = new Date(`${endDate}T23:59:59.999`);
  }
  if (methods) {
    const list = (Array.isArray(methods) ? methods : [methods]).map(String).filter(Boolean);
    if (list.length) {
      // CREDIT is not a payment record; it shows as money still or once owed on the sale.
      const orList: any[] = [{ payments: { some: { method: { in: list } } } }];
      if (list.includes('CREDIT')) orList.push({ paymentMethod: 'CREDIT' }, { balanceDue: { gt: 0 } });
      where.AND = [...(where.AND ?? []), { OR: orList }];
    }
  }
  if (status) where.status = String(status);
  if (customerId) where.customerId = String(customerId);

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip: (p - 1) * l,
      take: l,
      orderBy: { date: 'desc' },
      include: {
        processedBy: { select: { name: true, employeeId: true, isActive: true, role: true } },
        payments: { select: { method: true, amount: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);
  res.json({ orders, total, page: p, limit: l, hasMore: (p - 1) * l + orders.length < total });
}));

salesRouter.get('/orders/:id', requireAuth, handle(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND');
  res.json(order);
}));

const refundSchema = z.object({
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().positive() })).min(1),
  method: settlingEnum.default('CASH'),
  reason: z.string().trim().max(200).nullish(),
  restock: z.boolean().default(true),
  requestId: requestIdSchema,
});

// Refund part or all of a sale. Unpaid credit on the sale is cancelled first;
// only the rest is handed back.
salesRouter.post('/orders/:id/refunds', requireAuth, handle(async (req, res) => {
  const input = refundSchema.parse(req.body);

  const already = async () => {
    const refund = await prisma.refund.findUnique({ where: { requestId: input.requestId! }, include: { items: true } });
    return refund && { refund, order: await prisma.order.findUnique({ where: { id: refund.orderId }, include: orderInclude }) };
  };
  if (input.requestId) {
    const existing = await already();
    if (existing) return res.status(200).json(existing);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock order: customer, then the sale, then its products. Two refunds of the same sale
    // then run one after the other, and the second sees what the first already returned.
    const owner = await tx.order.findUnique({ where: { id: req.params.id }, select: { customerId: true } });
    if (!owner) throw new ApiError(404, 'ORDER_NOT_FOUND');
    if (owner.customerId) await lockRows(tx, 'customer', [owner.customerId]);
    await lockRows(tx, 'order', [req.params.id]);
    const order = await tx.order.findUnique({ where: { id: req.params.id }, include: { items: { include: { product: true } } } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND');
    if (input.restock) await lockRows(tx, 'product', order.items.map((i) => i.productId));
    if (input.restock) {
      // Re-read the products now that they are locked: a sale may have changed their stock.
      const fresh = await tx.product.findMany({ where: { id: { in: order.items.map((i) => i.productId) } } });
      for (const item of order.items) item.product = fresh.find((p) => p.id === item.productId) ?? item.product;
    }

    const value = refundValue(order, order.items, input.items);
    if (value.error) throw new ApiError(400, value.error);
    if (value.amount <= 0) throw new ApiError(400, 'NOTHING_TO_REFUND');

    const { toCredit, paidOut } = splitRefund(value.amount, order.balanceDue);

    const refund = await tx.refund.create({
      data: {
        refundNo: await nextNumber(tx, 'refund'),
        orderId: order.id,
        amount: value.amount,
        toCredit,
        paidOut,
        method: input.method,
        reason: input.reason ?? null,
        restock: input.restock,
        userId: req.user!.id,
        requestId: input.requestId ?? null,
        items: { create: value.lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity, amount: l.amount })) },
      },
      include: { items: true },
    });

    for (const line of value.lines) {
      const item = order.items.find((i) => i.id === line.orderItemId)!;
      await tx.orderItem.update({
        where: { id: item.id },
        data: { refundedQuantity: roundQuantity(item.refundedQuantity + line.quantity, item.unit) },
      });
      if (input.restock) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: roundQuantity(item.product.stock + line.quantity, item.product.unit) },
        });
        item.product.stock = roundQuantity(item.product.stock + line.quantity, item.product.unit);
      }
    }

    const refundedAmount = roundMoney(order.refundedAmount + value.amount);
    const balanceDue = roundMoney(order.balanceDue - toCredit);
    await tx.order.update({
      where: { id: order.id },
      data: { refundedAmount, balanceDue, status: orderStatus({ totalAmount: order.totalAmount, refundedAmount, balanceDue }) },
    });

    if (toCredit > 0 && order.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: order.customerId } });
      if (customer) {
        await tx.customer.update({ where: { id: customer.id }, data: { balance: Math.max(0, roundMoney(customer.balance - toCredit)) } });
      }
    }

    return { refund, order: await tx.order.findUnique({ where: { id: order.id }, include: orderInclude }) };
  }).catch(async (error) => {
    if (input.requestId && isRequestIdClash(error)) return { replayed: await already() };
    throw error;
  });

  if ('replayed' in result) return res.status(200).json(result.replayed);
  res.status(201).json(result);
}));

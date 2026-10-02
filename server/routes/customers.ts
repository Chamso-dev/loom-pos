import { Router } from 'express';
import { z } from 'zod';
import { ApiError, handle, prisma, requireAuth } from '../context';
import {
  allocateRepayment,
  normalizeAlgerianPhone,
  orderStatus,
  roundMoney,
  SETTLING_METHOD_CODES,
} from '../../src/lib/domain';

export const customersRouter = Router();

const phoneField = z
  .string()
  .trim()
  .nullish()
  .transform((value, ctx) => {
    if (!value) return null;
    const phone = normalizeAlgerianPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' });
      return z.NEVER;
    }
    return phone;
  });

const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneField,
  address: z.string().trim().max(200).nullish(),
  creditLimit: z.number().min(0).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

const isPhoneIssue = (error: unknown) =>
  error instanceof z.ZodError && error.issues.some((i) => i.message === 'INVALID_PHONE');

async function assertPhoneFree(phone: string | null | undefined, exceptId?: string) {
  if (!phone) return;
  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing && existing.id !== exceptId) {
    throw new ApiError(409, 'PHONE_TAKEN', 'Another customer has this phone number', { name: existing.name });
  }
}

customersRouter.get('/customers', requireAuth, handle(async (req, res) => {
  const { search, owing, limit = '50' } = req.query;
  const where: any = {};
  if (search) {
    const s = String(search);
    where.OR = [{ name: { contains: s, mode: 'insensitive' } }, { phone: { contains: s.replace(/\s/g, '') } }];
  }
  if (owing === '1') where.balance = { gt: 0 };
  const [customers, totals] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ balance: 'desc' }, { name: 'asc' }],
      take: Math.min(200, parseInt(String(limit)) || 50),
    }),
    prisma.customer.aggregate({ _sum: { balance: true }, _count: { _all: true }, where: { balance: { gt: 0 } } }),
  ]);
  res.json({ customers, totalOwed: roundMoney(totals._sum.balance ?? 0), owingCount: totals._count._all });
}));

customersRouter.post('/customers', requireAuth, handle(async (req, res) => {
  try {
    const data = customerSchema.parse(req.body);
    await assertPhoneFree(data.phone);
    res.status(201).json(await prisma.customer.create({ data }));
  } catch (error) {
    if (isPhoneIssue(error)) throw new ApiError(400, 'INVALID_PHONE');
    throw error;
  }
}));

customersRouter.put('/customers/:id', requireAuth, handle(async (req, res) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    await assertPhoneFree(data.phone, req.params.id);
    res.json(await prisma.customer.update({ where: { id: req.params.id }, data }));
  } catch (error) {
    if (isPhoneIssue(error)) throw new ApiError(400, 'INVALID_PHONE');
    throw error;
  }
}));

// A customer's account: what they owe, unpaid sales, and repayment history.
customersRouter.get('/customers/:id', requireAuth, handle(async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND');
  const [orders, repayments] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { date: 'desc' },
      take: 50,
      select: { id: true, invoiceNo: true, date: true, totalAmount: true, amountPaid: true, balanceDue: true, status: true, refundedAmount: true },
    }),
    prisma.payment.findMany({ where: { customerId: customer.id, kind: 'REPAYMENT' }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  res.json({ customer, orders, repayments });
}));

const repaymentSchema = z.object({
  method: z.enum(SETTLING_METHOD_CODES as [string, ...string[]]),
  amount: z.number().positive(),
  reference: z.string().trim().max(80).nullish(),
});

// Record money a customer pays back. It settles their oldest unpaid sales first.
customersRouter.post('/customers/:id/payments', requireAuth, handle(async (req, res) => {
  const input = repaymentSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND');
    const amount = roundMoney(input.amount);
    if (amount - customer.balance > 0.004) {
      throw new ApiError(400, 'AMOUNT_EXCEEDS_BALANCE', 'Repayment is larger than the balance', { balance: customer.balance });
    }

    const unpaid = await tx.order.findMany({
      where: { customerId: customer.id, balanceDue: { gt: 0 } },
      orderBy: { date: 'asc' },
      select: { id: true, balanceDue: true, totalAmount: true, refundedAmount: true },
    });
    const { allocations } = allocateRepayment(amount, unpaid);
    for (const a of allocations) {
      const o = unpaid.find((u) => u.id === a.id)!;
      const balanceDue = roundMoney(o.balanceDue - a.amount);
      await tx.order.update({
        where: { id: o.id },
        data: { balanceDue, status: orderStatus({ totalAmount: o.totalAmount, refundedAmount: o.refundedAmount, balanceDue }) },
      });
    }

    const payment = await tx.payment.create({
      data: {
        kind: 'REPAYMENT',
        method: input.method,
        amount,
        reference: input.reference ?? null,
        customerId: customer.id,
        // A repayment that settles exactly one sale is linked to it for the receipt.
        orderId: allocations.length === 1 ? allocations[0].id : null,
        userId: req.user!.id,
      },
    });
    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: { balance: Math.max(0, roundMoney(customer.balance - amount)) },
    });
    return { payment, customer: updated, allocations };
  });
  res.status(201).json(result);
}));

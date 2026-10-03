import { Router } from 'express';
import { z } from 'zod';
import { dayKey, handle, monthKey, parseLocalDate, prisma, requireAdmin, startOfLocalDay } from '../context';
import { includedTax, rankCategories, roundMoney, roundQuantity, sumMoney } from '../../src/lib/domain';

export const reportsRouter = Router();

interface Bucket {
  period: string;
  orders: number;
  /** Line totals before discount. */
  gross: number;
  discounts: number;
  /** What customers owed for the sales (gross - discounts). */
  sales: number;
  refunds: number;
  /** sales - refunds */
  net: number;
  tax: number;
  cost: number;
  profit: number;
  /** Part of sales put on customer credit. */
  creditGiven: number;
  purchases: number;
}

const emptyBucket = (period: string): Bucket => ({
  period, orders: 0, gross: 0, discounts: 0, sales: 0, refunds: 0, net: 0, tax: 0, cost: 0, profit: 0, creditGiven: 0, purchases: 0,
});

const MONEY_KEYS = ['gross', 'discounts', 'sales', 'refunds', 'net', 'tax', 'cost', 'profit', 'creditGiven', 'purchases'] as const;

/**
 * Sales figures for [from, to). Refunds count on the day they were given, so a
 * day's net can be lower than its sales. Days and months follow the server's
 * local calendar.
 */
export async function computeReport(from: Date, to: Date, groupBy: 'day' | 'month') {
  const keyOf = groupBy === 'day' ? dayKey : monthKey;
  const range = { gte: from, lt: to };

  const [orders, refunds, payments, supplierPayments, purchases, owedByCustomers, owedToSuppliers] = await Promise.all([
    prisma.order.findMany({
      where: { date: range },
      select: { date: true, subtotal: true, discountAmount: true, totalAmount: true, taxAmount: true, amountPaid: true, items: { select: { quantity: true, costPrice: true } } },
    }),
    prisma.refund.findMany({
      where: { createdAt: range },
      select: { createdAt: true, amount: true, paidOut: true, method: true, restock: true, items: { select: { quantity: true, amount: true, orderItem: { select: { taxRate: true, costPrice: true } } } } },
    }),
    prisma.payment.findMany({ where: { createdAt: range }, select: { method: true, amount: true, kind: true } }),
    prisma.supplierPayment.findMany({ where: { createdAt: range }, select: { method: true, amount: true } }),
    prisma.purchase.findMany({ where: { date: range }, select: { date: true, totalAmount: true } }),
    prisma.customer.aggregate({ _sum: { balance: true } }),
    prisma.supplier.aggregate({ _sum: { balance: true } }),
  ]);

  const buckets = new Map<string, Bucket>();
  const bucket = (d: Date) => {
    const key = keyOf(d);
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = emptyBucket(key)));
    return b;
  };

  for (const o of orders) {
    const b = bucket(o.date);
    const cost = sumMoney(o.items.map((i) => i.quantity * i.costPrice));
    b.orders += 1;
    b.gross += o.subtotal;
    b.discounts += o.discountAmount;
    b.sales += o.totalAmount;
    b.tax += o.taxAmount;
    b.cost += cost;
    b.profit += o.totalAmount - o.taxAmount - cost;
    b.creditGiven += Math.max(0, o.totalAmount - o.amountPaid);
  }

  for (const r of refunds) {
    const b = bucket(r.createdAt);
    b.refunds += r.amount;
    for (const item of r.items) {
      const tax = includedTax(item.amount, item.orderItem.taxRate);
      // Restocked goods return their cost; goods thrown away do not.
      const costBack = r.restock ? item.quantity * item.orderItem.costPrice : 0;
      b.tax -= tax;
      b.cost -= costBack;
      b.profit -= item.amount - tax - costBack;
    }
  }

  for (const p of purchases) bucket(p.date).purchases += p.totalAmount;

  const rows = [...buckets.values()]
    .map((b) => {
      for (const k of MONEY_KEYS) b[k] = roundMoney(b[k]);
      b.net = roundMoney(b.sales - b.refunds);
      return b;
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  const totals = rows.reduce((acc, r) => {
    acc.orders += r.orders;
    for (const k of MONEY_KEYS) acc[k] = roundMoney(acc[k] + r[k]);
    return acc;
  }, emptyBucket('total'));

  // Money in by method: sales and credit repayments.
  const moneyIn = new Map<string, number>();
  for (const p of payments) moneyIn.set(p.method, roundMoney((moneyIn.get(p.method) ?? 0) + p.amount));
  const repayments = sumMoney(payments.filter((p) => p.kind === 'REPAYMENT').map((p) => p.amount));

  const refundsOut = new Map<string, number>();
  for (const r of refunds) if (r.paidOut > 0) refundsOut.set(r.method, roundMoney((refundsOut.get(r.method) ?? 0) + r.paidOut));

  const supplierOut = new Map<string, number>();
  for (const p of supplierPayments) supplierOut.set(p.method, roundMoney((supplierOut.get(p.method) ?? 0) + p.amount));

  const cashIn = moneyIn.get('CASH') ?? 0;
  const cashRefunded = refundsOut.get('CASH') ?? 0;
  const cashToSuppliers = supplierOut.get('CASH') ?? 0;

  const asList = (m: Map<string, number>) => [...m.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    groupBy,
    rows,
    totals,
    moneyIn: asList(moneyIn),
    refundsOut: asList(refundsOut),
    supplierPayments: asList(supplierOut),
    repayments,
    cash: {
      in: cashIn,
      refunded: cashRefunded,
      toSuppliers: cashToSuppliers,
      /** Cash the drawer should hold from this period's activity, before any opening float. */
      expected: roundMoney(cashIn - cashRefunded - cashToSuppliers),
    },
    outstanding: {
      customers: roundMoney(owedByCustomers._sum.balance ?? 0),
      suppliers: roundMoney(owedToSuppliers._sum.balance ?? 0),
    },
  };
}

const reportQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(['day', 'month']).default('day'),
});

// Daily or monthly report between two dates, both included.
reportsRouter.get('/reports', requireAdmin, handle(async (req, res) => {
  const q = reportQuery.parse(req.query);
  const from = parseLocalDate(q.from)!;
  const to = parseLocalDate(q.to)!;
  to.setDate(to.getDate() + 1);
  res.json(await computeReport(from, to, q.groupBy));
}));

// Today so far, for the dashboard and closing the day.
reportsRouter.get('/analytics/summary', requireAdmin, handle(async (_req, res) => {
  const report = await computeReport(startOfLocalDay(), new Date(Date.now() + 60_000), 'day');
  const t = report.totals;
  res.json({
    revenue: t.sales,
    net: t.net,
    tax: t.tax,
    orders: t.orders,
    discounts: t.discounts,
    refunds: t.refunds,
    profit: t.profit,
    creditGiven: t.creditGiven,
    repayments: report.repayments,
    payments: report.moneyIn,
    refundsOut: report.refundsOut,
    cash: report.cash,
    outstanding: report.outstanding,
  });
}));

// Last 7 days of sales, kept for older clients.
reportsRouter.get('/analytics/sales', requireAdmin, handle(async (_req, res) => {
  const report = await computeReport(startOfLocalDay(7), new Date(Date.now() + 60_000), 'day');
  res.json(report.rows.map((r) => ({ date: r.period, amount: r.sales })));
}));

// Today's pace against the past week, the week by day, and today's best sellers.
reportsRouter.get('/analytics/today', requireAdmin, handle(async (_req, res) => {
  const today = startOfLocalDay();
  const since = startOfLocalDay(7);

  const orders = await prisma.order.findMany({ where: { date: { gte: since } }, select: { date: true, totalAmount: true } });

  const todayKey = dayKey(today);
  const todayByHour: number[] = new Array(24).fill(0);
  const pastDays: Record<string, number[]> = {};
  const weekTotals: Record<string, { amount: number; orders: number }> = {};

  for (const o of orders) {
    const key = dayKey(o.date);
    const hour = o.date.getHours();
    if (key === todayKey) todayByHour[hour] += o.totalAmount;
    else (pastDays[key] ??= new Array(24).fill(0))[hour] += o.totalAmount;
    const w = (weekTotals[key] ??= { amount: 0, orders: 0 });
    w.amount += o.totalAmount;
    w.orders += 1;
  }

  // An average day only counts past days that had at least one sale.
  const pastDayList = Object.values(pastDays);
  const comparedDays = pastDayList.length;
  const averageByHour = todayByHour.map((_, h) => (comparedDays ? pastDayList.reduce((sum, day) => sum + day[h], 0) / comparedDays : 0));

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = startOfLocalDay(6 - i);
    const key = dayKey(d);
    return { date: key, amount: roundMoney(weekTotals[key]?.amount ?? 0), orders: weekTotals[key]?.orders ?? 0 };
  });

  const items = await prisma.orderItem.findMany({
    where: { order: { date: { gte: today } } },
    select: { productId: true, quantity: true, price: true, unit: true, product: { select: { name: true, size: true, color: true, barcode: true, category: true } } },
  });

  type TopItem = { productId: string; name: string; size: string | null; color: string | null; barcode: string; unit: string; quantity: number; revenue: number };
  const byProduct = new Map<string, TopItem>();
  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? {
      productId: item.productId,
      name: item.product.name,
      size: item.product.size,
      color: item.product.color,
      barcode: item.product.barcode,
      unit: item.unit,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity = roundQuantity(entry.quantity + item.quantity, item.unit);
    entry.revenue = roundMoney(entry.revenue + item.price * item.quantity);
    byProduct.set(item.productId, entry);
  }
  // Rank by takings: quantities in kg and pieces cannot be compared.
  const topItems = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const categories = rankCategories(items.map((i) => ({ category: i.product.category, revenue: i.price * i.quantity })));
  res.json({ todayByHour, averageByHour, comparedDays, week, topItems, categories, generatedAt: new Date().toISOString() });
}));

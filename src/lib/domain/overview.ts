/**
 * The dashboard's period overview: totals for a date range, their change against the
 * previous period, a time series of both, and the breakdowns (payment methods, categories,
 * products, hours). Pure functions: the server and the in-browser demo feed them the same
 * rows and get the same answer. Days and hours follow the local clock (Africa/Algiers on the
 * server).
 */
import { rankCategories } from './analytics'
import { roundMoney, sumMoney } from './money'
import { includedTax } from './tax'

export const RANGE_KEYS = ['today', 'yesterday', '7d', '30d', 'month'] as const
export type RangeKey = (typeof RANGE_KEYS)[number]
export const isRangeKey = (v: unknown): v is RangeKey => typeof v === 'string' && (RANGE_KEYS as readonly string[]).includes(v)

export interface ResolvedRange {
  key: RangeKey
  granularity: 'hour' | 'day'
  /** Current period [from, to). `to` is "now" for periods that are still running. */
  from: Date
  to: Date
  /** Start of the previous period, of the same length, right before this one. */
  previousFrom: Date
  /**
   * The previous period cut at the same elapsed time as the current one, for fair totals:
   * today until 14:30 is compared with yesterday until 14:30, not with all of yesterday.
   */
  compareTo: Date
  /** Number of buckets (hours or days) in the chart. */
  buckets: number
}

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())

export function resolveRange(key: RangeKey, now = new Date()): ResolvedRange {
  const today = startOfDay(now)
  const elapsed = (from: Date, to: Date, previousFrom: Date, cap?: Date) => {
    const cut = new Date(previousFrom.getTime() + (to.getTime() - from.getTime()))
    return cap && cut > cap ? cap : cut
  }
  switch (key) {
    case 'today': {
      const previousFrom = addDays(today, -1)
      return { key, granularity: 'hour', from: today, to: now, previousFrom, compareTo: elapsed(today, now, previousFrom), buckets: 24 }
    }
    case 'yesterday': {
      const from = addDays(today, -1)
      return { key, granularity: 'hour', from, to: today, previousFrom: addDays(from, -1), compareTo: from, buckets: 24 }
    }
    case '7d':
    case '30d': {
      const days = key === '7d' ? 7 : 30
      const from = addDays(today, -(days - 1))
      const previousFrom = addDays(from, -days)
      return { key, granularity: 'day', from, to: now, previousFrom, compareTo: elapsed(from, now, previousFrom), buckets: days }
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      const previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { key, granularity: 'day', from, to: now, previousFrom, compareTo: elapsed(from, now, previousFrom, from), buckets: now.getDate() }
    }
  }
}

/** Start of bucket i of a period that starts at `start`. */
export function bucketStart(range: Pick<ResolvedRange, 'granularity'>, start: Date, i: number) {
  return range.granularity === 'hour'
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours() + i)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
}

/** Which bucket a moment falls in, counted from `start`; may be out of range. */
export function bucketIndex(range: Pick<ResolvedRange, 'granularity'>, start: Date, at: Date) {
  if (range.granularity === 'hour') return Math.floor((at.getTime() - start.getTime()) / 3_600_000)
  return Math.round((startOfDay(at).getTime() - startOfDay(start).getTime()) / DAY)
}

// Rows the server (Prisma) and the demo both produce.
export interface OverviewOrder {
  date: Date
  subtotal: number
  discountAmount: number
  totalAmount: number
  taxAmount: number
  amountPaid: number
  items: Array<{ productId: string; name: string; category: string | null; unit: string; quantity: number; price: number; costPrice: number }>
}
export interface OverviewRefund {
  createdAt: Date
  amount: number
  restock: boolean
  items: Array<{ quantity: number; amount: number; taxRate: number; costPrice: number }>
}
export interface OverviewPayment {
  createdAt: Date
  method: string
  amount: number
  kind: string
}

export interface PeriodTotals {
  orders: number
  /** Line totals before discounts (tax included). */
  grossSales: number
  discounts: number
  /** Money returned for refunded items. */
  returns: number
  /** grossSales - discounts - returns. */
  netSales: number
  /** TVA inside net sales. */
  tax: number
  /** Cost of the goods sold, less goods put back on the shelf. */
  cost: number
  /** netSales - tax - cost. */
  profit: number
  averageSale: number
  creditGiven: number
  repayments: number
}

/** Totals for a set of rows. Same rules as the reports page. */
export function periodTotals(orders: OverviewOrder[], refunds: OverviewRefund[], payments: OverviewPayment[]): PeriodTotals {
  let grossSales = 0, discounts = 0, sales = 0, tax = 0, cost = 0, creditGiven = 0, returns = 0
  for (const o of orders) {
    grossSales += o.subtotal
    discounts += o.discountAmount
    sales += o.totalAmount
    tax += o.taxAmount
    cost += o.items.reduce((s, i) => s + i.quantity * i.costPrice, 0)
    creditGiven += Math.max(0, o.totalAmount - o.amountPaid)
  }
  for (const r of refunds) {
    returns += r.amount
    for (const item of r.items) {
      tax -= includedTax(item.amount, item.taxRate)
      // Goods put back on the shelf give their cost back; goods thrown away do not.
      if (r.restock) cost -= item.quantity * item.costPrice
    }
  }
  const netSales = roundMoney(sales - returns)
  const t = { tax: roundMoney(tax), cost: roundMoney(cost) }
  return {
    orders: orders.length,
    grossSales: roundMoney(grossSales),
    discounts: roundMoney(discounts),
    returns: roundMoney(returns),
    netSales,
    tax: t.tax,
    cost: t.cost,
    profit: roundMoney(netSales - t.tax - t.cost),
    averageSale: orders.length ? roundMoney(sales / orders.length) : 0,
    creditGiven: roundMoney(creditGiven),
    repayments: sumMoney(payments.filter((p) => p.kind === 'REPAYMENT').map((p) => p.amount)),
  }
}

/** Change from previous to current as a fraction (0.12 = +12 %), or null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || Math.abs(previous) < 0.005) return null
  return (current - previous) / Math.abs(previous)
}

export interface OverviewPoint {
  /** Start of the bucket in the current and the previous period (ISO). */
  at: string
  previousAt: string
  /** null for buckets still in the future. */
  sales: number | null
  orders: number | null
  averageSale: number | null
  profit: number | null
  previous: { sales: number; orders: number; averageSale: number | null; profit: number }
}

export function buildOverview(
  range: ResolvedRange,
  rows: { orders: OverviewOrder[]; refunds: OverviewRefund[]; payments: OverviewPayment[] },
  extra: { owedByCustomers: number } = { owedByCustomers: 0 }
) {
  const within = <T>(list: T[], at: (row: T) => Date, from: Date, to: Date) => list.filter((r) => at(r) >= from && at(r) < to)
  const pick = (from: Date, to: Date) => ({
    orders: within(rows.orders, (o) => o.date, from, to),
    refunds: within(rows.refunds, (r) => r.createdAt, from, to),
    payments: within(rows.payments, (p) => p.createdAt, from, to),
  })
  const current = pick(range.from, range.to)
  const compared = pick(range.previousFrom, range.compareTo)
  const totals = periodTotals(current.orders, current.refunds, current.payments)
  const previousTotals = periodTotals(compared.orders, compared.refunds, compared.payments)

  // Each row is placed in its bucket once, so the series costs one pass over the rows rather
  // than one pass per bucket. The previous period's buckets stop where this period starts.
  type Bucket = { orders: OverviewOrder[]; refunds: OverviewRefund[]; payments: OverviewPayment[] }
  const buckets = (): Bucket[] => Array.from({ length: range.buckets }, () => ({ orders: [], refunds: [], payments: [] }))
  const now = buckets()
  const before = buckets()
  const previousSeriesEnd = new Date(Math.min(bucketStart(range, range.previousFrom, range.buckets).getTime(), range.from.getTime()))
  const place = <T>(at: Date, row: T, add: (bucket: Bucket, row: T) => void) => {
    if (at >= range.from && at < range.to) {
      const i = bucketIndex(range, range.from, at)
      if (i >= 0 && i < range.buckets) add(now[i], row)
    } else if (at >= range.previousFrom && at < previousSeriesEnd) {
      const i = bucketIndex(range, range.previousFrom, at)
      if (i >= 0 && i < range.buckets) add(before[i], row)
    }
  }
  for (const o of rows.orders) place(o.date, o, (b, r) => b.orders.push(r))
  for (const r of rows.refunds) place(r.createdAt, r, (b, x) => b.refunds.push(x))
  for (const p of rows.payments) place(p.createdAt, p, (b, x) => b.payments.push(x))

  const series: OverviewPoint[] = []
  for (let i = 0; i < range.buckets; i++) {
    const start = bucketStart(range, range.from, i)
    const ct = periodTotals(now[i].orders, now[i].refunds, now[i].payments)
    const pt = periodTotals(before[i].orders, before[i].refunds, before[i].payments)
    const future = start >= range.to
    series.push({
      at: start.toISOString(),
      previousAt: bucketStart(range, range.previousFrom, i).toISOString(),
      sales: future ? null : ct.netSales,
      orders: future ? null : ct.orders,
      averageSale: future || !ct.orders ? null : ct.averageSale,
      profit: future ? null : ct.profit,
      previous: { sales: pt.netSales, orders: pt.orders, averageSale: pt.orders ? pt.averageSale : null, profit: pt.profit },
    })
  }

  // Money in by payment method (sales and credit repayments), largest first.
  const methods = new Map<string, number>()
  for (const p of current.payments) methods.set(p.method, (methods.get(p.method) ?? 0) + p.amount)

  // Products and categories by takings.
  const products = new Map<string, { productId: string; name: string; unit: string; quantity: number; revenue: number }>()
  const categoryLines: Array<{ category: string | null; revenue: number }> = []
  for (const o of current.orders) {
    for (const i of o.items) {
      const revenue = i.price * i.quantity
      const e = products.get(i.productId) ?? { productId: i.productId, name: i.name, unit: i.unit, quantity: 0, revenue: 0 }
      e.quantity += i.quantity
      e.revenue += revenue
      products.set(i.productId, e)
      categoryLines.push({ category: i.category, revenue })
    }
  }

  // Sales by hour of the day, this period and the previous one. For a single day the previous
  // day is shown whole, so the hours still ahead today have something to compare with; for longer
  // periods it is cut at the same elapsed time, so both cover the same number of days.
  const hours = Array.from({ length: 24 }, () => ({ current: 0, previous: 0 }))
  const previousEnd = range.granularity === 'hour' ? range.from : range.compareTo
  for (const o of current.orders) hours[o.date.getHours()].current += o.totalAmount
  for (const o of within(rows.orders, (r) => r.date, range.previousFrom, previousEnd)) hours[o.date.getHours()].previous += o.totalAmount

  const changeOf = (k: keyof PeriodTotals) => change(totals[k], previousTotals[k])
  return {
    range: range.key,
    granularity: range.granularity,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    previousFrom: range.previousFrom.toISOString(),
    compareTo: range.compareTo.toISOString(),
    totals,
    previous: previousTotals,
    change: {
      netSales: changeOf('netSales'),
      orders: changeOf('orders'),
      averageSale: changeOf('averageSale'),
      profit: changeOf('profit'),
      returns: changeOf('returns'),
      creditGiven: changeOf('creditGiven'),
    },
    series,
    methods: [...methods.entries()].map(([method, amount]) => ({ method, amount: roundMoney(amount) })).sort((a, b) => b.amount - a.amount),
    categories: rankCategories(categoryLines),
    topProducts: [...products.values()]
      .map((p) => ({ ...p, revenue: roundMoney(p.revenue), quantity: Math.round(p.quantity * 1000) / 1000 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    hours: hours.map((h) => ({ current: roundMoney(h.current), previous: roundMoney(h.previous) })),
    owedByCustomers: roundMoney(extra.owedByCustomers),
  }
}

export type Overview = ReturnType<typeof buildOverview>

import { describe, expect, it } from 'vitest'
import { buildOverview, change, periodTotals, resolveRange, type OverviewOrder } from '..'

const at = (d: string) => new Date(d) // local time, no Z
const order = (date: string, total: number, extra: Partial<OverviewOrder> = {}): OverviewOrder => ({
  date: at(date),
  subtotal: total,
  discountAmount: 0,
  totalAmount: total,
  taxAmount: 0,
  amountPaid: total,
  items: [{ productId: 'p', name: 'Lben', category: 'Crèmerie', unit: 'piece', quantity: 1, price: total, costPrice: total / 2 }],
  ...extra,
})

describe('resolveRange', () => {
  const now = at('2026-10-03T14:30:00')
  it('compares today so far with yesterday until the same time', () => {
    const r = resolveRange('today', now)
    expect([r.from, r.to, r.previousFrom, r.compareTo].map((d) => d.toString())).toEqual(
      [at('2026-10-03T00:00:00'), now, at('2026-10-02T00:00:00'), at('2026-10-02T14:30:00')].map((d) => d.toString())
    )
    expect(r.granularity).toBe('hour')
    expect(r.buckets).toBe(24)
  })
  it('compares yesterday with the whole day before', () => {
    const r = resolveRange('yesterday', now)
    expect(r.from.toString()).toBe(at('2026-10-02T00:00:00').toString())
    expect(r.to.toString()).toBe(at('2026-10-03T00:00:00').toString())
    expect(r.previousFrom.toString()).toBe(at('2026-10-01T00:00:00').toString())
    expect(r.compareTo.toString()).toBe(r.from.toString())
  })
  it('uses 7 and 30 day windows that include today', () => {
    const r = resolveRange('7d', now)
    expect(r.from.toString()).toBe(at('2026-09-27T00:00:00').toString())
    expect(r.previousFrom.toString()).toBe(at('2026-09-20T00:00:00').toString())
    expect(r.compareTo.toString()).toBe(at('2026-09-26T14:30:00').toString())
    expect(resolveRange('30d', now).buckets).toBe(30)
  })
  it('compares this month with the same days of last month, never past its end', () => {
    const r = resolveRange('month', now)
    expect(r.from.toString()).toBe(at('2026-10-01T00:00:00').toString())
    expect(r.previousFrom.toString()).toBe(at('2026-09-01T00:00:00').toString())
    expect(r.compareTo.toString()).toBe(at('2026-09-03T14:30:00').toString())
    expect(r.buckets).toBe(3)
    const endOfMarch = resolveRange('month', at('2027-03-31T12:00:00'))
    expect(endOfMarch.compareTo.toString()).toBe(at('2027-03-01T00:00:00').toString())
  })
})

describe('periodTotals', () => {
  it('follows gross sales → discounts → returns → net sales → TVA → cost → profit', () => {
    const t = periodTotals(
      [order('2026-10-03T10:00:00', 1000, { subtotal: 1100, discountAmount: 100, taxAmount: 159.66, amountPaid: 600 })],
      [{ createdAt: at('2026-10-03T11:00:00'), amount: 119, restock: true, items: [{ quantity: 1, amount: 119, taxRate: 19, costPrice: 50 }] }],
      [{ createdAt: at('2026-10-03T12:00:00'), method: 'CASH', amount: 200, kind: 'REPAYMENT' }]
    )
    expect(t.grossSales).toBe(1100)
    expect(t.discounts).toBe(100)
    expect(t.returns).toBe(119)
    expect(t.netSales).toBe(881)
    expect(t.tax).toBe(140.66) // 159.66 - 19
    expect(t.cost).toBe(450) // 500 sold - 50 put back
    expect(t.profit).toBe(290.34) // 881 - 140.66 - 450
    expect(t.creditGiven).toBe(400)
    expect(t.repayments).toBe(200)
    expect(t.averageSale).toBe(1000)
  })
})

describe('change', () => {
  it('is a fraction, or null when there is nothing to compare with', () => {
    expect(change(120, 100)).toBeCloseTo(0.2)
    expect(change(80, 100)).toBeCloseTo(-0.2)
    expect(change(50, 0)).toBeNull()
    expect(change(-50, -100)).toBeCloseTo(0.5)
  })
})

describe('buildOverview', () => {
  const now = at('2026-10-03T14:30:00')
  const r = resolveRange('today', now)
  const rows = {
    orders: [
      order('2026-10-02T09:15:00', 300), // yesterday, before 14:30
      order('2026-10-02T18:00:00', 700), // yesterday, after 14:30: in the chart, not in the totals
      order('2026-10-03T09:40:00', 200),
      order('2026-10-03T14:10:00', 400),
    ],
    refunds: [],
    payments: [{ createdAt: at('2026-10-03T09:40:00'), method: 'CASH', amount: 200, kind: 'SALE' }, { createdAt: at('2026-10-03T14:10:00'), method: 'CIB', amount: 400, kind: 'SALE' }],
  }
  const o = buildOverview(r, rows, { owedByCustomers: 1500 })
  it('compares like for like', () => {
    expect(o.totals.netSales).toBe(600)
    expect(o.previous.netSales).toBe(300)
    expect(o.change.netSales).toBeCloseTo(1)
  })
  it('puts sales in hourly buckets, with the previous day in full and future hours empty', () => {
    expect(o.series[9].sales).toBe(200)
    expect(o.series[14].sales).toBe(400)
    expect(o.series[9].previous.sales).toBe(300)
    expect(o.series[18].previous.sales).toBe(700)
    expect(o.series[15].sales).toBeNull()
    expect(o.series[10].averageSale).toBeNull()
  })
  it('ranks payment methods, products and hours', () => {
    expect(o.methods).toEqual([{ method: 'CIB', amount: 400 }, { method: 'CASH', amount: 200 }])
    expect(o.topProducts[0]).toMatchObject({ name: 'Lben', quantity: 2, revenue: 600 })
    expect(o.hours[14]).toEqual({ current: 400, previous: 0 })
    expect(o.hours[18]).toEqual({ current: 0, previous: 700 })
    expect(o.owedByCustomers).toBe(1500)
  })
})

describe('buildOverview over a month', () => {
  it('compares the hours of day with the same days of last month only', () => {
    const range = resolveRange('month', at('2026-10-03T14:30:00'))
    const o = buildOverview(range, {
      orders: [order('2026-10-02T10:15:00', 100), order('2026-09-02T10:20:00', 80), order('2026-09-20T10:05:00', 900)],
      refunds: [],
      payments: [],
    })
    expect(o.hours[10]).toEqual({ current: 100, previous: 80 })
    expect(o.previous.netSales).toBe(80)
  })
})

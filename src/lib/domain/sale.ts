/**
 * Sale arithmetic shared by the till and the API server. The server recomputes
 * every sale with these functions, so the browser can never set its own prices.
 */
import { roundMoney, sameMoney, sumMoney } from './money'
import { includedTax } from './tax'
import { roundQuantity } from './units'
import { paymentMethod, type PaymentMethodCode } from './payments'

export interface SaleLineInput {
  /** Tax-included price for one unit (one piece, one kg, one litre…). */
  unitPrice: number
  quantity: number
  unit: string
  taxRate: number
  /** What the shop paid for one unit, for profit. */
  costPrice?: number
}

export interface Discount {
  type: 'amount' | 'percent'
  value: number
}

export interface PricedLine extends SaleLineInput {
  lineTotal: number
}

export interface TaxLine {
  rate: number
  /** Tax-included sales at this rate, after discount. */
  gross: number
  /** TVA contained in gross. */
  tax: number
}

export interface SaleTotals {
  lines: PricedLine[]
  /** Sum of line totals before discount. */
  subtotal: number
  discountAmount: number
  /** What the customer owes for the sale. */
  total: number
  taxLines: TaxLine[]
  taxAmount: number
  costTotal: number
  /** Total minus TVA minus cost. */
  profit: number
}

/** Prices a basket: 1.5 kg × 250 DA/kg = 375 DA, then the discount, then the TVA inside it. */
export function priceSale(inputs: SaleLineInput[], discount?: Discount | null): SaleTotals {
  const lines = inputs.map((line) => {
    const quantity = roundQuantity(line.quantity, line.unit)
    return { ...line, quantity, lineTotal: roundMoney(quantity * line.unitPrice) }
  })
  const subtotal = sumMoney(lines.map((l) => l.lineTotal))

  let discountAmount = 0
  if (discount && discount.value > 0) {
    const raw = discount.type === 'percent' ? (subtotal * Math.min(discount.value, 100)) / 100 : discount.value
    discountAmount = Math.min(roundMoney(raw), subtotal)
  }
  const total = roundMoney(subtotal - discountAmount)
  const keep = subtotal > 0 ? total / subtotal : 0

  // The discount reduces each tax group in proportion to its share of the basket.
  const byRate = new Map<number, number>()
  for (const l of lines) byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + l.lineTotal)
  const taxLines = [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, amount]) => {
      const gross = roundMoney(amount * keep)
      return { rate, gross, tax: includedTax(gross, rate) }
    })
  const taxAmount = sumMoney(taxLines.map((t) => t.tax))
  const costTotal = sumMoney(lines.map((l) => (l.costPrice ?? 0) * l.quantity))

  return {
    lines,
    subtotal,
    discountAmount,
    total,
    taxLines,
    taxAmount,
    costTotal,
    profit: roundMoney(total - taxAmount - costTotal),
  }
}

export interface PaymentInput {
  method: PaymentMethodCode
  /** For cash: the money handed over. For other methods: the amount charged. */
  amount: number
  reference?: string | null
}

export interface AppliedPayment {
  method: PaymentMethodCode
  /** Part of the sale this payment settles. For cash this excludes change. */
  amount: number
  /** Cash handed over, when it differs from amount. */
  tendered?: number
  reference?: string | null
}

export type SettlementError = 'OVERPAID_NON_CASH' | 'UNPAID_REMAINDER' | 'CREDIT_NEEDS_CUSTOMER' | 'INVALID_AMOUNT'

export interface Settlement {
  /** Payments as recorded on the sale, credit included. */
  applied: AppliedPayment[]
  /** Money collected now, change excluded. */
  amountPaid: number
  /** Cash handed back. */
  change: number
  /** Put on the customer's account (À crédit). */
  balanceDue: number
  /** Still to collect before the sale can close. */
  remaining: number
  errors: SettlementError[]
}

/**
 * Splits a sale across payment methods. Cards, BaridiMob and transfers are charged
 * exactly. Cash covers what is left and may be over-tendered, which gives change.
 * Credit lines put an amount on the customer's account.
 */
export function settlePayments(total: number, payments: PaymentInput[], hasCustomer: boolean): Settlement {
  const errors: SettlementError[] = []
  if (payments.some((p) => !Number.isFinite(p.amount) || p.amount < 0)) errors.push('INVALID_AMOUNT')

  const valid = payments.filter((p) => Number.isFinite(p.amount) && p.amount > 0)
  const cash = valid.filter((p) => paymentMethod(p.method)?.givesChange)
  const credit = valid.filter((p) => paymentMethod(p.method)?.onAccount)
  const exact = valid.filter((p) => !paymentMethod(p.method)?.givesChange && !paymentMethod(p.method)?.onAccount)

  const exactTotal = sumMoney(exact.map((p) => p.amount))
  const creditTotal = sumMoney(credit.map((p) => p.amount))
  const cashTendered = sumMoney(cash.map((p) => p.amount))

  if (roundMoney(exactTotal + creditTotal) - total > 0.004) errors.push('OVERPAID_NON_CASH')

  const cashNeeded = Math.max(0, roundMoney(total - exactTotal - creditTotal))
  const cashApplied = Math.min(cashTendered, cashNeeded)
  const change = roundMoney(cashTendered - cashApplied)
  const remaining = roundMoney(cashNeeded - cashApplied)

  if (remaining > 0) errors.push('UNPAID_REMAINDER')
  if (creditTotal > 0 && !hasCustomer) errors.push('CREDIT_NEEDS_CUSTOMER')

  const applied: AppliedPayment[] = [
    ...exact.map((p) => ({ method: p.method, amount: roundMoney(p.amount), reference: p.reference ?? null })),
  ]
  if (cash.length) {
    // Several cash lines are merged: the drawer only cares about the total handed over.
    applied.push({ method: 'CASH', amount: roundMoney(cashApplied), tendered: cashTendered })
  }
  for (const p of credit) applied.push({ method: p.method, amount: roundMoney(p.amount) })

  return {
    applied: applied.filter((p) => p.amount > 0 || p.method === 'CASH'),
    amountPaid: roundMoney(exactTotal + cashApplied),
    change,
    balanceDue: creditTotal,
    remaining,
    errors,
  }
}

/** True when the settlement can close the sale. */
export const isSettled = (s: Settlement) => s.errors.length === 0

export interface RefundableLine {
  id: string
  price: number
  quantity: number
  refundedQuantity: number
  unit: string
}

/**
 * Value of returning part of a sale. The order discount is shared across lines,
 * so a returned item gives back what the customer actually paid for it.
 */
export function refundValue(
  order: { subtotal: number; discountAmount: number; totalAmount: number; refundedAmount: number },
  lines: RefundableLine[],
  request: Array<{ orderItemId: string; quantity: number }>
): { amount: number; lines: Array<{ orderItemId: string; quantity: number; amount: number }>; error?: 'NOTHING_TO_REFUND' | 'REFUND_EXCEEDS_SOLD' } {
  const keep = order.subtotal > 0 ? (order.subtotal - order.discountAmount) / order.subtotal : 1
  const out: Array<{ orderItemId: string; quantity: number; amount: number }> = []
  for (const r of request) {
    const line = lines.find((l) => l.id === r.orderItemId)
    if (!line) continue
    const quantity = roundQuantity(r.quantity, line.unit)
    if (quantity <= 0) continue
    const left = roundQuantity(line.quantity - line.refundedQuantity, line.unit)
    if (quantity - left > 1e-9) return { amount: 0, lines: [], error: 'REFUND_EXCEEDS_SOLD' }
    out.push({ orderItemId: line.id, quantity, amount: roundMoney(quantity * line.price * keep) })
  }
  if (!out.length) return { amount: 0, lines: [], error: 'NOTHING_TO_REFUND' }
  const amount = Math.min(sumMoney(out.map((l) => l.amount)), roundMoney(order.totalAmount - order.refundedAmount))
  return { amount, lines: out }
}

/** Splits a refund between cancelling unpaid credit on the sale and money handed back. */
export function splitRefund(refundAmount: number, orderBalanceDue: number) {
  const toCredit = Math.min(roundMoney(refundAmount), Math.max(0, roundMoney(orderBalanceDue)))
  return { toCredit, paidOut: roundMoney(refundAmount - toCredit) }
}

/** Applies a repayment to a customer's unpaid sales, oldest first. */
export function allocateRepayment(amount: number, unpaid: Array<{ id: string; balanceDue: number }>) {
  let left = roundMoney(amount)
  const allocations: Array<{ id: string; amount: number }> = []
  for (const o of unpaid) {
    if (left <= 0) break
    const take = Math.min(left, roundMoney(o.balanceDue))
    if (take > 0) {
      allocations.push({ id: o.id, amount: take })
      left = roundMoney(left - take)
    }
  }
  return { allocations, unallocated: left }
}

export { sameMoney }

export type OrderStatus = 'PAID' | 'CREDIT' | 'PARTIALLY_REFUNDED' | 'REFUNDED'

/** Fully refunded wins, then money still owed, then a partial refund. */
export function orderStatus(o: { totalAmount: number; refundedAmount: number; balanceDue: number }): OrderStatus {
  if (o.totalAmount > 0 && o.refundedAmount >= o.totalAmount - 0.004) return 'REFUNDED'
  if (o.balanceDue > 0.004) return 'CREDIT'
  if (o.refundedAmount > 0.004) return 'PARTIALLY_REFUNDED'
  return 'PAID'
}

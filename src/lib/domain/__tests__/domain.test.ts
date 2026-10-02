import { describe, expect, it } from 'vitest'
import {
  allocateRepayment,
  formatMoney,
  formatMoneyShort,
  includedTax,
  parseDecimal,
  priceSale,
  refundValue,
  roundMoney,
  roundQuantity,
  settlePayments,
  splitRefund,
} from '..'

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, '').replace(/[\u202F\u00A0]/g, ' ')

describe('money', () => {
  it('rounds to centimes without float drift', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(-2.675)).toBe(-2.68)
  })

  it('formats dinars the Algerian way in both languages', () => {
    expect(strip(formatMoney(1250, 'en'))).toBe('1 250 DA')
    expect(strip(formatMoney(1250.5, 'en'))).toBe('1 250,50 DA')
    expect(strip(formatMoney(375, 'ar'))).toBe('375 دج')
    expect(strip(formatMoney(1250, 'en', { decimals: 'fixed' }))).toBe('1 250,00 DA')
    expect(formatMoney(1250, 'ar')).toContain('⁦')
    expect(strip(formatMoneyShort(61400, 'en'))).toBe('61,4 k DA')
    expect(strip(formatMoneyShort(2_500_000, 'ar'))).toBe('2,5 مليون دج')
  })

  it('reads amounts typed with commas, dots, spaces or Arabic digits', () => {
    expect(parseDecimal('1,5')).toBe(1.5)
    expect(parseDecimal('1.5')).toBe(1.5)
    expect(parseDecimal('1 250,50')).toBe(1250.5)
    expect(parseDecimal('1.250,50')).toBe(1250.5)
    expect(parseDecimal('١٫٥')).toBe(1.5)
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('')).toBeNaN()
  })
})

describe('units', () => {
  it('keeps decimals for weight and volume only', () => {
    expect(roundQuantity(1.2345, 'kg')).toBe(1.235)
    expect(roundQuantity(2.6, 'piece')).toBe(3)
    expect(roundQuantity(0.5, 'l')).toBe(0.5)
  })
})

describe('tax', () => {
  it('finds the TVA inside a tax-included price', () => {
    expect(includedTax(119, 19)).toBe(19)
    expect(includedTax(109, 9)).toBe(9)
    expect(includedTax(500, 0)).toBe(0)
  })
})

describe('priceSale', () => {
  it('prices weighed goods: 1.5 kg × 250 DA/kg = 375 DA', () => {
    const t = priceSale([{ unitPrice: 250, quantity: 1.5, unit: 'kg', taxRate: 0 }])
    expect(t.total).toBe(375)
    expect(t.taxAmount).toBe(0)
  })

  it('applies a discount and shares it across tax rates', () => {
    const t = priceSale(
      [
        { unitPrice: 119, quantity: 2, unit: 'piece', taxRate: 19, costPrice: 70 },
        { unitPrice: 100, quantity: 1, unit: 'piece', taxRate: 0, costPrice: 80 },
      ],
      { type: 'percent', value: 10 }
    )
    expect(t.subtotal).toBe(338)
    expect(t.discountAmount).toBe(33.8)
    expect(t.total).toBe(304.2)
    // 238 × 0.9 = 214.2 at 19% contains 34.2
    expect(t.taxLines).toEqual([
      { rate: 0, gross: 90, tax: 0 },
      { rate: 19, gross: 214.2, tax: 34.2 },
    ])
    expect(t.costTotal).toBe(220)
    expect(t.profit).toBe(roundMoney(304.2 - 34.2 - 220))
  })

  it('never discounts below zero', () => {
    const t = priceSale([{ unitPrice: 50, quantity: 1, unit: 'piece', taxRate: 0 }], { type: 'amount', value: 80 })
    expect(t.total).toBe(0)
  })
})

describe('settlePayments', () => {
  it('gives change on cash', () => {
    const s = settlePayments(375, [{ method: 'CASH', amount: 500 }], false)
    expect(s.change).toBe(125)
    expect(s.amountPaid).toBe(375)
    expect(s.errors).toEqual([])
    expect(s.applied).toEqual([{ method: 'CASH', amount: 375, tendered: 500 }])
  })

  it('splits CIB and cash, with change only from cash', () => {
    const s = settlePayments(1000, [
      { method: 'CIB', amount: 600, reference: 'T-1' },
      { method: 'CASH', amount: 500 },
    ], false)
    expect(s.change).toBe(100)
    expect(s.amountPaid).toBe(1000)
    expect(s.applied[0]).toEqual({ method: 'CIB', amount: 600, reference: 'T-1' })
  })

  it('refuses card payments above the total', () => {
    const s = settlePayments(1000, [{ method: 'EDAHABIA', amount: 1200 }], false)
    expect(s.errors).toContain('OVERPAID_NON_CASH')
  })

  it('leaves a remainder until it is paid or put on credit', () => {
    const short = settlePayments(1000, [{ method: 'CASH', amount: 400 }], true)
    expect(short.remaining).toBe(600)
    expect(short.errors).toContain('UNPAID_REMAINDER')

    const onCredit = settlePayments(1000, [{ method: 'CASH', amount: 400 }, { method: 'CREDIT', amount: 600 }], true)
    expect(onCredit.errors).toEqual([])
    expect(onCredit.balanceDue).toBe(600)
    expect(onCredit.amountPaid).toBe(400)
  })

  it('requires a customer for credit', () => {
    const s = settlePayments(500, [{ method: 'CREDIT', amount: 500 }], false)
    expect(s.errors).toContain('CREDIT_NEEDS_CUSTOMER')
  })
})

describe('refunds and repayments', () => {
  const order = { subtotal: 1000, discountAmount: 100, totalAmount: 900, refundedAmount: 0 }
  const lines = [{ id: 'a', price: 250, quantity: 2, refundedQuantity: 0, unit: 'kg' }]

  it('refunds what the customer paid after the discount', () => {
    const r = refundValue(order, lines, [{ orderItemId: 'a', quantity: 1.5 }])
    expect(r.amount).toBe(337.5)
  })

  it('refuses to refund more than was sold', () => {
    const r = refundValue(order, lines, [{ orderItemId: 'a', quantity: 3 }])
    expect(r.error).toBe('REFUND_EXCEEDS_SOLD')
  })

  it('cancels unpaid credit before handing money back', () => {
    expect(splitRefund(500, 300)).toEqual({ toCredit: 300, paidOut: 200 })
    expect(splitRefund(200, 0)).toEqual({ toCredit: 0, paidOut: 200 })
  })

  it('applies repayments to the oldest unpaid sales first', () => {
    const r = allocateRepayment(700, [{ id: 'old', balanceDue: 500 }, { id: 'new', balanceDue: 400 }])
    expect(r.allocations).toEqual([{ id: 'old', amount: 500 }, { id: 'new', amount: 200 }])
    expect(r.unallocated).toBe(0)
  })
})

import { formatAlgerianPhone, normalizeAlgerianPhone, orderStatus } from '..'

describe('phones', () => {
  it('normalizes Algerian mobiles and landlines', () => {
    expect(normalizeAlgerianPhone('0555 12 34 56')).toBe('0555123456')
    expect(normalizeAlgerianPhone('+213 555 12 34 56')).toBe('0555123456')
    expect(normalizeAlgerianPhone('00213661234567')).toBe('0661234567')
    expect(normalizeAlgerianPhone('021 23 45 67')).toBe('021234567')
    expect(normalizeAlgerianPhone('+91 98765 43210')).toBeNull()
    expect(normalizeAlgerianPhone('0812345678')).toBeNull()
  })
  it('formats for display', () => {
    expect(formatAlgerianPhone('0555123456')).toBe('0555 12 34 56')
    expect(formatAlgerianPhone('021234567')).toBe('021 23 45 67')
  })
})

describe('orderStatus', () => {
  it('ranks refunded, then credit, then partial refund', () => {
    expect(orderStatus({ totalAmount: 100, refundedAmount: 100, balanceDue: 0 })).toBe('REFUNDED')
    expect(orderStatus({ totalAmount: 100, refundedAmount: 20, balanceDue: 30 })).toBe('CREDIT')
    expect(orderStatus({ totalAmount: 100, refundedAmount: 20, balanceDue: 0 })).toBe('PARTIALLY_REFUNDED')
    expect(orderStatus({ totalAmount: 100, refundedAmount: 0, balanceDue: 0 })).toBe('PAID')
  })
})

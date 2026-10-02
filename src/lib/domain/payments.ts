/**
 * Payment methods used in Algerian shops. To add a method, add one entry here and
 * its labels under payments.methods in both i18n dictionaries. Nothing else changes.
 */

export type PaymentKind = 'cash' | 'card' | 'mobile' | 'transfer' | 'credit'

export interface PaymentMethodInfo {
  code: string
  kind: PaymentKind
  /** Cash can be over-tendered, and the difference is handed back as change. */
  givesChange: boolean
  /** Shows a field for a transaction or transfer reference. */
  takesReference: boolean
  /** The amount is not collected now. It is added to the customer's credit balance. */
  onAccount: boolean
}

export const PAYMENT_METHODS = [
  { code: 'CASH', kind: 'cash', givesChange: true, takesReference: false, onAccount: false },
  { code: 'CIB', kind: 'card', givesChange: false, takesReference: true, onAccount: false },
  { code: 'EDAHABIA', kind: 'card', givesChange: false, takesReference: true, onAccount: false },
  { code: 'BARIDIMOB', kind: 'mobile', givesChange: false, takesReference: true, onAccount: false },
  { code: 'TRANSFER', kind: 'transfer', givesChange: false, takesReference: true, onAccount: false },
  { code: 'CREDIT', kind: 'credit', givesChange: false, takesReference: false, onAccount: true },
] as const satisfies readonly PaymentMethodInfo[]

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]['code']

export const PAYMENT_METHOD_CODES = PAYMENT_METHODS.map((m) => m.code) as PaymentMethodCode[]

/** Methods that move money now. Used for credit repayments, supplier payments and refunds. */
export const SETTLING_METHOD_CODES = PAYMENT_METHODS.filter((m) => !m.onAccount).map(
  (m) => m.code
) as Exclude<PaymentMethodCode, 'CREDIT'>[]

export const isPaymentMethod = (value: unknown): value is PaymentMethodCode =>
  typeof value === 'string' && (PAYMENT_METHOD_CODES as string[]).includes(value)

export const paymentMethod = (code: string): PaymentMethodInfo | undefined =>
  PAYMENT_METHODS.find((m) => m.code === code)

/** Codes saved by the earlier Indian version of LoomPOS, mapped when old data is read. */
export const LEGACY_METHODS: Record<string, PaymentMethodCode> = { CARD: 'CIB', UPI: 'BARIDIMOB' }

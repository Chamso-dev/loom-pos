import { Wallet, Smartphone, CreditCard, Landmark, type LucideIcon } from 'lucide-react'

export interface PaymentMethod {
  code: string
  label: string
  icon: LucideIcon
}

/** Algerian retail payment methods. */
export const PAYMENT_METHODS: PaymentMethod[] = [
  { code: 'CASH', label: 'Cash', icon: Wallet },
  { code: 'BARIDIMOB', label: 'BaridiMob', icon: Smartphone },
  { code: 'CIB', label: 'CIB', icon: CreditCard },
  { code: 'EDAHABIA', label: 'Edahabia', icon: CreditCard },
  { code: 'TRANSFER', label: 'Bank Transfer', icon: Landmark },
]

export function paymentLabel(code: string): string {
  return PAYMENT_METHODS.find((m) => m.code === code)?.label || code
}

export function paymentIcon(code: string): LucideIcon {
  return PAYMENT_METHODS.find((m) => m.code === code)?.icon || Wallet
}

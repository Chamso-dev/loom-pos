import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a monetary amount in Algerian Dinar (DA).
 * Uses grouped thousands and 2 decimals, with an explicit "DA" suffix so the
 * symbol is unambiguous across locales and on thermal printers.
 */
export function formatCurrency(amount: number) {
  const n = (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${n} DA`
}

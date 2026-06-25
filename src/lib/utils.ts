import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Canonical retail display name: base product name with its size/weight appended
 * inline, e.g. ("Pepsi", "1L") -> "Pepsi 1L". This is the single source of truth
 * used in the cart, inventory, search results and receipts.
 *
 * Rules:
 * - One space separator, no parentheses/brackets/dashes.
 * - If size is missing/blank, the name is returned unchanged (never guess).
 * - De-duplicates: if the name already ends with the size (ignoring case and
 *   surrounding spaces), it is not appended again ("Pepsi 1L" stays "Pepsi 1L").
 */
export function productDisplayName(name?: string | null, size?: string | null): string {
  const base = (name ?? '').trim()
  const sz = (size ?? '').trim()
  if (!sz) return base
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  // Already present at the end of the name → don't append twice.
  if (norm(base).endsWith(norm(sz))) return base
  return `${base} ${sz}`
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

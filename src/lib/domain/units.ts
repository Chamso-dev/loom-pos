/**
 * Units a product is sold in. Weight and volume units accept decimal quantities
 * (1,5 kg); counted units stay whole.
 */

export const UNIT_CODES = ['piece', 'kg', 'g', 'l', 'ml', 'box'] as const
export type UnitCode = (typeof UNIT_CODES)[number]

interface UnitRule {
  /** Decimals allowed in a quantity. */
  decimals: number
  /** Default step for + and − buttons. */
  step: number
  /** Stock at or below this level counts as running low. */
  lowStockAt: number
}

export const UNITS: Record<UnitCode, UnitRule> = {
  piece: { decimals: 0, step: 1, lowStockAt: 10 },
  kg: { decimals: 3, step: 0.25, lowStockAt: 5 },
  g: { decimals: 0, step: 50, lowStockAt: 1000 },
  l: { decimals: 3, step: 0.25, lowStockAt: 5 },
  ml: { decimals: 0, step: 50, lowStockAt: 1000 },
  box: { decimals: 0, step: 1, lowStockAt: 3 },
}

export const isUnitCode = (value: unknown): value is UnitCode =>
  typeof value === 'string' && (UNIT_CODES as readonly string[]).includes(value)

export const unitRule = (unit: string | null | undefined): UnitRule =>
  UNITS[isUnitCode(unit) ? unit : 'piece']

export const allowsDecimal = (unit: string | null | undefined) => unitRule(unit).decimals > 0

/** Rounds a quantity to what the unit allows: 1.2345 kg → 1.235, 2.6 pieces → 3. */
export function roundQuantity(quantity: number, unit: string | null | undefined): number {
  if (!Number.isFinite(quantity)) return 0
  const factor = 10 ** unitRule(unit).decimals
  return Math.round(quantity * factor + (quantity >= 0 ? 1e-9 : -1e-9)) / factor
}

/** True when the quantity is positive and has no more decimals than the unit allows. */
export function isValidQuantity(quantity: number, unit: string | null | undefined): boolean {
  return Number.isFinite(quantity) && quantity > 0 && Math.abs(roundQuantity(quantity, unit) - quantity) < 1e-9
}

/**
 * Algerian TVA. Shelf prices in Algerian retail are TTC (tax included), so the tax
 * is the part already inside the price rather than an amount added at the till.
 * 19% is the standard rate, 9% the reduced rate, 0% covers exempt goods and
 * shops taxed under the IFU flat regime.
 */
import { roundMoney } from './money'

export const TAX_RATES = [0, 9, 19] as const

/** Tax contained in a tax-included amount: 119 DA at 19% contains 19 DA. */
export function includedTax(grossAmount: number, ratePercent: number): number {
  if (!ratePercent) return 0
  return roundMoney((grossAmount * ratePercent) / (100 + ratePercent))
}

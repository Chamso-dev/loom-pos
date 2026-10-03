/**
 * Money in Algerian dinars (DZD).
 * Amounts are stored as numbers of dinars with at most 2 decimals (centimes).
 * Shared by the browser and the API server, so it must stay free of browser or React imports.
 */

export type Lang = 'ar' | 'en'

export const CURRENCY = {
  code: 'DZD',
  /** Short symbol shown after amounts, per language. */
  symbol: { en: 'DA', ar: 'دج' } as Record<Lang, string>,
  decimals: 2,
} as const

/** Rounds to centimes, half away from zero, without binary drift (1.005 → 1.01). */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  const sign = amount < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(amount) * 100 + 1e-7)) / 100
}

/** Adds amounts and rounds the result to centimes. */
export const sumMoney = (values: number[]) => roundMoney(values.reduce((a, b) => a + b, 0))

/** True when two amounts are equal to the centime. */
export const sameMoney = (a: number, b: number) => Math.abs(roundMoney(a) - roundMoney(b)) < 0.005

const numberFormats = new Map<string, Intl.NumberFormat>()
function numberFormat(min: number, max: number) {
  const key = `${min}:${max}`
  let f = numberFormats.get(key)
  if (!f) {
    // Algerian convention: thin space between thousands, comma before centimes (1 250,50).
    f = new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: min, maximumFractionDigits: max })
    numberFormats.set(key, f)
  }
  return f
}

/**
 * Intl separates thousands with a narrow no-break space, which is hard to see at
 * receipt sizes. A regular no-break space reads clearly and still never wraps.
 */
const widenSpaces = (text: string) => text.replace(/\u202F/g, '\u00A0')

/** Formats a plain number the Algerian way, e.g. 1 250,5. */
export function formatNumber(value: number, maxDecimals = 3, minDecimals = 0): string {
  return widenSpaces(numberFormat(minDecimals, maxDecimals).format(value))
}

/**
 * In Arabic text the number sits inside a left-to-right isolate so digits, the
 * thousands space and a minus sign keep their order in a right-to-left line.
 */
const isolateLtr = (text: string) => `⁦${text}⁩`

export interface MoneyFormatOptions {
  /** 'auto' hides ,00 on whole amounts. 'fixed' always shows centimes, as on receipts and reports. */
  decimals?: 'auto' | 'fixed'
  /** Leave out the DA / دج symbol, for table columns that already say the currency. */
  symbol?: boolean
}

/** 1250 → "1 250 DA" in English, "1 250 دج" in Arabic. */
export function formatMoney(amount: number, lang: Lang, options: MoneyFormatOptions = {}): string {
  const { decimals = 'auto', symbol = true } = options
  const rounded = roundMoney(amount)
  const fixed = decimals === 'fixed' || !Number.isInteger(rounded)
  const number = widenSpaces(numberFormat(fixed ? 2 : 0, fixed ? 2 : 0).format(rounded))
  const body = lang === 'ar' ? isolateLtr(number) : number
  return symbol ? `${body} ${CURRENCY.symbol[lang]}` : body
}

/** Short form for tight spaces: 61 400 → "61,4 k DA" / "61,4 ألف دج". */
export function formatMoneyShort(amount: number, lang: Lang): string {
  const abs = Math.abs(amount)
  const units: Array<[number, Record<Lang, string>]> = [
    [1e9, { en: 'bn', ar: 'مليار' }],
    [1e6, { en: 'M', ar: 'مليون' }],
    [1e3, { en: 'k', ar: 'ألف' }],
  ]
  for (const [size, label] of units) {
    if (abs >= size) {
      const number = formatNumber(amount / size, 1)
      const body = lang === 'ar' ? isolateLtr(number) : number
      return `${body} ${label[lang]} ${CURRENCY.symbol[lang]}`
    }
  }
  return formatMoney(amount, lang)
}

/**
 * Reads a number typed by a cashier. Accepts "1,5", "1.5", "1 250,50",
 * and Arabic-Indic digits (١٫٥). Returns NaN when the text is not a number.
 */
export function parseDecimal(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input
  if (input == null) return NaN
  let text = String(input).trim()
  if (!text) return NaN
  text = text
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // Persian digits
    .replace(/[\s\u00A0\u202F\u2066-\u2069]/g, '') // spaces, no-break spaces and direction marks
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/−/g, '-')
  // With both separators, the last one is the decimal mark (1.250,50 or 1,250.50).
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalMark = lastComma > lastDot ? ',' : '.'
    const thousandsMark = decimalMark === ',' ? '.' : ','
    text = text.split(thousandsMark).join('').replace(decimalMark, '.')
  } else {
    text = text.replace(',', '.')
  }
  if (!/^-?\d*\.?\d+$/.test(text) && !/^-?\d+\.$/.test(text)) return NaN
  return Number(text)
}

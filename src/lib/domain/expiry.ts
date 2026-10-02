/**
 * Product expiry dates (تاريخ نهاية الصلاحية). Stored as a calendar day, YYYY-MM-DD, with no time
 * or timezone: a product is still good on its expiry day and expired from the next day.
 */

/** A product is flagged as expiring soon this many days ahead. */
export const EXPIRY_SOON_DAYS = 14

export type ExpiryState = 'expired' | 'today' | 'soon' | 'ok'

const DAY = /^(\d{4})-(\d{2})-(\d{2})/

/** The calendar day of a stored value ('2026-10-05' or '2026-10-05T00:00:00.000Z'), or null. */
export function toExpiryDay(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  const m = DAY.exec(value)
  if (!m) return null
  const [, y, mo, d] = m
  const check = new Date(Date.UTC(+y, +mo - 1, +d))
  return check.getUTCFullYear() === +y && check.getUTCMonth() === +mo - 1 && check.getUTCDate() === +d ? `${y}-${mo}-${d}` : null
}

/** Today's calendar day in the shop's local time. */
export function localDay(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** The calendar day a number of days after the given one. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Whole days from today to the expiry day: 0 on the day itself, negative once expired. */
export function daysUntilExpiry(expiry: string, today: string): number {
  const at = (day: string) => {
    const [y, m, d] = day.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((at(expiry) - at(today)) / 86_400_000)
}

/** Where a product stands against its expiry date, or null when it has none. */
export function expiryStatus(
  value: string | Date | null | undefined,
  today: string = localDay()
): { day: string; days: number; state: ExpiryState } | null {
  const day = toExpiryDay(value)
  if (!day) return null
  const days = daysUntilExpiry(day, today)
  const state: ExpiryState = days < 0 ? 'expired' : days === 0 ? 'today' : days <= EXPIRY_SOON_DAYS ? 'soon' : 'ok'
  return { day, days, state }
}

/** True when the product needs attention: expired, expiring today or within EXPIRY_SOON_DAYS. */
export function needsExpiryAttention(value: string | Date | null | undefined, today?: string): boolean {
  const s = expiryStatus(value, today)
  return s !== null && s.state !== 'ok'
}

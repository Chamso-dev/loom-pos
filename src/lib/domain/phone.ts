/**
 * Algerian phone numbers. Mobiles are 10 digits starting 05, 06 or 07; landlines are
 * 9 digits starting 02, 03 or 04. Numbers typed with +213 or 00213 are converted to
 * the national form so the same customer is never saved twice.
 */

/** Returns the national form (0555123456), or null when the number is not Algerian. */
export function normalizeAlgerianPhone(input: string | null | undefined): string | null {
  if (!input) return null
  let digits = String(input)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\d+]/g, '')
  if (digits.startsWith('+213')) digits = '0' + digits.slice(4)
  else if (digits.startsWith('00213')) digits = '0' + digits.slice(5)
  else if (digits.startsWith('213') && digits.length >= 11) digits = '0' + digits.slice(3)
  if (/^0[567]\d{8}$/.test(digits)) return digits
  if (/^0[234]\d{7}$/.test(digits)) return digits
  return null
}

/** 0555123456 → "0555 12 34 56", 021234567 → "021 23 45 67". Other text is returned unchanged. */
export function formatAlgerianPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const n = normalizeAlgerianPhone(phone)
  if (!n) return phone
  return n.length === 10
    ? `${n.slice(0, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)} ${n.slice(8)}`
    : `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`
}

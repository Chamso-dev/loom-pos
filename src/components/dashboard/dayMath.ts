// Pure helpers for the dashboard. Kept free of React so they are easy to check.

/** 10 → "10:00", 24 → "00:00": the 24-hour clock used in Algeria. */
export const hourLabel = (hour: number) => `${String(((hour % 24) + 24) % 24).padStart(2, '0')}:00`

/** Parses a "YYYY-MM-DD" key as a local date, avoiding the UTC shift of new Date(key). */
export function localDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

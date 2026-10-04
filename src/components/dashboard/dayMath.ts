// Pure helpers for the dashboard. Kept free of React so they are easy to check.

/** 10 → "10:00", 24 → "00:00": the 24-hour clock used in Algeria. */
export const hourLabel = (hour: number) => `${String(((hour % 24) + 24) % 24).padStart(2, '0')}:00`

/** Parses a "YYYY-MM-DD" key as a local date, avoiding the UTC shift of new Date(key). */
export function localDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export interface DayShape {
  /** First hour shown on the chart. */
  start: number
  /** Hour the chart ends at (exclusive end of trading). */
  end: number
  /** Current time as a fractional hour, clamped to the chart. */
  nowAt: number
  /** Today's running total at each hour boundary from start up to nowAt, ending with the total so far. */
  todayPoints: Array<[number, number]>
  /** An average day's running total at each hour boundary from start to end. */
  averagePoints: Array<[number, number]>
  todayTotal: number
  /** What an average day had taken by nowAt. */
  averageByNow: number
  /** What an average day took in total. */
  averageTotal: number
}

const sumTo = (values: number[], hour: number) => values.slice(0, hour).reduce((a, b) => a + b, 0)

/**
 * Works out the chart's hours and running totals.
 * The chart spans the hours the store actually trades, from the earliest to the latest sale
 * seen today or this past week, so a 10 am to 9 pm shop is not squeezed into 24 hours.
 */
export function shapeDay(todayByHour: number[], averageByHour: number[], now: Date): DayShape {
  const busy = todayByHour
    .map((v, h) => (v > 0 || averageByHour[h] > 0 ? h : -1))
    .filter((h) => h >= 0)

  const start = busy.length ? Math.min(...busy) : 10
  const end = busy.length ? Math.max(...busy) + 1 : 21

  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowAt = Math.min(Math.max(nowHour, start), end)

  const todayTotal = todayByHour.reduce((a, b) => a + b, 0)

  const todayPoints: Array<[number, number]> = []
  for (let h = start; h <= Math.floor(nowAt) && h < nowAt; h++) {
    todayPoints.push([h, sumTo(todayByHour, h)])
  }
  todayPoints.push([nowAt, todayTotal])

  const averagePoints: Array<[number, number]> = []
  for (let h = start; h <= end; h++) {
    averagePoints.push([h, sumTo(averageByHour, h)])
  }

  // Interpolate within the current hour so the comparison moves smoothly through the day.
  const whole = Math.floor(nowAt)
  const averageByNow = sumTo(averageByHour, whole) + (averageByHour[whole] ?? 0) * (nowAt - whole)
  const averageTotal = averageByHour.reduce((a, b) => a + b, 0)

  return { start, end, nowAt, todayPoints, averagePoints, todayTotal, averageByNow, averageTotal }
}

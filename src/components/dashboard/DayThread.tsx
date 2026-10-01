import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { hourLabel, rupees, type DayShape } from './dayMath'

interface DayThreadProps {
  shape: DayShape
  comparedDays: number
  now: Date
}

const HEIGHT = 240
const PAD_TOP = 36
const PAD_BOTTOM = 32

/** Measures an element's width so the chart draws at true pixel size. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

const toPath = (points: Array<[number, number]>) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/**
 * Today's running takings drawn as one thick thread across the store's trading hours,
 * over a dotted line for an average day this past week.
 */
export default function DayThread({ shape, comparedDays, now }: DayThreadProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const { start, end, nowAt, todayPoints, averagePoints, todayTotal, averageByNow, averageTotal } = shape
  const hasAverage = comparedDays > 0

  const top = Math.max(todayTotal, hasAverage ? averageTotal : 0, 1) * 1.08
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const x = (hour: number) => ((hour - start) / Math.max(end - start, 1)) * width
  const y = (amount: number) => PAD_TOP + plotHeight - (amount / top) * plotHeight

  const today = todayPoints.map(([h, v]) => [x(h), y(v)] as [number, number])
  const average = averagePoints.map(([h, v]) => [x(h), y(v)] as [number, number])
  const knot = today[today.length - 1]

  // Label every hour when there is room, otherwise every second hour.
  const step = width / Math.max(end - start, 1) >= 64 ? 1 : 2
  const ticks: number[] = []
  for (let h = start; h <= end; h += step) ticks.push(h)

  const isClosed = nowAt >= end
  const knotLabel = isClosed ? `${rupees(todayTotal)} at closing` : `${rupees(todayTotal)} at ${format(now, 'h:mm a').toLowerCase()}`
  // Keep the knot label inside the chart near either edge.
  const knotAnchor = knot && knot[0] > width - 140 ? 'end' : knot && knot[0] < 140 ? 'start' : 'middle'

  // After closing, the knot sits at the right edge beside the average label. Move that label below its line if they would touch.
  const averageEndY = average.length ? average[average.length - 1][1] : 0
  const knotLabelY = knot ? knot[1] - 16 : 0
  const averageLabelY =
    isClosed && Math.abs(knotLabelY - (averageEndY - 10)) < 22 ? averageEndY + 22 : averageEndY - 10

  const description = hasAverage
    ? `Sales through the day. ${rupees(todayTotal)} so far. An average day this past week had taken ${rupees(averageByNow)} by this time and ended at ${rupees(averageTotal)}.`
    : `Sales through the day. ${rupees(todayTotal)} so far.`

  return (
    <div className="ld-thread">
      <ul className="ld-thread-legend" aria-hidden="true">
        <li><span className="ld-swatch-line" />Today</li>
        {hasAverage && (
          <li>
            <span className="ld-swatch-dash" />
            Average day, from the past {comparedDays === 1 ? 'day' : `${comparedDays} days`} with sales
          </li>
        )}
      </ul>
      <div ref={ref}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={description}>
            <line className="ld-thread-axis" x1={0} x2={width} y1={y(0)} y2={y(0)} />

            {ticks.map((h) => (
              <text
                key={h}
                className="ld-thread-label"
                x={x(h)}
                y={HEIGHT - 8}
                textAnchor={h === start ? 'start' : h === end ? 'end' : 'middle'}
              >
                {hourLabel(h)}
              </text>
            ))}

            {hasAverage && (
              <>
                <path className="ld-thread-average" d={toPath(average)} />
                <text
                  className="ld-thread-label"
                  x={width}
                  y={averageLabelY}
                  textAnchor="end"
                >
                  Average day ends at {rupees(averageTotal)}
                </text>
              </>
            )}

            {!isClosed && knot && (
              <line className="ld-thread-now" x1={knot[0]} x2={knot[0]} y1={y(0)} y2={knot[1]} />
            )}

            {today.length > 1 && <path className="ld-thread-today" pathLength={1} d={toPath(today)} />}

            {knot && (
              <>
                <circle className="ld-thread-knot" cx={knot[0]} cy={knot[1]} r={7} />
                <text
                  className="ld-thread-label-strong"
                  x={knot[0]}
                  y={knot[1] - 16}
                  textAnchor={knotAnchor}
                >
                  {knotLabel}
                </text>
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}

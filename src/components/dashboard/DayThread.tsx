import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'
import { hourLabel, type DayShape } from './dayMath'

interface DayThreadProps {
  shape: DayShape
  comparedDays: number
  now: Date
}

const HEIGHT = 240
const PAD_TOP = 36
const PAD_BOTTOM = 32

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

const toPath = (points: Array<[number, number]>) => points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/**
 * Today's running takings drawn as one thick thread across the shop's trading hours,
 * over a dotted line for an average day this past week. Time runs left to right in
 * both languages, as on most Arabic dashboards.
 */
export default function DayThread({ shape, comparedDays, now }: DayThreadProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const { t, money, time, dir } = useI18n()
  // SVG text anchors follow the text direction, so start and end swap for Arabic labels.
  const anchor = (a: 'start' | 'middle' | 'end') => (dir === 'rtl' && a !== 'middle' ? (a === 'start' ? 'end' : 'start') : a)
  const { start, end, nowAt, todayPoints, averagePoints, todayTotal, averageByNow, averageTotal } = shape
  const hasAverage = comparedDays > 0

  const top = Math.max(todayTotal, hasAverage ? averageTotal : 0, 1) * 1.08
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const x = (hour: number) => ((hour - start) / Math.max(end - start, 1)) * width
  const y = (amount: number) => PAD_TOP + plotHeight - (amount / top) * plotHeight

  const today = todayPoints.map(([h, v]) => [x(h), y(v)] as [number, number])
  const average = averagePoints.map(([h, v]) => [x(h), y(v)] as [number, number])
  const knot = today[today.length - 1]

  const step = width / Math.max(end - start, 1) >= 64 ? 1 : 2
  const ticks: number[] = []
  for (let h = start; h <= end; h += step) ticks.push(h)

  const isClosed = nowAt >= end
  const knotLabel = isClosed ? t('dashboard.atClosing', { amount: money(todayTotal) }) : t('dashboard.atTime', { amount: money(todayTotal), time: time(now) })
  const knotAnchor = knot && knot[0] > width - 140 ? 'end' : knot && knot[0] < 140 ? 'start' : 'middle'

  const averageEndY = average.length ? average[average.length - 1][1] : 0
  const knotLabelY = knot ? knot[1] - 16 : 0
  // Late in the day both labels sit near the right edge. When they would touch, lift the average
  // label above today's label, or drop it under today's knot when there is no room above.
  const labelsMeet = !!knot && knot[0] > width - 440 && Math.abs(knotLabelY - (averageEndY - 10)) < 22
  const averageLabelY = !labelsMeet ? averageEndY - 10 : knotLabelY - 22 >= 12 ? knotLabelY - 22 : knot[1] + 28

  const description = hasAverage
    ? t('dashboard.threadDescription', { total: money(todayTotal), byNow: money(averageByNow), end: money(averageTotal) })
    : t('dashboard.threadDescriptionShort', { total: money(todayTotal) })

  return (
    <div className="ld-thread">
      <ul className="ld-thread-legend" aria-hidden="true">
        <li><span className="ld-swatch-line" />{t('dashboard.legendToday')}</li>
        {hasAverage && (
          <li>
            <span className="ld-swatch-dash" />
            {t('dashboard.legendAverage', { count: comparedDays })}
          </li>
        )}
      </ul>
      <div ref={ref} dir="ltr">
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={description}>
            <line className="ld-thread-axis" x1={0} x2={width} y1={y(0)} y2={y(0)} />
            {ticks.map((h) => (
              <text key={h} className="ld-thread-label" x={x(h)} y={HEIGHT - 8} textAnchor={h === start ? 'start' : h === end ? 'end' : 'middle'}>
                {hourLabel(h)}
              </text>
            ))}
            {hasAverage && (
              <>
                <path className="ld-thread-average" d={toPath(average)} />
                <text className="ld-thread-label" x={width} y={averageLabelY} direction={dir} textAnchor={anchor('end')}>
                  {t('dashboard.averageEnds', { amount: money(averageTotal) })}
                </text>
              </>
            )}
            {!isClosed && knot && <line className="ld-thread-now" x1={knot[0]} x2={knot[0]} y1={y(0)} y2={knot[1]} />}
            {today.length > 1 && <path className="ld-thread-today" pathLength={1} d={toPath(today)} />}
            {knot && (
              <>
                <circle className="ld-thread-knot" cx={knot[0]} cy={knot[1]} r={7} />
                <text className="ld-thread-label-strong" x={knot[0]} y={knot[1] - 16} direction={dir} textAnchor={anchor(knotAnchor)}>
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

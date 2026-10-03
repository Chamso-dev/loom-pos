import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'
import { hourLabel } from './dayMath'

/** Width of an element, kept up to date as the layout changes. */
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

/**
 * Seven thin columns, one per day; today in the accent blue, past days in gray. Answers
 * "is today busier than usual?" at a glance. The label carries the values for screen readers.
 */
export function Spark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1)
  const bar = 6
  const gap = 3
  const height = 22
  return (
    <svg className="ld-spark" width={values.length * (bar + gap) - gap} height={height} role="img" aria-label={label}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height)
        return <rect key={i} className={i === values.length - 1 ? 'is-now' : undefined} x={i * (bar + gap)} y={height - h} width={bar} height={h} rx={1.5} />
      })}
    </svg>
  )
}

/** A ratio against a whole: the fill carries the tone, the track is a light step of the same color. */
export function Meter({ value, tone = 'blue', className }: { value: number; tone?: 'blue' | 'gain' | 'credit' | 'low' | 'out'; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <span className={`ld-meter ld-meter-${tone}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </span>
  )
}

/**
 * Sales in each trading hour today (columns), with an average day's takings for that hour as
 * a short gray mark across each column. Hover or focus a column for both values. Time runs
 * left to right in both languages, like the day chart above it.
 */
export function HourColumns({ todayByHour, averageByHour, start, end, nowAt }: { todayByHour: number[]; averageByHour: number[]; start: number; end: number; nowAt: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const { t, money, moneyShort } = useI18n()
  const [active, setActive] = useState<number | null>(null)

  const hours = Array.from({ length: Math.max(end - start, 1) }, (_, i) => start + i)
  const max = Math.max(...hours.map((h) => Math.max(todayByHour[h] ?? 0, averageByHour[h] ?? 0)), 1) * 1.12
  const PLOT = 150
  const TOP = 22
  const AXIS = 24
  const slot = width / hours.length
  const barW = Math.max(4, Math.min(24, slot * 0.56))
  const y = (v: number) => TOP + PLOT - (v / max) * PLOT
  const peakHour = hours.reduce((best, h) => ((todayByHour[h] ?? 0) > (todayByHour[best] ?? 0) ? h : best), hours[0])
  const hasSales = hours.some((h) => (todayByHour[h] ?? 0) > 0)
  const labelEvery = slot >= 44 ? 1 : slot >= 22 ? 2 : 3
  const range = (h: number) => t('dashboard.hourRange', { from: hourLabel(h), to: hourLabel(h + 1) })

  return (
    <div className="ld-hours">
      {hasSales && (
        <p className="ld-hours-insight">{t('dashboard.busiestSoFar', { hour: range(peakHour), amount: money(todayByHour[peakHour]) })}</p>
      )}
      <ul className="ld-thread-legend" aria-hidden="true">
        <li><span className="ld-swatch-block" />{t('dashboard.hourToday')}</li>
        <li><span className="ld-swatch-tick" />{t('dashboard.hourAverage')}</li>
      </ul>
      <div ref={ref} dir="ltr" className="ld-hours-plot" onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={TOP + PLOT + AXIS} role="group" aria-label={t('dashboard.busiestHours')}>
            <line className="ld-thread-axis" x1={0} x2={width} y1={TOP + PLOT} y2={TOP + PLOT} />
            {hours.map((h, i) => {
              const cx = i * slot + slot / 2
              const today = todayByHour[h] ?? 0
              const avg = averageByHour[h] ?? 0
              const future = h > nowAt
              const label = t('dashboard.hourLabel', { hour: range(h), today: money(today), average: money(avg) })
              return (
                <g key={h} className={`ld-hours-col${active === h ? ' is-active' : ''}${future ? ' is-future' : ''}`}>
                  {/* Hit area: the whole column slot, not just the painted bar. */}
                  <rect
                    className="ld-hours-hit"
                    x={i * slot}
                    y={0}
                    width={slot}
                    height={TOP + PLOT}
                    tabIndex={0}
                    role="img"
                    aria-label={label}
                    onMouseEnter={() => setActive(h)}
                    onFocus={() => setActive(h)}
                    onBlur={() => setActive(null)}
                  />
                  {today > 0 && (
                    <path
                      className="ld-hours-bar"
                      d={roundedTop(cx - barW / 2, y(today), barW, TOP + PLOT - y(today), Math.min(4, barW / 2))}
                    />
                  )}
                  {avg > 0 && <line className="ld-hours-avg" x1={cx - barW / 2 - 4} x2={cx + barW / 2 + 4} y1={y(avg)} y2={y(avg)} />}
                  {h === peakHour && today > 0 && (
                    <text className="ld-thread-label-strong" x={cx} y={y(today) - 8} textAnchor="middle">{moneyShort(today)}</text>
                  )}
                  {i % labelEvery === 0 && (
                    <text className="ld-thread-label" x={cx} y={TOP + PLOT + 17} textAnchor="middle">{hourLabel(h).slice(0, 2)}</text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
        {active !== null && width > 0 && (
          <div
            className="ld-tip"
            role="presentation"
            style={{ left: Math.min(Math.max((hours.indexOf(active) + 0.5) * slot, 70), width - 70), top: 0 }}
          >
            <strong>{range(active)}</strong>
            <span><i className="ld-tip-key is-today" />{money(todayByHour[active] ?? 0)} <em>{t('dashboard.hourToday')}</em></span>
            <span><i className="ld-tip-key is-avg" />{money(averageByHour[active] ?? 0)} <em>{t('dashboard.hourAverage')}</em></span>
          </div>
        )}
      </div>
      {!hasSales && <p className="ld-empty">{t('dashboard.noSalesHours')}</p>}
    </div>
  )
}

/** A bar path with rounded data end (top) and a square baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

/**
 * Today's takings by category as horizontal bars, largest first, each labeled with its amount
 * and share. Named categories in the accent blue, the folded "other" row in gray.
 */
export function CategoryBars({ categories }: { categories: Array<{ category: string | null; revenue: number }> }) {
  const { t, money, percent } = useI18n()
  const total = categories.reduce((sum, c) => sum + c.revenue, 0)
  const max = Math.max(...categories.map((c) => c.revenue), 1)
  if (!categories.length || total <= 0) return <p className="ld-empty">{t('dashboard.noCategories')}</p>
  return (
    <ul className="ld-cats">
      {categories.map((c) => (
        <li key={c.category ?? 'other'} className="ld-cat">
          <span className="ld-cat-name">{c.category ? <bdi>{c.category}</bdi> : t('dashboard.otherCategories')}</span>
          <span className="ld-cat-value">
            {money(c.revenue)}
            <span className="ld-cat-share">{t('dashboard.categoryShare', { percent: percent(Math.round((c.revenue / total) * 100)) })}</span>
          </span>
          <span className={`ld-cat-bar${c.category ? '' : ' is-other'}`} style={{ width: `${Math.max(2, (c.revenue / max) * 100)}%` }} aria-hidden="true" />
        </li>
      ))}
    </ul>
  )
}

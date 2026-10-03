import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useI18n } from '@/i18n'
import { useSize } from './DashboardVisuals'
import { hourLabel } from './dayMath'

export interface ComparisonPoint {
  /** Start of the bucket in this period and in the previous one (ISO). */
  at: string
  previousAt: string
  /** null for buckets still in the future. */
  value: number | null
  previous: number | null
}

/** "3 Oct" for days, "3 Oct 09:00" for hours. */
export function useBucketLabel(granularity: 'hour' | 'day') {
  const i18n = useI18n()
  return (iso: string) => {
    const d = new Date(iso)
    return granularity === 'hour' ? `${i18n.date(d, 'dayShort')} ${hourLabel(d.getHours())}` : i18n.date(d, 'dayShort')
  }
}

/** Round the top of the scale up to 1, 2, 2.5 or 5 times a power of ten. */
function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power
  return 10 * power
}

const pathOf = (points: Array<[number, number]>) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')

/**
 * This period as a solid line over a light wash, the previous period as a dashed lighter line,
 * on one scale. The full chart has gridlines, axes and a crosshair with a tooltip (pointer or
 * arrow keys); the compact one is a bare sparkline for the metric tabs. Time runs left to right
 * in both languages.
 */
export function ComparisonLine({
  points,
  granularity,
  format,
  formatAxis,
  labels,
  compact = false,
  height: fixedHeight = 280,
  title,
}: {
  points: ComparisonPoint[]
  granularity: 'hour' | 'day'
  format: (value: number) => string
  formatAxis?: (value: number) => string
  labels: { current: string; previous: string }
  compact?: boolean
  height?: number
  title: string
}) {
  // The compact chart takes its height from the stylesheet, so it can shrink on a phone.
  const [ref, width, measured] = useSize<HTMLDivElement>()
  const height = compact ? measured || 32 : fixedHeight
  const [active, setActive] = useState<number | null>(null)
  const gradient = useId()
  const bucketLabel = useBucketLabel(granularity)
  const { t } = useI18n()

  const n = points.length
  const values = points.flatMap((p) => [p.value ?? 0, p.previous ?? 0])
  const hasNegative = values.some((v) => v < 0)
  const top = niceMax(Math.max(...values, 0) * 1.05)
  const bottom = hasNegative ? -niceMax(-Math.min(...values) * 1.05) : 0

  const PAD_TOP = compact ? 2 : 10
  const AXIS = compact ? 2 : 28
  const GUTTER = compact ? 1 : 64
  const plotH = height - PAD_TOP - AXIS
  const plotW = Math.max(width - GUTTER - (compact ? 1 : 12), 1)
  const x = (i: number) => GUTTER + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => PAD_TOP + plotH - ((v - bottom) / (top - bottom)) * plotH
  const baseline = y(Math.max(bottom, 0))

  const current = points.flatMap((p, i) => (p.value === null ? [] : [[x(i), y(p.value)] as [number, number]]))
  const previous = points.flatMap((p, i) => (p.previous === null ? [] : [[x(i), y(p.previous)] as [number, number]]))
  const lastCurrent = points.reduce((last, p, i) => (p.value === null ? last : i), -1)
  const area = current.length > 1 ? `${pathOf(current)}L${current[current.length - 1][0].toFixed(1)},${baseline}L${current[0][0].toFixed(1)},${baseline}Z` : ''

  const ticks = compact ? [] : [0, 0.25, 0.5, 0.75, 1].map((f) => bottom + (top - bottom) * f)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / (granularity === 'hour' ? 56 : 72)))))
  const xLabel = (iso: string) => (granularity === 'hour' ? hourLabel(new Date(iso).getHours()) : bucketLabel(iso))

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    const i = n <= 1 ? 0 : Math.round(((px - GUTTER) / plotW) * (n - 1))
    setActive(Math.max(0, Math.min(n - 1, i)))
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const from = active ?? Math.max(lastCurrent, 0)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : from + (e.key === 'ArrowRight' ? 1 : -1)
    setActive(Math.max(0, Math.min(n - 1, next)))
  }

  const tip = active !== null ? points[active] : null
  // The tooltip sits above the higher of the two points, or below it near the top of the chart.
  const tipAt = tip ? Math.min(y(tip.value ?? bottom), y(tip.previous ?? bottom)) : null

  return (
    <div ref={ref} dir="ltr" className={`sp-line${compact ? ' is-compact' : ''}`} style={compact ? undefined : { height }} onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role={compact ? undefined : 'img'}
          aria-hidden={compact || undefined}
          aria-label={compact ? undefined : title}
          tabIndex={compact ? undefined : 0}
          onPointerMove={compact ? undefined : pick}
          onPointerDown={compact ? undefined : pick}
          onFocus={compact ? undefined : () => setActive(Math.max(lastCurrent, 0))}
          onBlur={compact ? undefined : () => setActive(null)}
          onKeyDown={compact ? undefined : onKey}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="sp-wash-top" />
              <stop offset="100%" className="sp-wash-bottom" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line className="sp-gridline" x1={GUTTER} x2={GUTTER + plotW} y1={y(v)} y2={y(v)} />
              <text className="sp-axis" x={GUTTER - 10} y={y(v) + 4} textAnchor="end">{(formatAxis ?? format)(v)}</text>
            </g>
          ))}
          {!compact && points.map((p, i) => (i % labelEvery === 0 ? (
            <text key={p.at} className="sp-axis" x={x(i)} y={height - 8} textAnchor={i === 0 && n > 1 ? 'start' : 'middle'}>{xLabel(p.at)}</text>
          ) : null))}
          {area && <path className="sp-line-area" d={area} fill={`url(#${gradient})`} />}
          {previous.length > 1 && <path className="sp-line-previous" d={pathOf(previous)} />}
          {current.length > 1 && <path className="sp-line-current" d={pathOf(current)} />}
          {current.length === 1 && <circle className="sp-line-dot" cx={current[0][0]} cy={current[0][1]} r={compact ? 2.5 : 4} />}
          {tip && (
            <g className="sp-crosshair">
              <line x1={x(active!)} x2={x(active!)} y1={PAD_TOP} y2={PAD_TOP + plotH} />
              {tip.previous !== null && <circle className="sp-crosshair-previous" cx={x(active!)} cy={y(tip.previous)} r={4} />}
              {tip.value !== null && <circle className="sp-crosshair-current" cx={x(active!)} cy={y(tip.value)} r={5} />}
            </g>
          )}
        </svg>
      )}
      {tip && tipAt !== null && width > 0 && (
        <div
          className={`sp-tip${tipAt < 72 ? ' is-below' : ''}`}
          role="presentation"
          style={{ left: Math.min(Math.max(x(active!), 110), width - 110), top: tipAt < 72 ? tipAt + 14 : tipAt - 12 }}
        >
          <span className="sp-tip-row">
            <i className="sp-key is-current" />
            <em>{bucketLabel(tip.at)}</em>
            <strong>{tip.value === null ? '–' : format(tip.value)}</strong>
          </span>
          <span className="sp-tip-row">
            <i className="sp-key is-previous" />
            <em>{bucketLabel(tip.previousAt)}</em>
            <strong>{tip.previous === null ? '–' : format(tip.previous)}</strong>
          </span>
        </div>
      )}
      {!compact && (
        <table className="ld-sr-only">
          <caption>{title}</caption>
          <thead>
            <tr><th scope="col">{t('dashboard.time')}</th><th scope="col">{labels.current}</th><th scope="col">{labels.previous}</th></tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.at}><th scope="row">{bucketLabel(p.at)}</th><td>{p.value === null ? '–' : format(p.value)}</td><td>{p.previous === null ? '–' : format(p.previous)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** The key under a comparison chart: the two periods, named by their dates. */
export function ChartLegend({ current, previous }: { current: string; previous: string }) {
  return (
    <ul className="sp-legend">
      <li><span className="sp-key is-current" aria-hidden="true" />{current}</li>
      <li><span className="sp-key is-previous" aria-hidden="true" />{previous}</li>
    </ul>
  )
}

export interface RankRow {
  key: string
  name: ReactNode
  value: number
  /** A line under the name, e.g. units sold. */
  detail?: ReactNode
  /** The folded "other" row: gray bar. */
  other?: boolean
}

/**
 * A ranking as horizontal bars, largest first: the name and amount above a thin bar, and the
 * share of the total. One measure, so one color.
 */
export function RankBars({ rows, empty }: { rows: RankRow[]; empty: string }) {
  const { money, percent } = useI18n()
  const total = rows.reduce((sum, r) => sum + Math.max(r.value, 0), 0)
  const max = Math.max(...rows.map((r) => r.value), 1)
  if (!rows.length || total <= 0) return <p className="sp-empty">{empty}</p>
  return (
    <ul className="sp-bars">
      {rows.map((r) => (
        <li key={r.key} className="sp-bar-row">
          <span className="sp-bar-name">{r.name}</span>
          <span className="sp-bar-value">
            {money(r.value)}
            <span className="sp-bar-share">{percent(Math.round((Math.max(r.value, 0) / total) * 100))}</span>
          </span>
          {r.detail && <span className="sp-bar-detail">{r.detail}</span>}
          <span className="sp-bar-track" aria-hidden="true">
            <span className={`sp-bar${r.other ? ' is-other' : ''}`} style={{ width: `${Math.max(1.5, (Math.max(r.value, 0) / max) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Sales in each hour of the day as blue columns on a scale with gridlines. Only the hours the
 * shop trades in are shown. Hover or focus a column for its value.
 */
export function HourBars({ values, nowHour }: { values: number[]; nowHour: number | null }) {
  const [ref, width, height] = useSize<HTMLDivElement>()
  const { t, money, moneyShort } = useI18n()
  const [active, setActive] = useState<number | null>(null)

  const busy = values.flatMap((v, i) => (v > 0 ? [i] : []))
  const start = busy.length ? Math.min(busy[0], 8) : 8
  const end = busy.length ? Math.max(busy[busy.length - 1] + 1, 20) : 20
  const shown = Array.from({ length: end - start }, (_, i) => start + i)
  const top = niceMax(Math.max(...shown.map((h) => values[h]), 1) * 1.05)
  const TOP = 10
  const AXIS = 26
  const GUTTER = 64
  const PLOT = Math.max(height - TOP - AXIS, 120)
  const plotW = Math.max(width - GUTTER, 1)
  const slot = plotW / shown.length
  const barW = Math.max(4, Math.min(28, slot * 0.6))
  const y = (v: number) => TOP + PLOT - (v / top) * PLOT
  const labelEvery = slot >= 44 ? 1 : slot >= 22 ? 2 : 3
  const range = (h: number) => t('dashboard.hourRange', { from: hourLabel(h), to: hourLabel(h + 1) })

  return (
    <div ref={ref} dir="ltr" className="sp-hours" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={TOP + PLOT + AXIS} role="group" aria-label={t('dashboard.ov.hours')}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line className="sp-gridline" x1={GUTTER} x2={width} y1={y(top * f)} y2={y(top * f)} />
              <text className="sp-axis" x={GUTTER - 10} y={y(top * f) + 4} textAnchor="end">{moneyShort(top * f)}</text>
            </g>
          ))}
          {shown.map((h, i) => {
            const cx = GUTTER + i * slot + slot / 2
            const v = values[h]
            return (
              <g key={h} className={`sp-col${active === h ? ' is-active' : ''}${nowHour !== null && h > nowHour ? ' is-future' : ''}`}>
                <rect
                  className="sp-col-hit"
                  x={GUTTER + i * slot}
                  y={TOP}
                  width={slot}
                  height={PLOT}
                  tabIndex={0}
                  role="img"
                  aria-label={`${range(h)}: ${money(v)}`}
                  onMouseEnter={() => setActive(h)}
                  onFocus={() => setActive(h)}
                  onBlur={() => setActive(null)}
                />
                {v > 0 && <path className="sp-col-bar" d={roundedTop(cx - barW / 2, y(v), barW, TOP + PLOT - y(v), Math.min(3, barW / 2))} />}
                {i % labelEvery === 0 && (
                  <text className="sp-axis" x={cx} y={TOP + PLOT + 18} textAnchor="middle">{hourLabel(h)}</text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {active !== null && width > 0 && (
        <div className="sp-tip" role="presentation" style={{ left: Math.min(Math.max(GUTTER + (shown.indexOf(active) + 0.5) * slot, 90), width - 90), top: y(values[active]) - 10 }}>
          <span className="sp-tip-row">
            <i className="sp-key is-current" />
            <em>{range(active)}</em>
            <strong>{money(values[active])}</strong>
          </span>
        </div>
      )}
    </div>
  )
}

/** A bar path with a rounded data end (top) and a square baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

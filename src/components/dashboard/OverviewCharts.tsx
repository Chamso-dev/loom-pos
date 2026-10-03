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

/** "14 Oct" for days, "14 Oct 09:00" for hours. */
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
 * This period as a solid blue line with a light wash under it, the previous period as a dotted
 * gray line, on one scale. The full chart has gridlines, axes and a crosshair with a tooltip
 * (pointer or arrow keys); the compact one is a bare sparkline for the metric cards. Time runs
 * left to right in both languages.
 */
export function ComparisonLine({
  points,
  granularity,
  format,
  formatAxis,
  labels,
  compact = false,
  height: fixedHeight = 260,
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
  const height = compact ? measured || 56 : fixedHeight
  const [active, setActive] = useState<number | null>(null)
  const gradient = useId()
  const bucketLabel = useBucketLabel(granularity)
  const { t } = useI18n()

  const n = points.length
  const values = points.flatMap((p) => [p.value ?? 0, p.previous ?? 0])
  const hasNegative = values.some((v) => v < 0)
  const top = niceMax(Math.max(...values, 0) * 1.05)
  const bottom = hasNegative ? -niceMax(-Math.min(...values) * 1.05) : 0

  const PAD_TOP = compact ? 4 : 12
  const AXIS = compact ? 4 : 28
  const GUTTER = compact ? 2 : 56
  const plotH = height - PAD_TOP - AXIS
  const plotW = Math.max(width - GUTTER - (compact ? 2 : 8), 1)
  const x = (i: number) => GUTTER + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => PAD_TOP + plotH - ((v - bottom) / (top - bottom)) * plotH
  const baseline = y(Math.max(bottom, 0))

  const current = points.flatMap((p, i) => (p.value === null ? [] : [[x(i), y(p.value)] as [number, number]]))
  const previous = points.flatMap((p, i) => (p.previous === null ? [] : [[x(i), y(p.previous)] as [number, number]]))
  const lastCurrent = points.reduce((last, p, i) => (p.value === null ? last : i), -1)
  const area = current.length > 1 ? `${pathOf(current)}L${current[current.length - 1][0].toFixed(1)},${baseline}L${current[0][0].toFixed(1)},${baseline}Z` : ''

  const ticks = compact ? [] : [0, 0.25, 0.5, 0.75, 1].map((f) => bottom + (top - bottom) * f)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / (granularity === 'hour' ? 44 : 64)))))
  const xLabel = (iso: string) => (granularity === 'hour' ? hourLabel(new Date(iso).getHours()).slice(0, 2) : bucketLabel(iso))

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
    <div ref={ref} dir="ltr" className={`ld-line${compact ? ' is-compact' : ''}`} style={compact ? undefined : { height }} onMouseLeave={() => setActive(null)}>
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
              <stop offset="0%" className="ld-line-wash-top" />
              <stop offset="100%" className="ld-line-wash-bottom" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line className="ld-gridline" x1={GUTTER} x2={GUTTER + plotW} y1={y(v)} y2={y(v)} />
              <text className="ld-axis-label" x={GUTTER - 8} y={y(v) + 4} textAnchor="end">{(formatAxis ?? format)(v)}</text>
            </g>
          ))}
          {compact && <line className="ld-gridline" x1={GUTTER} x2={GUTTER + plotW} y1={baseline} y2={baseline} />}
          {!compact && points.map((p, i) => (i % labelEvery === 0 ? (
            <text key={p.at} className="ld-axis-label" x={x(i)} y={height - 8} textAnchor={i === 0 && n > 1 ? 'start' : 'middle'}>{xLabel(p.at)}</text>
          ) : null))}
          {area && <path className="ld-line-area" d={area} fill={`url(#${gradient})`} />}
          {previous.length > 1 && <path className="ld-line-previous" d={pathOf(previous)} />}
          {current.length > 1 && <path className="ld-line-current" d={pathOf(current)} />}
          {current.length === 1 && <circle className="ld-line-dot" cx={current[0][0]} cy={current[0][1]} r={4} />}
          {tip && (
            <g className="ld-crosshair">
              <line x1={x(active!)} x2={x(active!)} y1={PAD_TOP} y2={PAD_TOP + plotH} />
              {tip.previous !== null && <circle className="ld-crosshair-previous" cx={x(active!)} cy={y(tip.previous)} r={4} />}
              {tip.value !== null && <circle className="ld-crosshair-current" cx={x(active!)} cy={y(tip.value)} r={5} />}
            </g>
          )}
        </svg>
      )}
      {tip && tipAt !== null && width > 0 && (
        <div
          className={`ld-tip${tipAt < 64 ? ' is-below' : ''}`}
          role="presentation"
          style={{ left: Math.min(Math.max(x(active!), 90), width - 90), top: tipAt < 64 ? tipAt + 14 : tipAt - 12 }}
        >
          <span><i className="ld-tip-key is-today" />{tip.value === null ? '–' : format(tip.value)} <em>{bucketLabel(tip.at)}</em></span>
          <span><i className="ld-tip-key is-previous" />{tip.previous === null ? '–' : format(tip.previous)} <em>{bucketLabel(tip.previousAt)}</em></span>
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

export interface RankRow {
  key: string
  name: ReactNode
  value: number
  /** A line under the name, e.g. units sold. */
  detail?: ReactNode
  /** A colored square before the name, for entities with their own color (payment methods). */
  dip?: string
  /** The folded "other" row: gray bar. */
  other?: boolean
}

/**
 * A ranking as horizontal bars, largest first, each labeled with its amount and share of the
 * total. One measure, so one color; identity is in the label.
 */
export function RankBars({ rows, empty }: { rows: RankRow[]; empty: string }) {
  const { money, percent } = useI18n()
  const total = rows.reduce((sum, r) => sum + Math.max(r.value, 0), 0)
  const max = Math.max(...rows.map((r) => r.value), 1)
  if (!rows.length || total <= 0) return <p className="ld-empty">{empty}</p>
  return (
    <ul className="ld-cats">
      {rows.map((r) => (
        <li key={r.key} className="ld-cat">
          <span className="ld-cat-name">
            {r.dip && <span className={`ld-dip ${r.dip}`} aria-hidden="true" />}
            {r.name}
          </span>
          <span className="ld-cat-value">
            {money(r.value)}
            <span className="ld-cat-share">{percent(Math.round((Math.max(r.value, 0) / total) * 100))}</span>
          </span>
          {r.detail && <span className="ld-cat-detail">{r.detail}</span>}
          <span className={`ld-cat-bar${r.other ? ' is-other' : ''}`} style={{ width: `${Math.max(2, (Math.max(r.value, 0) / max) * 100)}%` }} aria-hidden="true" />
        </li>
      ))}
    </ul>
  )
}

/**
 * Sales in each hour of the day: this period as blue columns, the previous period as a short
 * gray mark across each column. Only the hours the shop trades in are shown. Hover or focus a
 * column for both values.
 */
export function HourBars({ hours, labels, nowHour }: { hours: Array<{ current: number; previous: number }>; labels: { current: string; previous: string }; nowHour: number | null }) {
  // The plot fills the panel's height, so it lines up with the panel beside it.
  const [ref, width, height] = useSize<HTMLDivElement>()
  const { t, money, moneyShort } = useI18n()
  const [active, setActive] = useState<number | null>(null)

  const busy = hours.flatMap((h, i) => (h.current > 0 || h.previous > 0 ? [i] : []))
  const start = busy.length ? Math.min(busy[0], 8) : 8
  const end = busy.length ? Math.max(busy[busy.length - 1] + 1, 20) : 20
  const shown = Array.from({ length: end - start }, (_, i) => start + i)
  const max = niceMax(Math.max(...shown.map((h) => Math.max(hours[h].current, hours[h].previous)), 1) * 1.08)
  const TOP = 20
  const AXIS = 24
  const PLOT = Math.max(height - TOP - AXIS, 120)
  const slot = width / shown.length
  const barW = Math.max(4, Math.min(22, slot * 0.56))
  const y = (v: number) => TOP + PLOT - (v / max) * PLOT
  const peak = shown.reduce((best, h) => (hours[h].current > hours[best].current ? h : best), shown[0])
  const hasSales = shown.some((h) => hours[h].current > 0)
  const labelEvery = slot >= 40 ? 1 : slot >= 20 ? 2 : 3
  const range = (h: number) => t('dashboard.hourRange', { from: hourLabel(h), to: hourLabel(h + 1) })

  return (
    <div className="ld-hours">
      {hasSales && <p className="ld-hours-insight">{t('dashboard.busiestSoFar', { hour: range(peak), amount: money(hours[peak].current) })}</p>}
      <ul className="ld-thread-legend" aria-hidden="true">
        <li><span className="ld-swatch-block" />{labels.current}</li>
        <li><span className="ld-swatch-tick" />{labels.previous}</li>
      </ul>
      <div ref={ref} dir="ltr" className="ld-hours-plot" onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={TOP + PLOT + AXIS} role="group" aria-label={t('dashboard.ov.hours')}>
            <line className="ld-thread-axis" x1={0} x2={width} y1={TOP + PLOT} y2={TOP + PLOT} />
            {shown.map((h, i) => {
              const cx = i * slot + slot / 2
              const { current, previous } = hours[h]
              const label = `${range(h)}: ${labels.current} ${money(current)}, ${labels.previous} ${money(previous)}`
              return (
                <g key={h} className={`ld-hours-col${active === h ? ' is-active' : ''}${nowHour !== null && h > nowHour ? ' is-future' : ''}`}>
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
                  {current > 0 && <path className="ld-hours-bar" d={roundedTop(cx - barW / 2, y(current), barW, TOP + PLOT - y(current), Math.min(4, barW / 2))} />}
                  {previous > 0 && <line className="ld-hours-avg" x1={cx - barW / 2 - 4} x2={cx + barW / 2 + 4} y1={y(previous)} y2={y(previous)} />}
                  {h === peak && current > 0 && (
                    <text className="ld-thread-label-strong" x={cx} y={y(current) - 8} textAnchor="middle">{moneyShort(current)}</text>
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
          <div className="ld-tip" role="presentation" style={{ left: Math.min(Math.max((shown.indexOf(active) + 0.5) * slot, 80), width - 80), top: 0 }}>
            <strong>{range(active)}</strong>
            <span><i className="ld-tip-key is-today" />{money(hours[active].current)} <em>{labels.current}</em></span>
            <span><i className="ld-tip-key is-avg" />{money(hours[active].previous)} <em>{labels.previous}</em></span>
          </div>
        )}
      </div>
      {!hasSales && <p className="ld-empty">{t('dashboard.noSalesHours')}</p>}
    </div>
  )
}

/** A bar path with a rounded data end (top) and a square baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isToday } from 'date-fns'
import './dashboard.css'
import './overview.css'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { change, expiryStatus, isRangeKey, RANGE_KEYS, type Overview, type RangeKey } from '@/lib/domain'
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown, RefreshCw } from 'lucide-react'
import { ChartLegend, ComparisonLine, HourBars, RankBars } from './OverviewCharts'
import { MethodList } from '@/components/ui/badges'
import EndOfDaySummary, { type DaySummary } from './EndOfDaySummary'
import DayThread from './DayThread'
import { hourLabel, shapeDay } from './dayMath'

interface Bill {
  id: string
  invoiceNo: string
  date: string
  totalAmount: number
  amountPaid: number
  paymentMethod: string
  customerName: string | null
  processedBy: { name: string } | null
  payments?: Array<{ method: string }>
  _count: { items: number }
}

type Metric = 'sales' | 'orders' | 'averageSale' | 'profit'

/** Today's sales by hour against an average day of the past week, for the day thread chart. */
interface TodayAnalytics {
  todayByHour: number[]
  averageByHour: number[]
  comparedDays: number
}

const REFRESH_MS = 2 * 60 * 1000
const RANGE_STORAGE = 'loompos.dashboard.range'

/** The last period picked, if the browser lets us read it. */
function savedRange(): RangeKey {
  try {
    const value = window.localStorage.getItem(RANGE_STORAGE)
    return isRangeKey(value) ? value : 'today'
  } catch {
    return 'today'
  }
}

/**
 * The manager's overview, laid out like a commerce admin's analytics page: a period picker,
 * one card with a tab per key figure and its chart against the previous period, then a grid
 * of report cards.
 */
export default function Dashboard() {
  const navigate = useNavigate()
  const { lowStockProducts, expiringProducts, fetchLowStockAlerts } = useStore()
  const i18n = useI18n()
  const { t, money, moneyShort, qty, code } = i18n

  const [range, setRange] = useState<RangeKey>(savedRange)
  const [metric, setMetric] = useState<Metric>('sales')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [bills, setBills] = useState<Bill[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [showEOD, setShowEOD] = useState(false)
  const [today, setToday] = useState<TodayAnalytics | null>(null)
  // Only the newest request may update the page: a slow answer for an old period is dropped.
  const latest = useRef(0)

  const load = useCallback(async (key: RangeKey) => {
    const ticket = ++latest.current
    setRefreshing(true)
    const [o, s, b, td] = await Promise.allSettled([
      api<Overview>('/analytics/overview', { query: { range: key } }),
      api<DaySummary>('/analytics/summary'),
      api<{ orders: Bill[] }>('/orders', { query: { limit: 6 } }),
      api<TodayAnalytics>('/analytics/today'),
      fetchLowStockAlerts(),
    ])
    if (ticket !== latest.current) return
    if (o.status === 'fulfilled') setOverview(o.value)
    if (s.status === 'fulfilled') setSummary(s.value)
    if (b.status === 'fulfilled') setBills(b.value.orders)
    if (td.status === 'fulfilled') setToday(td.value)
    setUpdatedAt(new Date())
    setRefreshing(false)
    setStatus((prev) => (o.status === 'fulfilled' || prev === 'ready' ? 'ready' : 'failed'))
  }, [fetchLowStockAlerts])

  useEffect(() => {
    load(range)
    const timer = window.setInterval(() => load(range), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load, range])

  const shape = useMemo(() => (today ? shapeDay(today.todayByHour, today.averageByHour, updatedAt) : null), [today, updatedAt])

  const pickRange = (key: RangeKey) => {
    setRange(key)
    try {
      window.localStorage.setItem(RANGE_STORAGE, key)
    } catch {
      // Private windows may refuse storage; the choice then lasts until the page closes.
    }
  }

  if (status === 'loading' && !overview) {
    return (
      <div className="loom-dash sp" aria-busy="true" aria-label={t('dashboard.loadingLabel')}>
        <div className="sp-skeleton" style={{ height: 28, width: 180 }} />
        <div className="sp-skeleton" style={{ height: 32, width: 260 }} />
        <div className="sp-skeleton" style={{ height: 420 }} />
        <div className="sp-grid">
          {[0, 1, 2].map((i) => <div key={i} className="sp-skeleton" style={{ height: 300 }} />)}
        </div>
      </div>
    )
  }

  if (status === 'failed' || !overview) {
    return (
      <div className="loom-dash sp">
        <div className="sp-card sp-alert" role="alert">
          <p>{t('dashboard.ov.loadError')}</p>
          <button className="sp-btn" onClick={() => { setStatus('loading'); load(range) }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const o = overview
  // While another period loads, the last one stays on screen, dimmed.
  const stale = o.range !== range
  const from = new Date(o.from)
  const lastCurrent = new Date(new Date(o.to).getTime() - 1)
  const previousFrom = new Date(o.previousFrom)
  const previousEnd = new Date(new Date(o.compareTo).getTime() - 1)
  const singleDay = o.granularity === 'hour'
  const span = (a: Date, b: Date) => (singleDay ? i18n.date(a, 'medium') : `${i18n.date(a, 'dayShort')} – ${i18n.date(b, 'medium')}`)
  const legend = { current: span(from, lastCurrent), previous: span(previousFrom, previousEnd) }
  const compareName =
    o.range === 'today'
      ? t('dashboard.ov.compareToday', { time: i18n.time(new Date(o.compareTo)) })
      : o.range === 'yesterday'
        ? t('dashboard.ov.compareYesterday')
        : t('dashboard.ov.comparePeriod', { from: i18n.date(previousFrom, 'dayShort'), to: i18n.date(previousEnd, 'dayShort') })

  const tone = (v: number) => (v > 0 ? 'gain' : v < 0 ? 'loss' : undefined)
  const metrics: Array<{ key: Metric; title: string; hint: string; value: number; previous: number; change: number | null; format: (v: number) => string; tone?: 'gain' | 'loss' }> = [
    { key: 'sales', title: t('dashboard.ov.netSales'), hint: t('dashboard.ov.netSalesHint'), value: o.totals.netSales, previous: o.previous.netSales, change: o.change.netSales, format: (v) => money(v) },
    { key: 'orders', title: t('dashboard.ov.orders'), hint: t('dashboard.ov.ordersHint'), value: o.totals.orders, previous: o.previous.orders, change: o.change.orders, format: (v) => i18n.number(v, 1) },
    { key: 'averageSale', title: t('dashboard.ov.averageSale'), hint: t('dashboard.ov.averageSaleHint'), value: o.totals.averageSale, previous: o.previous.averageSale, change: o.change.averageSale, format: (v) => money(v) },
    { key: 'profit', title: t('dashboard.ov.grossProfit'), hint: t('dashboard.ov.grossProfitHint'), value: o.totals.profit, previous: o.previous.profit, change: o.change.profit, format: (v) => money(v), tone: tone(o.totals.profit) },
  ]
  const pointsOf = (key: Metric) => o.series.map((p) => ({ at: p.at, previousAt: p.previousAt, value: p[key], previous: p.previous[key] }))
  const shown = metrics.find((m) => m.key === metric) ?? metrics[0]
  const nowHour = o.range === 'today' ? new Date(o.to).getHours() : null
  const moneyIn = o.methods.reduce((sum, m) => sum + m.amount, 0)
  const busiest = o.hours.reduce((best, h, i) => (h.current > o.hours[best].current ? i : best), 0)

  // Arrow keys move between the metric tabs, in reading order.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const forward = (e.key === 'ArrowRight') !== (i18n.dir === 'rtl')
    const index = metrics.findIndex((m) => m.key === metric)
    const next = metrics[(index + (forward ? 1 : metrics.length - 1)) % metrics.length]
    setMetric(next.key)
    document.getElementById(`sp-tab-${next.key}`)?.focus()
    e.preventDefault()
  }

  return (
    <div className="loom-dash sp">
      <header className="sp-head">
        <h1 className="sp-title">{t('dashboard.ov.title')}</h1>
        <div className="sp-head-actions">
          <span className="sp-subdued">{t('dashboard.ov.updated', { time: i18n.time(updatedAt) })}</span>
          <button className="sp-btn sp-btn-icon" onClick={() => load(range)} aria-label={t('dashboard.ov.refresh')} title={t('dashboard.ov.refresh')}>
            <RefreshCw size={16} className={refreshing ? 'sp-spin' : undefined} aria-hidden="true" />
          </button>
          <button className="sp-btn sp-btn-primary" onClick={() => setShowEOD(true)} disabled={!summary}>
            {t('dashboard.closeDay')}
          </button>
        </div>
      </header>

      <div className="sp-filters">
        <RangePicker value={range} onChange={pickRange} />
        <span className="sp-chip">{t('dashboard.ov.compareTo', { label: compareName })}</span>
      </div>

      <div className={`sp-body${stale ? ' is-stale' : ''}`} aria-busy={stale}>
        <section className="sp-card sp-main" aria-label={t('dashboard.ov.overTime', { metric: shown.title })}>
          <div className="sp-tabs" role="tablist" aria-label={t(`dashboard.ov.ranges.${o.range}`)} onKeyDown={onTabKey}>
            {metrics.map((m) => (
              <button
                key={m.key}
                id={`sp-tab-${m.key}`}
                type="button"
                role="tab"
                aria-selected={metric === m.key}
                aria-controls="sp-main-chart"
                tabIndex={metric === m.key ? 0 : -1}
                className="sp-tab"
                onClick={() => setMetric(m.key)}
              >
                <span className="sp-metric-title" title={m.hint}>{m.title}</span>
                <span className="sp-tab-row">
                  <span className={`sp-tab-value${m.tone ? ` sp-${m.tone}` : ''}`}>{m.format(m.value)}</span>
                  <Change value={m.change} />
                </span>
                <ComparisonLine compact points={pointsOf(m.key)} granularity={o.granularity} format={m.format} labels={legend} title={m.title} />
              </button>
            ))}
          </div>
          <div id="sp-main-chart" role="tabpanel" aria-labelledby={`sp-tab-${shown.key}`} className="sp-main-chart">
            {/* Today's net sales: the running total through the day against an average day. */}
            {o.range === 'today' && metric === 'sales' && shape && today ? (
              <>
                <Comparison shape={shape} comparedDays={today.comparedDays} orderCount={o.totals.orders} />
                <DayThread shape={shape} comparedDays={today.comparedDays} now={updatedAt} />
              </>
            ) : (
              <>
                <ComparisonLine
                  points={pointsOf(metric)}
                  granularity={o.granularity}
                  format={shown.format}
                  formatAxis={metric === 'orders' ? (v) => i18n.number(v, 1) : moneyShort}
                  labels={legend}
                  title={t('dashboard.ov.chartLabel', { title: shown.title, value: shown.format(shown.value), previous: shown.format(shown.previous) })}
                />
                <ChartLegend current={legend.current} previous={legend.previous} />
              </>
            )}
          </div>
        </section>

        <div className="sp-grid">
          <Card id="breakdown" title={t('dashboard.ov.breakdown')} hint={t('dashboard.ov.netSalesHint')} link={{ to: '/reports', label: t('dashboard.ov.viewReport') }}>
            <dl className="sp-rows">
              <Row label={t('dashboard.ov.grossSales')} value={o.totals.grossSales} previous={o.previous.grossSales} />
              <Row label={t('dashboard.ov.discounts')} value={o.totals.discounts} previous={o.previous.discounts} minus />
              <Row label={t('dashboard.ov.returns')} value={o.totals.returns} previous={o.previous.returns} minus />
              <Row label={t('dashboard.ov.netSales')} value={o.totals.netSales} previous={o.previous.netSales} total />
              <Row label={t('dashboard.ov.tax')} value={o.totals.tax} previous={o.previous.tax} minus />
              <Row label={t('dashboard.ov.cost')} value={o.totals.cost} previous={o.previous.cost} minus />
              <Row label={t('dashboard.ov.grossProfit')} value={o.totals.profit} previous={o.previous.profit} total tone={tone(o.totals.profit)} />
            </dl>
          </Card>

          <Card id="methods" title={t('dashboard.ov.paymentMethods')} hint={t('dashboard.ov.paymentHint')} headline={money(moneyIn)}>
            <RankBars empty={t('dashboard.noPayments')} rows={o.methods.map((m) => ({ key: m.method, name: i18n.method(m.method), value: m.amount }))} />
          </Card>

          <Card id="categories" title={t('dashboard.byCategory')} headline={money(o.categories.reduce((s, c) => s + c.revenue, 0))}>
            <RankBars
              empty={t('dashboard.noCategories')}
              rows={o.categories.map((c) => ({ key: c.category ?? '\u0000other', name: c.category ? <bdi>{c.category}</bdi> : t('dashboard.otherCategories'), value: c.revenue, other: !c.category }))}
            />
          </Card>

          <Card id="products" title={t('dashboard.ov.topProducts')} link={{ to: '/inventory', label: t('dashboard.ov.viewReport') }}>
            <RankBars
              empty={t('dashboard.ov.empty')}
              rows={o.topProducts.map((p) => ({ key: p.productId, name: <bdi>{p.name}</bdi>, value: p.revenue, detail: t('dashboard.sold', { qty: qty(p.quantity, p.unit, true) }) }))}
            />
          </Card>

          <Card
            id="hours"
            title={t('dashboard.ov.hours')}
            headline={o.hours[busiest].current > 0 ? t('dashboard.ov.busiest', { hour: `\u2066${t('dashboard.hourRange', { from: hourLabel(busiest), to: hourLabel(busiest + 1) })}\u2069` }) : undefined}
            className="sp-card-chart"
          >
            {o.totals.orders > 0 ? <HourBars values={o.hours.map((h) => h.current)} nowHour={nowHour} /> : <p className="sp-empty">{t('dashboard.noSalesHours')}</p>}
          </Card>

          <Card id="alerts" title={t('dashboard.ov.alerts')} link={{ to: '/inventory', label: t('dashboard.openInventory') }}>
            {lowStockProducts.length || expiringProducts.length ? (
              <ul className="sp-list">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <li key={`low-${p.id}`} className="sp-list-row">
                    <Link className="sp-list-name" to={`/inventory?search=${encodeURIComponent(p.barcode)}`}><bdi>{p.name}</bdi></Link>
                    <span className={`sp-badge ${p.stock <= 0 ? 'is-critical' : 'is-warning'}`}>
                      {p.stock <= 0 ? t('dashboard.soldOut') : t('dashboard.left', { qty: qty(p.stock, p.unit, true) })}
                    </span>
                  </li>
                ))}
                {expiringProducts.slice(0, 3).map((p) => (
                  <li key={`exp-${p.id}`} className="sp-list-row">
                    <Link className="sp-list-name" to={`/inventory?search=${encodeURIComponent(p.barcode)}`}><bdi>{p.name}</bdi></Link>
                    <ExpiryText value={p.expiryDate} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sp-empty">{t('dashboard.ov.noAlerts')}</p>
            )}
          </Card>

          <Card id="credit" title={t('dashboard.ov.credit')} headline={money(o.owedByCustomers)} headlineNote={t('dashboard.ov.owedNow')} link={{ to: '/customers', label: t('dashboard.ov.seeCustomers') }}>
            <dl className="sp-rows">
              <Row label={t('dashboard.ov.creditGiven')} value={o.totals.creditGiven} previous={o.previous.creditGiven} invert />
              <Row label={t('dashboard.ov.repaid')} value={o.totals.repayments} previous={o.previous.repayments} />
            </dl>
          </Card>

          <Card id="bills" title={t('dashboard.latestBills')} className="sp-span-2" link={{ to: '/orders', label: t('dashboard.seeAll') }}>
            {bills?.length ? (
              <div className="sp-table-wrap">
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('dashboard.receipt')}</th>
                      <th scope="col">{t('dashboard.time')}</th>
                      <th scope="col">{t('dashboard.customer')}</th>
                      <th scope="col">{t('dashboard.paidBy')}</th>
                      <th scope="col" className="sp-num">{t('dashboard.items')}</th>
                      <th scope="col" className="sp-num">{t('dashboard.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => {
                      const when = new Date(bill.date)
                      const methods = [...(bill.payments ?? []).map((p) => p.method), ...(bill.totalAmount - bill.amountPaid > 0.004 ? ['CREDIT'] : [])]
                      return (
                        <tr key={bill.id} onClick={() => navigate(`/orders?orderId=${bill.id}`)}>
                          <td>
                            <Link className="sp-strong-link" to={`/orders?orderId=${bill.id}`} onClick={(e) => e.stopPropagation()}>{code(bill.invoiceNo)}</Link>
                          </td>
                          <td className="sp-subdued">{isToday(when) ? i18n.time(when) : i18n.date(when, 'medium')}</td>
                          <td>{bill.customerName || <span className="sp-subdued">{t('common.walkIn')}</span>}</td>
                          <td><MethodList methods={methods.length ? methods : [bill.paymentMethod]} /></td>
                          <td className="sp-num">{i18n.number(bill._count.items)}</td>
                          <td className="sp-num">{money(bill.totalAmount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="sp-empty">
                {t('dashboard.noBills')} <Link className="sp-link" to="/billing">{t('dashboard.openBilling')}</Link>
              </p>
            )}
          </Card>
        </div>
      </div>

      {showEOD && summary && <EndOfDaySummary summary={summary} onClose={() => setShowEOD(false)} />}
    </div>
  )
}

/** The period picker: a button with the chosen period that opens the list of periods. */
function RangePicker({ value, onChange }: { value: RangeKey; onChange: (key: RangeKey) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    box.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') items[(at + 1) % items.length]?.focus()
    else if (e.key === 'ArrowUp') items[(at - 1 + items.length) % items.length]?.focus()
    else return
    e.preventDefault()
  }

  return (
    <div className="sp-picker" ref={box} onKeyDown={open ? onMenuKey : undefined}>
      <button ref={button} type="button" className="sp-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`${t('dashboard.ov.rangeLabel')}: ${t(`dashboard.ov.ranges.${value}`)}`} onClick={() => setOpen(!open)}>
        <CalendarDays size={16} aria-hidden="true" />
        {t(`dashboard.ov.ranges.${value}`)}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="sp-menu" role="menu" aria-label={t('dashboard.ov.rangeLabel')}>
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="menuitemradio"
              aria-checked={value === key}
              className="sp-menu-item"
              onClick={() => {
                onChange(key)
                close()
              }}
            >
              <span>{t(`dashboard.ov.ranges.${key}`)}</span>
              {value === key && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** A report card: title (dotted underline when it has an explanation), optional headline figure and a link to the full report. */
function Card({
  id,
  title,
  hint,
  headline,
  headlineNote,
  link,
  className,
  children,
}: {
  id: string
  title: string
  hint?: string
  headline?: ReactNode
  headlineNote?: string
  link?: { to: string; label: string }
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`sp-card${className ? ` ${className}` : ''}`} aria-labelledby={`sp-${id}-title`}>
      <div className="sp-card-head">
        <h2 id={`sp-${id}-title`} className={`sp-card-title${hint ? ' sp-metric-title' : ''}`} title={hint}>{title}</h2>
        {link && <Link className="sp-link sp-card-link" to={link.to}>{link.label}</Link>}
      </div>
      {headline && (
        <p className="sp-headline">
          {headline}
          {headlineNote && <span className="sp-subdued">{headlineNote}</span>}
        </p>
      )}
      <div className="sp-card-body">{children}</div>
    </section>
  )
}

/**
 * The change against the previous period: an arrow and a percent, green when it is good news
 * and red when it is bad; a dash when there is nothing to compare with. Neutral changes keep
 * the arrow but no color, for lines that are neither good nor bad.
 */
function Change({ value, invert = false, neutral = false }: { value: number | null; invert?: boolean; neutral?: boolean }) {
  const { t, percent } = useI18n()
  if (value === null) return <span className="sp-change" title={t('dashboard.ov.noEarlier')} aria-label={t('dashboard.ov.noEarlier')}>—</span>
  const rounded = Math.round(Math.abs(value) * 100)
  const text = percent(rounded)
  if (rounded === 0) return <span className="sp-change">{text}</span>
  const up = value > 0
  const good = invert ? !up : up
  return (
    <span className={`sp-change ${neutral ? '' : good ? 'is-good' : 'is-bad'}`} aria-label={t(up ? 'dashboard.ov.up' : 'dashboard.ov.down', { percent: text })}>
      {up ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
      {text}
    </span>
  )
}

/** One line of a money breakdown: deductions with a minus sign, totals in bold on a rule. Deductions follow sales up and down, so their change is not colored. */
function Row({ label, value, previous, minus = false, invert = false, total = false, tone }: { label: string; value: number; previous?: number; minus?: boolean; invert?: boolean; total?: boolean; tone?: 'gain' | 'loss' }) {
  const { money } = useI18n()
  return (
    <div className={`sp-row${total ? ' is-total' : ''}`}>
      <dt>{label}</dt>
      <dd className={`sp-row-value${tone ? ` sp-${tone}` : ''}`}>{minus && value !== 0 ? money(-value) : money(value)}</dd>
      <dd className="sp-row-change">{previous !== undefined && <Change value={change(value, previous)} invert={invert} neutral={minus} />}</dd>
    </div>
  )
}

/** Where a product stands against its expiry date, as a badge: red once expired, amber when close. */
function ExpiryText({ value }: { value?: string | null }) {
  const { t } = useI18n()
  const status = expiryStatus(value)
  if (!status || status.state === 'ok') return null
  const label =
    status.state === 'expired' ? t('inventory.expiry.expired', { count: -status.days }) : status.state === 'today' ? t('inventory.expiry.today') : t('inventory.expiry.soon', { count: status.days })
  return <span className={`sp-badge ${status.state === 'expired' ? 'is-critical' : 'is-warning'}`}>{label}</span>
}

/** One line comparing today so far with an average day by this time. */
function Comparison({ shape, comparedDays, orderCount }: { shape: ReturnType<typeof shapeDay>; comparedDays: number; orderCount: number }) {
  const { t, money, tx } = useI18n()
  if (orderCount === 0) return <p className="sp-compare">{t('dashboard.noBillsYet')}</p>
  if (comparedDays === 0) return <p className="sp-compare">{t('dashboard.notEnoughHistory')}</p>
  const gap = shape.todayTotal - shape.averageByNow
  const closeEnough = Math.abs(gap) < Math.max(shape.averageByNow * 0.02, 50)
  const when = shape.nowAt >= shape.end ? t('dashboard.forWholeDay') : t('dashboard.byThisTime')
  if (closeEnough) return <p className="sp-compare">{t('dashboard.level', { when })}</p>
  return (
    <p className="sp-compare">
      {tx(gap > 0 ? 'dashboard.ahead' : 'dashboard.behind', {
        amount: <strong className={gap < 0 ? 'sp-loss' : 'sp-gain'}>{money(Math.abs(gap))}</strong>,
        when,
      })}
    </p>
  )
}

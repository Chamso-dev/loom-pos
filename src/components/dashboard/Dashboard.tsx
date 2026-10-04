import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isToday } from 'date-fns'
import './dashboard.css'
import './overview.css'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { change, expiryStatus, isRangeKey, RANGE_KEYS, type Overview, type RangeKey } from '@/lib/domain'
import { ArrowDownRight, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react'
import { ChartLegend, ComparisonLine, HourBars, RankBars, ShareBar } from './OverviewCharts'
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

/** Today's sales by hour against an average day of the past week, for the day thread chart. */
interface TodayAnalytics {
  todayByHour: number[]
  averageByHour: number[]
  comparedDays: number
}

type Metric = 'sales' | 'orders' | 'averageSale' | 'profit'

const REFRESH_MS = 2 * 60 * 1000
const RANGE_STORAGE = 'loompos.dashboard.range'
const METHOD_CLASS: Record<string, string> = {
  CASH: 'dx-m-cash',
  CIB: 'dx-m-cib',
  EDAHABIA: 'dx-m-edahabia',
  BARIDIMOB: 'dx-m-baridimob',
  TRANSFER: 'dx-m-transfer',
}

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
 * The manager's view of the shop: the chosen figure large in a cobalt panel with its chart
 * (today's running total against an average day, or this period against the previous one),
 * the other figures beside it, and the shop's details in a grid below.
 */
export default function Dashboard() {
  const navigate = useNavigate()
  const { lowStockProducts, expiringProducts, fetchLowStockAlerts } = useStore()
  const i18n = useI18n()
  const { t, money, moneyShort, qty, code } = i18n

  const [range, setRange] = useState<RangeKey>(savedRange)
  const [metric, setMetric] = useState<Metric>('sales')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [today, setToday] = useState<TodayAnalytics | null>(null)
  const [bills, setBills] = useState<Bill[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [dayEnd, setDayEnd] = useState<{ open: boolean; loading: boolean; summary: DaySummary | null }>({ open: false, loading: false, summary: null })
  // The request in flight; a newer one cancels it, so a slow answer for an old period never lands.
  const inFlight = useRef<AbortController | null>(null)
  const loadedAt = useRef(0)

  const load = useCallback(async (key: RangeKey) => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const { signal } = controller
    setRefreshing(true)
    const [o, b, td] = await Promise.allSettled([
      api<Overview>('/analytics/overview', { query: { range: key }, signal }),
      api<{ orders: Bill[] }>('/orders', { query: { limit: 6 }, signal }),
      // The average-day chart is only drawn for today.
      key === 'today' ? api<TodayAnalytics>('/analytics/today', { signal }) : Promise.resolve(null),
    ])
    if (signal.aborted) return
    if (o.status === 'fulfilled') setOverview(o.value)
    if (b.status === 'fulfilled') setBills(b.value.orders)
    if (td.status === 'fulfilled' && td.value) setToday(td.value)
    loadedAt.current = Date.now()
    setUpdatedAt(new Date())
    setRefreshing(false)
    setStatus((prev) => (o.status === 'fulfilled' || prev === 'ready' ? 'ready' : 'failed'))
  }, [])

  useEffect(() => {
    load(range)
    return () => inFlight.current?.abort()
  }, [load, range])

  // Refresh every two minutes while the page is on screen; a hidden tab makes no requests and
  // catches up as soon as it is shown again.
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return
      load(range)
      fetchLowStockAlerts()
    }
    const timer = window.setInterval(refresh, REFRESH_MS)
    const onShow = () => {
      if (!document.hidden && Date.now() - loadedAt.current > REFRESH_MS) refresh()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [load, range, fetchLowStockAlerts])

  const pickRange = (key: RangeKey) => {
    setRange(key)
    try {
      window.localStorage.setItem(RANGE_STORAGE, key)
    } catch {
      // Private windows may refuse storage; the choice then lasts until the page closes.
    }
  }

  // The day's closing figures are only needed when the dialog opens.
  const openDayEnd = async () => {
    setDayEnd((d) => ({ ...d, loading: true }))
    try {
      const summary = await api<DaySummary>('/analytics/summary')
      setDayEnd({ open: true, loading: false, summary })
    } catch {
      setDayEnd((d) => ({ ...d, loading: false }))
    }
  }

  const shape = useMemo(() => (today ? shapeDay(today.todayByHour, today.averageByHour, updatedAt) : null), [today, updatedAt])
  const series = useMemo(() => {
    const pointsOf = (key: Metric) => (overview?.series ?? []).map((p) => ({ at: p.at, previousAt: p.previousAt, value: p[key], previous: p.previous[key] }))
    return { sales: pointsOf('sales'), orders: pointsOf('orders'), averageSale: pointsOf('averageSale'), profit: pointsOf('profit') }
  }, [overview])

  if (status === 'loading' && !overview) {
    return (
      <div className="loom-dash dx" aria-busy="true" aria-label={t('dashboard.loadingLabel')}>
        <div className="dx-skeleton" style={{ height: 40, width: 280 }} />
        <div className="dx-skeleton" style={{ height: 44, width: 420, maxWidth: '100%' }} />
        <div className="dx-bento">
          <div className="dx-skeleton dx-hero-slot" style={{ minHeight: 420 }} />
          <div className="dx-skeleton dx-stats-slot" style={{ minHeight: 420 }} />
        </div>
      </div>
    )
  }

  if (status === 'failed' || !overview) {
    return (
      <div className="loom-dash dx">
        <div className="dx-cell dx-alert" role="alert">
          <p>{t('dashboard.ov.loadError')}</p>
          <button className="dx-btn" onClick={() => { setStatus('loading'); load(range) }}>
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
  const shown = metrics.find((m) => m.key === metric) ?? metrics[0]
  const nowHour = o.range === 'today' ? new Date(o.to).getHours() : null
  const busiest = o.hours.reduce((best, h, i) => (h.current > o.hours[best].current ? i : best), 0)
  const showThread = o.range === 'today' && metric === 'sales' && shape && today

  return (
    <div className="loom-dash dx">
      <header className="dx-head">
        <div>
          <h1 className="dx-title">{i18n.date(updatedAt, 'dayMonth')}</h1>
          <p className="dx-sub">{t('dashboard.ov.updated', { time: i18n.time(updatedAt) })}</p>
        </div>
        <div className="dx-head-actions">
          <button className="dx-btn dx-btn-icon" onClick={() => load(range)} aria-label={t('dashboard.ov.refresh')} title={t('dashboard.ov.refresh')}>
            <RefreshCw size={16} className={refreshing ? 'dx-spin' : undefined} aria-hidden="true" />
          </button>
          <button className="dx-btn dx-btn-primary" onClick={openDayEnd} disabled={dayEnd.loading}>
            {dayEnd.loading && <Loader2 size={16} className="dx-spin" aria-hidden="true" />}
            {t('dashboard.closeDay')}
          </button>
        </div>
      </header>

      <div className="dx-periods">
        <div className="dx-segmented" role="group" aria-label={t('dashboard.ov.rangeLabel')}>
          {RANGE_KEYS.map((key) => (
            <button key={key} type="button" aria-pressed={range === key} onClick={() => pickRange(key)}>
              {t(`dashboard.ov.ranges.${key}`)}
            </button>
          ))}
        </div>
        <span className="dx-compare-to">{t('dashboard.ov.compareTo', { label: compareName })}</span>
      </div>

      <div className={`dx-bento${stale ? ' is-stale' : ''}`} aria-busy={stale}>
        <section className="dx-hero" aria-labelledby="dx-hero-title">
          <div className="dx-hero-top">
            <h2 id="dx-hero-title" className="dx-hero-title">{shown.title}</h2>
            <Change value={shown.change} onDark />
          </div>
          <p className="dx-hero-value">{shown.format(shown.value)}</p>
          {showThread ? (
            <>
              <Comparison shape={shape} comparedDays={today.comparedDays} orderCount={o.totals.orders} />
              <DayThread shape={shape} comparedDays={today.comparedDays} now={updatedAt} height={290} />
            </>
          ) : (
            <>
              <p className="dx-hero-note">{t('dashboard.ov.previousValue', { value: shown.format(shown.previous) })}</p>
              <ComparisonLine
                points={series[metric]}
                granularity={o.granularity}
                format={shown.format}
                formatAxis={metric === 'orders' ? (v) => i18n.number(v, 1) : moneyShort}
                labels={legend}
                height={290}
                title={t('dashboard.ov.chartLabel', { title: shown.title, value: shown.format(shown.value), previous: shown.format(shown.previous) })}
              />
              <ChartLegend current={legend.current} previous={legend.previous} />
            </>
          )}
          {o.totals.orders === 0 && <p className="dx-hero-note">{t('dashboard.ov.empty')}</p>}
        </section>

        <div className="dx-stats" role="group" aria-label={t('dashboard.ov.rangeLabel')}>
          {metrics.map((m) => (
            <button key={m.key} type="button" className="dx-stat" aria-pressed={metric === m.key} title={m.hint} onClick={() => setMetric(m.key)}>
              <span className="dx-stat-title">{m.title}</span>
              <span className={`dx-stat-value${m.tone ? ` dx-${m.tone}` : ''}`}>{m.format(m.value)}</span>
              <Change value={m.change} />
              <ComparisonLine compact points={series[m.key]} granularity={o.granularity} format={m.format} labels={legend} title={m.title} />
            </button>
          ))}
        </div>

        <Cell id="hours" title={t('dashboard.ov.hours')} className="dx-span-5" note={o.hours[busiest].current > 0 ? t('dashboard.ov.busiest', { hour: `⁦${t('dashboard.hourRange', { from: hourLabel(busiest), to: hourLabel(busiest + 1) })}⁩` }) : undefined}>
          {o.totals.orders > 0 ? <HourBars values={o.hours.map((h) => h.current)} nowHour={nowHour} /> : <p className="dx-empty">{t('dashboard.noSalesHours')}</p>}
        </Cell>

        <Cell id="methods" title={t('dashboard.ov.paymentMethods')} className="dx-span-4" note={t('dashboard.ov.paymentHint')}>
          <ShareBar
            empty={t('dashboard.noPayments')}
            parts={o.methods.map((m) => ({ key: m.method, name: i18n.method(m.method), value: m.amount }))}
            colorOf={(key) => METHOD_CLASS[key] ?? 'dx-m-transfer'}
          />
        </Cell>

        <Cell id="alerts" title={t('dashboard.ov.alerts')} className="dx-span-3" link={{ to: '/inventory', label: t('dashboard.openInventory') }}>
          {lowStockProducts.length || expiringProducts.length ? (
            <ul className="dx-list">
              {lowStockProducts.slice(0, 4).map((p) => (
                <li key={`low-${p.id}`}>
                  <Link className="dx-list-name" to={`/inventory?search=${encodeURIComponent(p.barcode)}`}><bdi>{p.name}</bdi></Link>
                  <span className={`dx-flag ${p.stock <= 0 ? 'is-critical' : 'is-warning'}`}>
                    {p.stock <= 0 ? t('dashboard.soldOut') : t('dashboard.left', { qty: qty(p.stock, p.unit, true) })}
                  </span>
                </li>
              ))}
              {expiringProducts.slice(0, 3).map((p) => (
                <li key={`exp-${p.id}`}>
                  <Link className="dx-list-name" to={`/inventory?search=${encodeURIComponent(p.barcode)}`}><bdi>{p.name}</bdi></Link>
                  <ExpiryFlag value={p.expiryDate} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="dx-empty">{t('dashboard.ov.noAlerts')}</p>
          )}
        </Cell>

        <Cell id="products" title={t('dashboard.ov.topProducts')} className="dx-span-4 dx-deferred">
          <RankBars
            empty={t('dashboard.ov.empty')}
            rows={o.topProducts.map((p) => ({ key: p.productId, name: <bdi>{p.name}</bdi>, value: p.revenue, detail: t('dashboard.sold', { qty: qty(p.quantity, p.unit, true) }) }))}
          />
        </Cell>

        <Cell id="categories" title={t('dashboard.byCategory')} className="dx-span-4 dx-deferred">
          <RankBars
            empty={t('dashboard.noCategories')}
            rows={o.categories.map((c) => ({ key: c.category ?? '\u0000other', name: c.category ? <bdi>{c.category}</bdi> : t('dashboard.otherCategories'), value: c.revenue, other: !c.category }))}
          />
        </Cell>

        <Cell id="breakdown" title={t('dashboard.ov.breakdown')} className="dx-span-4 dx-deferred" link={{ to: '/reports', label: t('dashboard.ov.viewReport') }}>
          <dl className="dx-rows">
            <Row label={t('dashboard.ov.grossSales')} value={o.totals.grossSales} previous={o.previous.grossSales} />
            <Row label={t('dashboard.ov.discounts')} value={o.totals.discounts} previous={o.previous.discounts} minus />
            <Row label={t('dashboard.ov.returns')} value={o.totals.returns} previous={o.previous.returns} minus />
            <Row label={t('dashboard.ov.netSales')} value={o.totals.netSales} previous={o.previous.netSales} total />
            <Row label={t('dashboard.ov.tax')} value={o.totals.tax} previous={o.previous.tax} minus />
            <Row label={t('dashboard.ov.cost')} value={o.totals.cost} previous={o.previous.cost} minus />
            <Row label={t('dashboard.ov.grossProfit')} value={o.totals.profit} previous={o.previous.profit} total tone={tone(o.totals.profit)} />
          </dl>
        </Cell>

        <Cell id="bills" title={t('dashboard.latestBills')} className="dx-span-8 dx-deferred" link={{ to: '/orders', label: t('dashboard.seeAll') }}>
          {bills?.length ? (
            <div className="dx-table-wrap">
              <table className="dx-table">
                <thead>
                  <tr>
                    <th scope="col">{t('dashboard.receipt')}</th>
                    <th scope="col">{t('dashboard.time')}</th>
                    <th scope="col">{t('dashboard.customer')}</th>
                    <th scope="col">{t('dashboard.paidBy')}</th>
                    <th scope="col" className="dx-num">{t('dashboard.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const when = new Date(bill.date)
                    const methods = [...(bill.payments ?? []).map((p) => p.method), ...(bill.totalAmount - bill.amountPaid > 0.004 ? ['CREDIT'] : [])]
                    return (
                      <tr key={bill.id} onClick={() => navigate(`/orders?orderId=${bill.id}`)}>
                        <td>
                          <Link className="dx-strong-link" to={`/orders?orderId=${bill.id}`} onClick={(e) => e.stopPropagation()}>{code(bill.invoiceNo)}</Link>
                        </td>
                        <td className="dx-muted">{isToday(when) ? i18n.time(when) : i18n.date(when, 'medium')}</td>
                        <td>{bill.customerName || <span className="dx-muted">{t('common.walkIn')}</span>}</td>
                        <td><MethodList methods={methods.length ? methods : [bill.paymentMethod]} /></td>
                        <td className="dx-num">{money(bill.totalAmount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dx-empty">
              {t('dashboard.noBills')} <Link className="dx-link" to="/billing">{t('dashboard.openBilling')}</Link>
            </p>
          )}
        </Cell>

        <Cell id="credit" title={t('dashboard.ov.credit')} className="dx-span-4 dx-deferred" link={{ to: '/customers', label: t('dashboard.ov.seeCustomers') }}>
          <p className="dx-credit-total">
            {money(o.owedByCustomers)}
            <span>{t('dashboard.ov.owedNow')}</span>
          </p>
          <dl className="dx-rows">
            <Row label={t('dashboard.ov.creditGiven')} value={o.totals.creditGiven} previous={o.previous.creditGiven} invert />
            <Row label={t('dashboard.ov.repaid')} value={o.totals.repayments} previous={o.previous.repayments} />
          </dl>
        </Cell>
      </div>

      {dayEnd.open && dayEnd.summary && <EndOfDaySummary summary={dayEnd.summary} onClose={() => setDayEnd((d) => ({ ...d, open: false }))} />}
    </div>
  )
}

/** A cell of the grid: a heading, an optional line under it, an optional link to the full page. */
function Cell({ id, title, note, link, className, children }: { id: string; title: string; note?: string; link?: { to: string; label: string }; className?: string; children: ReactNode }) {
  return (
    <section className={`dx-cell${className ? ` ${className}` : ''}`} aria-labelledby={`dx-${id}-title`}>
      <div className="dx-cell-head">
        <h2 id={`dx-${id}-title`} className="dx-cell-title">{title}</h2>
        {link && <Link className="dx-link" to={link.to}>{link.label}</Link>}
      </div>
      {note && <p className="dx-cell-note">{note}</p>}
      <div className="dx-cell-body">{children}</div>
    </section>
  )
}

/**
 * The change against the previous period: an arrow and a percent, green when it is good news
 * and red when it is bad; a dash when there is nothing to compare with. Neutral changes keep
 * the arrow but no color, for lines that are neither good nor bad.
 */
function Change({ value, invert = false, neutral = false, onDark = false }: { value: number | null; invert?: boolean; neutral?: boolean; onDark?: boolean }) {
  const { t, percent } = useI18n()
  const base = `dx-change${onDark ? ' on-dark' : ''}`
  if (value === null) return <span className={base} title={t('dashboard.ov.noEarlier')} aria-label={t('dashboard.ov.noEarlier')}>—</span>
  const rounded = Math.round(Math.abs(value) * 100)
  const text = percent(rounded)
  if (rounded === 0) return <span className={base}>{text}</span>
  const up = value > 0
  const good = invert ? !up : up
  return (
    <span className={`${base} ${neutral ? '' : good ? 'is-good' : 'is-bad'}`} aria-label={t(up ? 'dashboard.ov.up' : 'dashboard.ov.down', { percent: text })}>
      {up ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
      {text}
    </span>
  )
}

/** One line of a money breakdown: deductions with a minus sign, totals in bold on a rule. Deductions follow sales up and down, so their change is not colored. */
function Row({ label, value, previous, minus = false, invert = false, total = false, tone }: { label: string; value: number; previous?: number; minus?: boolean; invert?: boolean; total?: boolean; tone?: 'gain' | 'loss' }) {
  const { money } = useI18n()
  return (
    <div className={`dx-row${total ? ' is-total' : ''}`}>
      <dt>{label}</dt>
      <dd className={`dx-row-value${tone ? ` dx-${tone}` : ''}`}>{minus && value !== 0 ? money(-value) : money(value)}</dd>
      <dd className="dx-row-change">{previous !== undefined && <Change value={change(value, previous)} invert={invert} neutral={minus} />}</dd>
    </div>
  )
}

/** Where a product stands against its expiry date: red once expired, amber when close. */
function ExpiryFlag({ value }: { value?: string | null }) {
  const { t } = useI18n()
  const status = expiryStatus(value)
  if (!status || status.state === 'ok') return null
  const label =
    status.state === 'expired' ? t('inventory.expiry.expired', { count: -status.days }) : status.state === 'today' ? t('inventory.expiry.today') : t('inventory.expiry.soon', { count: status.days })
  return <span className={`dx-flag ${status.state === 'expired' ? 'is-critical' : 'is-warning'}`}>{label}</span>
}

/** One line comparing today so far with an average day by this time. */
function Comparison({ shape, comparedDays, orderCount }: { shape: ReturnType<typeof shapeDay>; comparedDays: number; orderCount: number }) {
  const { t, money, tx } = useI18n()
  if (orderCount === 0) return <p className="dx-hero-note">{t('dashboard.noBillsYet')}</p>
  if (comparedDays === 0) return <p className="dx-hero-note">{t('dashboard.notEnoughHistory')}</p>
  const gap = shape.todayTotal - shape.averageByNow
  const closeEnough = Math.abs(gap) < Math.max(shape.averageByNow * 0.02, 50)
  const when = shape.nowAt >= shape.end ? t('dashboard.forWholeDay') : t('dashboard.byThisTime')
  if (closeEnough) return <p className="dx-hero-note">{t('dashboard.level', { when })}</p>
  return (
    <p className="dx-hero-note">
      {tx(gap > 0 ? 'dashboard.ahead' : 'dashboard.behind', {
        amount: <strong className={gap < 0 ? 'is-behind' : 'is-ahead'}>{money(Math.abs(gap))}</strong>,
        when,
      })}
    </p>
  )
}

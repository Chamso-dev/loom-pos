import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isToday } from 'date-fns'
import './dashboard.css'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { change, isRangeKey, RANGE_KEYS, unitRule, type Overview, type RangeKey } from '@/lib/domain'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Meter } from './DashboardVisuals'
import { ComparisonLine, HourBars, RankBars } from './OverviewCharts'
import { MethodList } from '@/components/ui/badges'
import ExpiryBadge from '@/components/inventory/ExpiryBadge'
import EndOfDaySummary, { type DaySummary } from './EndOfDaySummary'

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

const REFRESH_MS = 2 * 60 * 1000
const RANGE_STORAGE = 'loompos.dashboard.range'
const DIP_CLASS: Record<string, string> = {
  CASH: 'ld-dip-cash',
  CIB: 'ld-dip-cib',
  EDAHABIA: 'ld-dip-edahabia',
  BARIDIMOB: 'ld-dip-baridimob',
  TRANSFER: 'ld-dip-transfer',
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
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [showEOD, setShowEOD] = useState(false)
  // Only the newest request may update the page: a slow answer for an old period is dropped.
  const latest = useRef(0)

  const load = useCallback(async (key: RangeKey) => {
    const ticket = ++latest.current
    const [o, s, b] = await Promise.allSettled([
      api<Overview>('/analytics/overview', { query: { range: key } }),
      api<DaySummary>('/analytics/summary'),
      api<{ orders: Bill[] }>('/orders', { query: { limit: 6 } }),
      fetchLowStockAlerts(),
    ])
    if (ticket !== latest.current) return
    if (o.status === 'fulfilled') setOverview(o.value)
    if (s.status === 'fulfilled') setSummary(s.value)
    if (b.status === 'fulfilled') setBills(b.value.orders)
    setUpdatedAt(new Date())
    setStatus((prev) => (o.status === 'fulfilled' || prev === 'ready' ? 'ready' : 'failed'))
  }, [fetchLowStockAlerts])

  useEffect(() => {
    load(range)
    const timer = window.setInterval(() => load(range), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load, range])

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
      <div className="loom-dash" aria-busy="true" aria-label={t('dashboard.loadingLabel')}>
        <div className="ld-skeleton" style={{ height: 44, maxWidth: 560 }} />
        <div className="ld-kpis">
          {[0, 1, 2, 3].map((i) => <div key={i} className="ld-skeleton" style={{ height: 150 }} />)}
        </div>
        <div className="ld-grid">
          <div className="ld-skeleton ld-span-2" style={{ height: 360 }} />
          <div className="ld-skeleton" style={{ height: 360 }} />
        </div>
      </div>
    )
  }

  if (status === 'failed' || !overview) {
    return (
      <div className="loom-dash">
        <div className="ld-alert" role="alert">
          <p>{t('dashboard.ov.loadError')}</p>
          <button className="ld-button" onClick={() => { setStatus('loading'); load(range) }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const o = overview
  // While another period loads, the last one stays on screen, dimmed.
  const stale = o.range !== range
  const compareTo = new Date(o.compareTo)
  const compareCaption =
    o.range === 'today'
      ? t('dashboard.ov.compareToday', { time: i18n.time(compareTo) })
      : o.range === 'yesterday'
        ? t('dashboard.ov.compareYesterday')
        : t('dashboard.ov.comparePeriod', { from: i18n.date(new Date(o.previousFrom), 'dayShort'), to: i18n.date(new Date(compareTo.getTime() - 1), 'dayShort') })
  const seriesLabels =
    o.range === 'today'
      ? { current: t('dashboard.ov.ranges.today'), previous: t('dashboard.ov.yesterday') }
      : o.range === 'yesterday'
        ? { current: t('dashboard.ov.yesterday'), previous: t('dashboard.ov.dayBefore') }
        : { current: t('dashboard.ov.current'), previous: t('dashboard.ov.previous') }

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

  return (
    <div className="loom-dash">
      <header className="ld-top">
        <div>
          <h1 className="ld-title">{t('dashboard.ov.title')}</h1>
          <p className="ld-subtitle">
            {compareCaption}
            <span aria-hidden="true"> · </span>
            {t('dashboard.ov.updated', { time: i18n.time(updatedAt) })}
          </p>
        </div>
        <button className="ld-button" onClick={() => setShowEOD(true)} disabled={!summary}>
          {t('dashboard.closeDay')}
        </button>
      </header>

      <div className="ld-ranges" role="group" aria-label={t('dashboard.ov.rangeLabel')}>
        {RANGE_KEYS.map((key) => (
          <button key={key} type="button" className="ld-range" aria-pressed={range === key} onClick={() => pickRange(key)}>
            {t(`dashboard.ov.ranges.${key}`)}
          </button>
        ))}
      </div>

      <div className={`ld-body${stale ? ' is-stale' : ''}`} aria-busy={stale}>
        <section className="ld-kpis" aria-label={t(`dashboard.ov.ranges.${o.range}`)}>
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              className="ld-kpi"
              aria-pressed={metric === m.key}
              title={m.hint}
              onClick={() => setMetric(m.key)}
            >
              <span className="ld-kpi-title">{m.title}</span>
              <span className="ld-kpi-row">
                <span className={`ld-kpi-value${m.tone ? ` ld-${m.tone}` : ''}`}>{m.format(m.value)}</span>
                <ChangeBadge value={m.change} />
              </span>
              <span className="ld-kpi-previous">{seriesLabels.previous}: {m.format(m.previous)}</span>
              <ComparisonLine compact points={pointsOf(m.key)} granularity={o.granularity} format={m.format} labels={seriesLabels} title={m.title} />
              <span className="ld-sr-only">{t('dashboard.ov.showChart', { metric: m.title })}</span>
            </button>
          ))}
        </section>

        <div className="ld-grid">
          <section className="ld-panel ld-span-2" aria-labelledby="ld-chart-heading">
            <div className="ld-panel-head">
              <div>
                <h2 id="ld-chart-heading" className="ld-heading">{t('dashboard.ov.overTime', { metric: shown.title })}</h2>
                <p className="ld-chart-total">
                  <span className={shown.tone ? `ld-${shown.tone}` : undefined}>{shown.format(shown.value)}</span>
                  <ChangeBadge value={shown.change} />
                </p>
              </div>
              <ul className="ld-thread-legend" aria-hidden="true">
                <li><span className="ld-swatch-line" />{seriesLabels.current}</li>
                <li><span className="ld-swatch-dash" />{seriesLabels.previous}</li>
              </ul>
            </div>
            <ComparisonLine
              points={pointsOf(metric)}
              granularity={o.granularity}
              format={shown.format}
              formatAxis={metric === 'orders' ? (v) => i18n.number(v, 1) : moneyShort}
              labels={seriesLabels}
              title={t('dashboard.ov.chartLabel', { title: shown.title, value: shown.format(shown.value), previous: shown.format(shown.previous) })}
            />
            {o.totals.orders === 0 && <p className="ld-empty">{t('dashboard.ov.empty')}</p>}
          </section>

          <section className="ld-panel" aria-labelledby="ld-breakdown-heading">
            <h2 id="ld-breakdown-heading" className="ld-heading">{t('dashboard.ov.breakdown')}</h2>
            <dl className="ld-breakdown">
              <BreakdownRow label={t('dashboard.ov.grossSales')} value={o.totals.grossSales} previous={o.previous.grossSales} />
              <BreakdownRow label={t('dashboard.ov.discounts')} value={o.totals.discounts} previous={o.previous.discounts} minus />
              <BreakdownRow label={t('dashboard.ov.returns')} value={o.totals.returns} previous={o.previous.returns} minus />
              <BreakdownRow label={t('dashboard.ov.netSales')} value={o.totals.netSales} previous={o.previous.netSales} total />
              <BreakdownRow label={t('dashboard.ov.tax')} value={o.totals.tax} previous={o.previous.tax} minus />
              <BreakdownRow label={t('dashboard.ov.cost')} value={o.totals.cost} previous={o.previous.cost} minus />
              <BreakdownRow label={t('dashboard.ov.grossProfit')} value={o.totals.profit} previous={o.previous.profit} total tone={tone(o.totals.profit)} />
            </dl>
          </section>

          <section className="ld-panel" aria-labelledby="ld-methods-heading">
            <h2 id="ld-methods-heading" className="ld-heading">{t('dashboard.ov.paymentMethods')}</h2>
            <p className="ld-empty ld-heading-hint">{t('dashboard.ov.paymentHint')}</p>
            <RankBars
              empty={t('dashboard.noPayments')}
              rows={o.methods.map((m) => ({ key: m.method, name: i18n.method(m.method), value: m.amount, dip: DIP_CLASS[m.method] ?? 'ld-dip-transfer' }))}
            />
          </section>

          <section className="ld-panel" aria-labelledby="ld-cats-heading">
            <h2 id="ld-cats-heading" className="ld-heading">{t('dashboard.byCategory')}</h2>
            <RankBars
              empty={t('dashboard.noCategories')}
              rows={o.categories.map((c) => ({ key: c.category ?? '\u0000other', name: c.category ? <bdi>{c.category}</bdi> : t('dashboard.otherCategories'), value: c.revenue, other: !c.category }))}
            />
          </section>

          <section className="ld-panel" aria-labelledby="ld-top-heading">
            <h2 id="ld-top-heading" className="ld-heading">{t('dashboard.ov.topProducts')}</h2>
            <RankBars
              empty={t('dashboard.ov.empty')}
              rows={o.topProducts.map((p) => ({
                key: p.productId,
                name: <bdi>{p.name}</bdi>,
                value: p.revenue,
                detail: t('dashboard.sold', { qty: qty(p.quantity, p.unit, true) }),
              }))}
            />
          </section>

          <section className="ld-panel ld-span-2" aria-labelledby="ld-hours-heading">
            <h2 id="ld-hours-heading" className="ld-heading">{t('dashboard.ov.hours')}</h2>
            <p className="ld-empty ld-heading-hint">{o.granularity === 'hour' ? t('dashboard.ov.hoursHintToday') : t('dashboard.ov.hoursHintPeriod')}</p>
            <HourBars hours={o.hours} labels={seriesLabels} nowHour={nowHour} />
          </section>

          <section className="ld-panel" aria-labelledby="ld-alerts-heading">
            <h2 id="ld-alerts-heading" className="ld-heading">{t('dashboard.ov.alerts')}</h2>
            {lowStockProducts.length || expiringProducts.length ? (
              <ul className="ld-list">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <li key={`low-${p.id}`} className="ld-list-row">
                    <Link className="ld-item-name" to={`/inventory?search=${encodeURIComponent(p.barcode)}`}><bdi>{p.name}</bdi></Link>
                    <span className={`ld-item-value ${p.stock <= 0 ? 'ld-stock-out' : 'ld-stock-low'}`}>
                      <span className="ld-stock-mark" aria-hidden="true" />
                      {p.stock <= 0 ? t('dashboard.soldOut') : t('dashboard.left', { qty: qty(p.stock, p.unit, true) })}
                    </span>
                    <span className="ld-row-meter" title={t('dashboard.stockMeter', { qty: qty(p.stock, p.unit, true), threshold: qty(unitRule(p.unit).lowStockAt, p.unit, true) })}>
                      <Meter value={p.stock / unitRule(p.unit).lowStockAt} tone={p.stock <= 0 ? 'out' : 'low'} />
                    </span>
                  </li>
                ))}
                {expiringProducts.slice(0, 3).map((p) => (
                  <li key={`exp-${p.id}`} className="ld-list-row">
                    <Link className="ld-item-name" to={`/inventory?search=${encodeURIComponent(p.barcode)}`}><bdi>{p.name}</bdi></Link>
                    <ExpiryBadge value={p.expiryDate} onlyWarnings />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ld-empty">{t('dashboard.ov.noAlerts')}</p>
            )}
            <p className="ld-panel-foot">
              <Link className="ld-link" to="/inventory">{t('dashboard.openInventory')}</Link>
            </p>
          </section>

          <section className="ld-panel" aria-labelledby="ld-credit-heading">
            <h2 id="ld-credit-heading" className="ld-heading">{t('dashboard.ov.credit')}</h2>
            <dl className="ld-breakdown">
              <BreakdownRow label={t('dashboard.ov.creditGiven')} value={o.totals.creditGiven} previous={o.previous.creditGiven} invert />
              <BreakdownRow label={t('dashboard.ov.repaid')} value={o.totals.repayments} previous={o.previous.repayments} />
              <BreakdownRow label={t('dashboard.ov.owedNow')} value={o.owedByCustomers} total />
            </dl>
            <p className="ld-panel-foot">
              <Link className="ld-link" to="/customers">{t('dashboard.ov.seeCustomers')}</Link>
            </p>
          </section>

          <section className="ld-panel ld-span-2" aria-labelledby="ld-bills-heading">
            <h2 id="ld-bills-heading" className="ld-heading">{t('dashboard.latestBills')}</h2>
            {bills?.length ? (
              <div className="ld-table-wrap">
                <table className="ld-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('dashboard.time')}</th>
                      <th scope="col">{t('dashboard.receipt')}</th>
                      <th scope="col">{t('dashboard.customer')}</th>
                      <th scope="col" className="ld-num">{t('dashboard.items')}</th>
                      <th scope="col">{t('dashboard.paidBy')}</th>
                      <th scope="col" className="ld-num">{t('dashboard.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => {
                      const when = new Date(bill.date)
                      const methods = [...(bill.payments ?? []).map((p) => p.method), ...(bill.totalAmount - bill.amountPaid > 0.004 ? ['CREDIT'] : [])]
                      return (
                        <tr key={bill.id} onClick={() => navigate(`/orders?orderId=${bill.id}`)}>
                          <td className="ld-table-muted">{isToday(when) ? i18n.time(when) : i18n.date(when, 'medium')}</td>
                          <td>
                            <Link className="ld-link" to={`/orders?orderId=${bill.id}`} onClick={(e) => e.stopPropagation()}>{code(bill.invoiceNo)}</Link>
                          </td>
                          <td>{bill.customerName || <span className="ld-table-muted">{t('common.walkIn')}</span>}</td>
                          <td className="ld-num">{i18n.number(bill._count.items)}</td>
                          <td><MethodList methods={methods.length ? methods : [bill.paymentMethod]} /></td>
                          <td className="ld-num">{money(bill.totalAmount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ld-empty">
                {t('dashboard.noBills')} <Link className="ld-link" to="/billing">{t('dashboard.openBilling')}</Link>
              </p>
            )}
            <p className="ld-panel-foot">
              <Link className="ld-link" to="/orders">{t('dashboard.seeAll')}</Link>
            </p>
          </section>
        </div>
      </div>

      {showEOD && summary && <EndOfDaySummary summary={summary} onClose={() => setShowEOD(false)} />}
    </div>
  )
}

/**
 * ↑ 12 % in green or ↓ 5 % in red against the previous period; a dash when there is nothing to
 * compare with. Neutral badges keep the arrow but no color, for lines that are neither good nor bad.
 */
function ChangeBadge({ value, invert = false, neutral = false }: { value: number | null; invert?: boolean; neutral?: boolean }) {
  const { t, percent } = useI18n()
  if (value === null) {
    return <span className="ld-change is-none" title={t('dashboard.ov.noEarlier')} aria-label={t('dashboard.ov.noEarlier')}>–</span>
  }
  const rounded = Math.round(Math.abs(value) * 100)
  const up = value > 0
  const text = percent(rounded)
  if (rounded === 0) return <span className="ld-change is-flat">{text}</span>
  // A rise is good for sales and bad for credit.
  const good = invert ? !up : up
  return (
    <span className={`ld-change ${neutral ? 'is-flat' : good ? 'is-good' : 'is-bad'}`} aria-label={t(up ? 'dashboard.ov.up' : 'dashboard.ov.down', { percent: text })}>
      {up ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
      {text}
    </span>
  )
}

/**
 * One line of a money breakdown: deductions with a minus sign, totals on a rule, and the change
 * against the previous period. Deductions follow sales up and down, so their change is not colored.
 */
function BreakdownRow({
  label,
  value,
  previous,
  minus = false,
  invert = false,
  total = false,
  tone,
}: {
  label: ReactNode
  value: number
  previous?: number
  minus?: boolean
  invert?: boolean
  total?: boolean
  tone?: 'gain' | 'loss'
}) {
  const { money } = useI18n()
  return (
    <div className={`ld-breakdown-row${total ? ' is-total' : ''}`}>
      <dt>{label}</dt>
      <dd className={`ld-breakdown-value${tone ? ` ld-${tone}` : ''}`}>{minus && value !== 0 ? money(-value) : money(value)}</dd>
      <dd className="ld-breakdown-change">{previous !== undefined && <ChangeBadge value={change(value, previous)} invert={invert} neutral={minus} />}</dd>
    </div>
  )
}

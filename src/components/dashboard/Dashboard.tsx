import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isToday } from 'date-fns'
import './dashboard.css'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { CURRENCY, formatNumber, PAYMENT_METHOD_CODES, unitRule } from '@/lib/domain'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { CategoryBars, HourColumns, Meter, Spark } from './DashboardVisuals'
import { MethodList } from '@/components/ui/badges'
import EndOfDaySummary, { type DaySummary } from './EndOfDaySummary'
import DayThread from './DayThread'
import { localDate, shapeDay } from './dayMath'

interface TodayAnalytics {
  todayByHour: number[]
  averageByHour: number[]
  comparedDays: number
  week: Array<{ date: string; amount: number; orders: number }>
  topItems: Array<{ productId: string; name: string; size: string | null; color: string | null; barcode: string; unit: string; quantity: number; revenue: number }>
  /** Today's takings by category, largest first; null is the folded "other" row. Older servers omit it. */
  categories?: Array<{ category: string | null; revenue: number }>
}

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

const REFRESH_MS = 2 * 60 * 1000
const DIP_CLASS: Record<string, string> = {
  CASH: 'ld-dip-cash',
  CIB: 'ld-dip-cib',
  EDAHABIA: 'ld-dip-edahabia',
  BARIDIMOB: 'ld-dip-baridimob',
  TRANSFER: 'ld-dip-transfer',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { lowStockProducts, fetchLowStockAlerts } = useStore()
  const i18n = useI18n()
  const { t, money, qty, code } = i18n

  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [today, setToday] = useState<TodayAnalytics | null>(null)
  const [bills, setBills] = useState<Bill[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [now, setNow] = useState(() => new Date())
  const [showEOD, setShowEOD] = useState(false)

  const load = useCallback(async () => {
    const [s, td, b] = await Promise.allSettled([
      api<DaySummary>('/analytics/summary'),
      api<TodayAnalytics>('/analytics/today'),
      api<{ orders: Bill[] }>('/orders', { query: { limit: 6 } }),
      fetchLowStockAlerts(),
    ])
    if (s.status === 'fulfilled') setSummary(s.value)
    if (td.status === 'fulfilled') setToday(td.value)
    if (b.status === 'fulfilled') setBills(b.value.orders)
    setNow(new Date())
    setStatus((prev) => (s.status === 'fulfilled' || prev === 'ready' ? 'ready' : 'failed'))
  }, [fetchLowStockAlerts])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const shape = useMemo(() => (today ? shapeDay(today.todayByHour, today.averageByHour, now) : null), [today, now])

  if (status === 'loading') {
    return (
      <div className="loom-dash" aria-busy="true" aria-label={t('dashboard.loadingLabel')}>
        <div className="ld-skeleton" style={{ height: 160, maxWidth: 520 }} />
        <div className="ld-skeleton" style={{ height: 240 }} />
        <div className="ld-row">
          <div className="ld-skeleton" style={{ height: 220 }} />
          <div className="ld-skeleton" style={{ height: 220 }} />
          <div className="ld-skeleton" style={{ height: 220 }} />
        </div>
      </div>
    )
  }

  if (status === 'failed' || !summary) {
    return (
      <div className="loom-dash">
        <div className="ld-alert" role="alert">
          <p>{t('dashboard.loadError')}</p>
          <button className="ld-button" onClick={() => { setStatus('loading'); load() }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const revenue = summary.revenue || 0
  const orderCount = summary.orders || 0
  const averageBill = orderCount ? revenue / orderCount : 0
  const moneyIn = summary.payments.reduce((sum, p) => sum + p.amount, 0)
  const paid = PAYMENT_METHOD_CODES.filter((m) => m !== 'CREDIT')
    .map((method) => ({ method, amount: summary.payments.find((p) => p.method === method)?.amount ?? 0 }))
    .filter((p) => p.amount > 0 || p.method === 'CASH')
  const weekMax = Math.max(...(today?.week.map((d) => d.amount) ?? [0]), 1)

  // Context for the figures: how today compares with the past six days, and the shares.
  const pastDays = today?.week.slice(0, -1).filter((d) => d.orders > 0) ?? []
  const pastAverageBill = pastDays.length ? pastDays.reduce((s, d) => s + d.amount, 0) / pastDays.reduce((s, d) => s + d.orders, 0) : 0
  const averageChange = pastAverageBill > 0 && orderCount > 0 ? (averageBill - pastAverageBill) / pastAverageBill : null
  const netOfTax = revenue - (summary.tax || 0)
  const margin = netOfTax > 0 ? summary.profit / netOfTax : null
  const creditShare = revenue > 0 ? summary.creditGiven / revenue : 0
  const topMax = Math.max(...(today?.topItems.map((i) => i.revenue) ?? [0]), 1)
  // Bars are narrow: thousands without decimals once past 10 000 (48k / 48 ألف), the unit is in the heading.
  const weekAmount = (amount: number) =>
    amount >= 1000 ? `${formatNumber(amount / 1000, amount >= 10000 ? 0 : 1)}${i18n.lang === 'ar' ? ' ألف' : 'k'}` : formatNumber(amount, 0)

  return (
    <div className="loom-dash">
      <header className="ld-hero">
        <div>
          <h1 className="ld-date">{i18n.date(now, 'dayMonth')}</h1>
          <p className="ld-takings">
            <span className="ld-figure">
              {money(revenue, { symbol: false })}
              <span className="ld-figure-currency">{CURRENCY.symbol[i18n.lang]}</span>
            </span>
            <span className="ld-figure-note">{t('dashboard.salesToday')}</span>
          </p>
          <Comparison shape={shape} comparedDays={today?.comparedDays ?? 0} orderCount={orderCount} />
          <dl className="ld-facts">
            <div className="ld-fact">
              <dt>{t('dashboard.bills', { count: orderCount })}</dt>
              <dd>{i18n.number(orderCount)}</dd>
              {today && (
                <dd className="ld-fact-extra">
                  <Spark
                    values={today.week.map((d) => d.orders)}
                    label={t('dashboard.salesSpark', { values: today.week.map((d) => i18n.number(d.orders)).join(', ') })}
                  />
                </dd>
              )}
            </div>
            <div className="ld-fact">
              <dt>{t('dashboard.averageBill')}</dt>
              <dd>{money(averageBill)}</dd>
              {averageChange !== null && Math.abs(averageChange) >= 0.005 && (
                <dd className={`ld-fact-extra ${averageChange > 0 ? 'ld-gain' : 'ld-loss'}`} title={t('dashboard.avgVsWeekLabel')}>
                  {averageChange > 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
                  {t('dashboard.avgVsWeek', { delta: i18n.percent(Math.round(Math.abs(averageChange) * 100)) })}
                </dd>
              )}
            </div>
            <div className={`ld-fact${summary.profit > 0 ? ' ld-fact-gain' : summary.profit < 0 ? ' ld-fact-loss' : ''}`}>
              <dt>{t('dashboard.profit')}</dt>
              <dd>{money(summary.profit)}</dd>
              {margin !== null && (
                <dd className="ld-fact-extra" title={t('dashboard.marginLabel')}>
                  {margin > 0 && <Meter value={margin} tone="gain" />}
                  {t('dashboard.margin', { percent: i18n.percent(Math.round(margin * 100)) })}
                </dd>
              )}
            </div>
            {summary.tax > 0 && (
              <div className="ld-fact">
                <dt>{t('dashboard.taxCollected')}</dt>
                <dd>{money(summary.tax)}</dd>
              </div>
            )}
            {summary.creditGiven > 0 && (
              <div className="ld-fact ld-fact-credit">
                <dt>{t('dashboard.creditGiven')}</dt>
                <dd>{money(summary.creditGiven)}</dd>
                <dd className="ld-fact-extra">
                  <Meter value={creditShare} tone="credit" />
                  {t('dashboard.creditShare', { percent: i18n.percent(Math.round(creditShare * 100)) })}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <button className="ld-button" onClick={() => setShowEOD(true)}>
          {t('dashboard.closeDay')}
        </button>
      </header>

      <section aria-labelledby="ld-thread-heading">
        <h2 id="ld-thread-heading" className="ld-sr-only">{t('dashboard.threadHeading')}</h2>
        {shape && today ? <DayThread shape={shape} comparedDays={today.comparedDays} now={now} /> : <p className="ld-empty">{t('dashboard.threadUnavailable')}</p>}
      </section>

      {today && shape && (
        <div className="ld-row-pair">
          <section className="ld-panel" aria-labelledby="ld-hours-heading">
            <h2 id="ld-hours-heading" className="ld-heading">{t('dashboard.busiestHours')}</h2>
            <p className="ld-empty ld-heading-hint">{t('dashboard.busiestHint')}</p>
            <HourColumns todayByHour={today.todayByHour} averageByHour={today.averageByHour} start={shape.start} end={shape.end} nowAt={shape.nowAt} />
          </section>
          <section className="ld-panel" aria-labelledby="ld-cats-heading">
            <h2 id="ld-cats-heading" className="ld-heading">{t('dashboard.byCategory')}</h2>
            <p className="ld-empty ld-heading-hint">{t('dashboard.byCategoryHint')}</p>
            <CategoryBars categories={today.categories ?? []} />
          </section>
        </div>
      )}

      <div className="ld-row">
        <section className="ld-panel" aria-labelledby="ld-paid-heading">
          <h2 id="ld-paid-heading" className="ld-heading">{t('dashboard.howPaid')}</h2>
          <p className="ld-empty ld-heading-hint">{t('dashboard.moneyInHint')}</p>
          <div className="ld-split" aria-hidden="true">
            {moneyIn > 0 &&
              paid.filter((p) => p.amount > 0).map((p) => (
                <div key={p.method} className={`ld-split-part ${DIP_CLASS[p.method] ?? 'ld-dip-transfer'}`} style={{ width: `${(p.amount / moneyIn) * 100}%` }} />
              ))}
          </div>
          <ul className="ld-list">
            {paid.map((p) => (
              <li key={p.method} className="ld-list-row">
                <span className="ld-item-name">
                  <span className={`ld-dip ${DIP_CLASS[p.method] ?? 'ld-dip-transfer'}`} />
                  {i18n.method(p.method)}
                </span>
                <span className="ld-item-value">{money(p.amount)}</span>
                <span className="ld-item-detail ld-indent">
                  {moneyIn > 0 ? t('dashboard.shareOf', { percent: i18n.percent(Math.round((p.amount / moneyIn) * 100)) }) : t('dashboard.noPayments')}
                </span>
              </li>
            ))}
            {summary.creditGiven > 0 && (
              <li className="ld-list-row">
                <span className="ld-item-name">
                  <span className="ld-dip ld-dip-credit" />
                  {t('dashboard.creditToday')}
                </span>
                <span className="ld-item-value ld-stock-low">{money(summary.creditGiven)}</span>
              </li>
            )}
          </ul>
          {summary.cash.expected !== 0 && (
            <p className="ld-panel-foot">{i18n.tx('dashboard.cashCheck', { amount: <strong>{money(summary.cash.expected)}</strong> })}</p>
          )}
        </section>

        <section className="ld-panel" aria-labelledby="ld-low-heading">
          <h2 id="ld-low-heading" className="ld-heading">{t('dashboard.runningLow')}</h2>
          {lowStockProducts.length ? (
            <ul className="ld-list">
              {lowStockProducts.slice(0, 5).map((p) => (
                <li key={p.id} className="ld-list-row">
                  <Link className="ld-item-name" to={`/inventory?search=${encodeURIComponent(p.barcode)}`}><bdi>{p.name}</bdi></Link>
                  <span className={`ld-item-value ${p.stock <= 0 ? 'ld-stock-out' : 'ld-stock-low'}`}>
                    <span className="ld-stock-mark" aria-hidden="true" />
                    {p.stock <= 0 ? t('dashboard.soldOut') : t('dashboard.left', { qty: qty(p.stock, p.unit, true) })}
                  </span>
                  <span className="ld-item-detail"><bdi>{[p.size, p.category].filter(Boolean).join(', ')}</bdi></span>
                  <span className="ld-row-meter" title={t('dashboard.stockMeter', { qty: qty(p.stock, p.unit, true), threshold: qty(unitRule(p.unit).lowStockAt, p.unit, true) })}>
                    <Meter value={p.stock / unitRule(p.unit).lowStockAt} tone={p.stock <= 0 ? 'out' : 'low'} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ld-empty">{t('dashboard.nothingLow')}</p>
          )}
          <p className="ld-panel-foot">
            <Link className="ld-link" to="/inventory">{t('dashboard.openInventory')}</Link>
          </p>
        </section>

        <section className="ld-panel" aria-labelledby="ld-top-heading">
          <h2 id="ld-top-heading" className="ld-heading">{t('dashboard.sellingToday')}</h2>
          {today?.topItems.length ? (
            <ul className="ld-list">
              {today.topItems.map((item) => (
                <li key={item.productId} className="ld-list-row">
                  <Link className="ld-item-name" to={`/inventory?search=${encodeURIComponent(item.barcode)}`}><bdi>{item.name}</bdi></Link>
                  <span className="ld-item-value">{money(item.revenue)}</span>
                  <span className="ld-item-detail">{t('dashboard.sold', { qty: qty(item.quantity, item.unit, true) })}</span>
                  {/* Takings against the day's best seller. */}
                  <span className="ld-rank" aria-hidden="true"><span style={{ width: `${(item.revenue / topMax) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ld-empty">{t('dashboard.nothingSold')}</p>
          )}
        </section>
      </div>

      <div className="ld-row-wide">
        <section className="ld-panel ld-panel-open" aria-labelledby="ld-bills-heading">
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

        <section className="ld-panel" aria-labelledby="ld-week-heading">
          <h2 id="ld-week-heading" className="ld-heading">{t('dashboard.pastWeek')}</h2>
          {today ? (
            <ol className="ld-week" dir="ltr">
              {today.week.map((day, i) => {
                const date = localDate(day.date)
                const isLast = i === today.week.length - 1
                return (
                  <li
                    key={day.date}
                    className={`ld-week-day${isLast ? ' is-today' : ''}`}
                    aria-label={t('dashboard.weekDay', { day: i18n.date(date, 'long'), amount: money(day.amount), count: day.orders })}
                  >
                    <span className="ld-week-amount" aria-hidden="true">{day.amount > 0 ? weekAmount(day.amount) : '–'}</span>
                    <span className="ld-week-bar" aria-hidden="true" style={{ height: `${(day.amount / weekMax) * 120}px` }} />
                    <span className="ld-week-label" aria-hidden="true">{isLast ? t('dashboard.today') : i18n.date(date, 'weekday')}</span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="ld-empty">{t('dashboard.threadUnavailable')}</p>
          )}
        </section>
      </div>

      {showEOD && <EndOfDaySummary summary={summary} onClose={() => setShowEOD(false)} />}
    </div>
  )
}

function Comparison({ shape, comparedDays, orderCount }: { shape: ReturnType<typeof shapeDay> | null; comparedDays: number; orderCount: number }) {
  const { t, money, tx } = useI18n()
  if (!shape) return null
  if (orderCount === 0) return <p className="ld-compare">{t('dashboard.noBillsYet')}</p>
  if (comparedDays === 0) return <p className="ld-compare">{t('dashboard.notEnoughHistory')}</p>

  const gap = shape.todayTotal - shape.averageByNow
  const closeEnough = Math.abs(gap) < Math.max(shape.averageByNow * 0.02, 50)
  const when = shape.nowAt >= shape.end ? t('dashboard.forWholeDay') : t('dashboard.byThisTime')
  if (closeEnough) return <p className="ld-compare">{t('dashboard.level', { when })}</p>
  return (
    <p className="ld-compare">
      {tx(gap > 0 ? 'dashboard.ahead' : 'dashboard.behind', {
        amount: <span className={`ld-compare-gap${gap < 0 ? ' is-behind' : ''}`}>{money(Math.abs(gap))}</span>,
        when,
      })}
    </p>
  )
}

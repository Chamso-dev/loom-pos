import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, isToday } from 'date-fns'
import '@fontsource-variable/anek-latin/standard.css'
import './dashboard.css'
import { useStore } from '@/store/useStore'
import EndOfDaySummary from './EndOfDaySummary'
import DayThread from './DayThread'
import { localDate, rupees, rupeesShort, shapeDay } from './dayMath'

interface Summary {
  revenue: number
  gst: number
  orders: number
  paymentBreakdown: Array<{ paymentMethod: string; _sum: { totalAmount: number | null } }>
}

interface TodayAnalytics {
  todayByHour: number[]
  averageByHour: number[]
  comparedDays: number
  week: Array<{ date: string; amount: number; orders: number }>
  topItems: Array<{
    productId: string
    name: string
    size: string | null
    color: string | null
    sku: string
    quantity: number
    revenue: number
  }>
}

interface Bill {
  id: string
  invoiceNo: string
  date: string
  totalAmount: number
  paymentMethod: string
  customerName: string | null
  processedBy: { name: string } | null
  _count: { items: number }
}

const METHODS = [
  { method: 'CASH', label: 'Cash', dip: 'ld-dip-cash', color: 'var(--ld-indigo)' },
  { method: 'UPI', label: 'UPI', dip: 'ld-dip-upi', color: 'var(--ld-indigo-mid)' },
  { method: 'CARD', label: 'Card', dip: 'ld-dip-card', color: 'var(--ld-indigo-pale)' },
] as const

const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card' }

const REFRESH_MS = 2 * 60 * 1000

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

const detailOf = (size: string | null, color: string | null) =>
  [size && `Size ${size}`, color].filter(Boolean).join(', ')

export default function Dashboard() {
  const navigate = useNavigate()
  const { lowStockProducts, fetchLowStockAlerts } = useStore()

  const [summary, setSummary] = useState<Summary | null>(null)
  const [today, setToday] = useState<TodayAnalytics | null>(null)
  const [bills, setBills] = useState<Bill[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [now, setNow] = useState(() => new Date())
  const [showEOD, setShowEOD] = useState(false)

  const load = useCallback(async () => {
    // Each request settles on its own, so one slow or missing endpoint does not blank the page.
    const [s, t, b] = await Promise.allSettled([
      getJson<Summary>('/api/analytics/summary'),
      getJson<TodayAnalytics>('/api/analytics/today'),
      getJson<{ orders: Bill[] }>('/api/orders?limit=6'),
      fetchLowStockAlerts(),
    ])
    if (s.status === 'fulfilled') setSummary(s.value)
    if (t.status === 'fulfilled') setToday(t.value)
    if (b.status === 'fulfilled') setBills(b.value.orders)
    setNow(new Date())
    // A failed background refresh keeps the last good numbers on screen.
    setStatus((prev) => (s.status === 'fulfilled' || prev === 'ready' ? 'ready' : 'failed'))
  }, [fetchLowStockAlerts])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const shape = useMemo(
    () => (today ? shapeDay(today.todayByHour, today.averageByHour, now) : null),
    [today, now]
  )

  if (status === 'loading') {
    return (
      <div className="loom-dash" aria-busy="true" aria-label="Loading today's sales">
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
          <p>
            Today's sales could not be loaded. The LoomPOS server did not answer.
            Check that it is running, then try again.
          </p>
          <button className="ld-button" onClick={() => { setStatus('loading'); load() }}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const revenue = summary.revenue || 0
  const orderCount = summary.orders || 0
  const averageBill = orderCount ? revenue / orderCount : 0
  const paid = METHODS.map((m) => ({
    ...m,
    amount: summary.paymentBreakdown.find((p) => p.paymentMethod === m.method)?._sum.totalAmount ?? 0,
  }))
  const weekMax = Math.max(...(today?.week.map((d) => d.amount) ?? [0]), 1)

  return (
    <div className="loom-dash">
      <header className="ld-hero">
        <div>
          <h1 className="ld-date">{format(now, 'EEEE, d MMMM')}</h1>
          <p className="ld-takings">
            <span className="ld-figure">{rupees(revenue)}</span>
            <span className="ld-figure-note">in sales today</span>
          </p>
          <Comparison shape={shape} comparedDays={today?.comparedDays ?? 0} orderCount={orderCount} />
          <dl className="ld-facts">
            <div className="ld-fact">
              <dt>{orderCount === 1 ? 'bill' : 'bills'}</dt>
              <dd>{orderCount}</dd>
            </div>
            <div className="ld-fact">
              <dt>average bill</dt>
              <dd>{rupees(averageBill)}</dd>
            </div>
            <div className="ld-fact">
              <dt>GST collected</dt>
              <dd>{rupees(summary.gst || 0)}</dd>
            </div>
          </dl>
        </div>
        <button className="ld-button" onClick={() => setShowEOD(true)}>
          Close the day
        </button>
      </header>

      <section aria-labelledby="ld-thread-heading">
        <h2 id="ld-thread-heading" className="ld-sr-only">Sales through the day</h2>
        {shape && today ? (
          <DayThread shape={shape} comparedDays={today.comparedDays} now={now} />
        ) : (
          <p className="ld-empty">The hour-by-hour view is unavailable. The server may need updating.</p>
        )}
      </section>

      <div className="ld-row">
        <section className="ld-panel" aria-labelledby="ld-paid-heading">
          <h2 id="ld-paid-heading" className="ld-heading">How customers paid</h2>
          <div className="ld-split" aria-hidden="true">
            {revenue > 0 &&
              paid
                .filter((p) => p.amount > 0)
                .map((p) => (
                  <div
                    key={p.method}
                    className="ld-split-part"
                    style={{ width: `${(p.amount / revenue) * 100}%`, background: p.color }}
                  />
                ))}
          </div>
          <ul className="ld-list">
            {paid.map((p) => (
              <li key={p.method} className="ld-list-row">
                <span className="ld-item-name">
                  <span className={`ld-dip ${p.dip}`} />
                  {p.label}
                </span>
                <span className="ld-item-value">{rupees(p.amount)}</span>
                <span className="ld-item-detail ld-indent">
                  {revenue > 0 ? `${Math.round((p.amount / revenue) * 100)}% of sales` : 'No sales yet'}
                </span>
              </li>
            ))}
          </ul>
          {paid[0].amount > 0 && (
          <p className="ld-panel-foot">
            Cash taken today is <strong>{rupees(paid[0].amount)}</strong>. Check it against the drawer at closing.
          </p>
          )}
        </section>

        <section className="ld-panel" aria-labelledby="ld-low-heading">
          <h2 id="ld-low-heading" className="ld-heading">Running low</h2>
          {lowStockProducts.length ? (
            <ul className="ld-list">
              {lowStockProducts.slice(0, 5).map((p) => (
                <li key={p.id} className="ld-list-row">
                  <Link className="ld-item-name" to={`/inventory?search=${encodeURIComponent(p.sku)}`}>
                    {p.name}
                  </Link>
                  <span className={`ld-item-value ${p.stock === 0 ? 'ld-stock-out' : 'ld-stock-low'}`}>
                    <span className="ld-stock-mark" aria-hidden="true" />
                    {p.stock === 0 ? 'Sold out' : `${p.stock} left`}
                  </span>
                  <span className="ld-item-detail">{detailOf(p.size ?? null, p.color ?? null) || p.sku}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ld-empty">Nothing is running low. Items appear here when 10 or fewer are left.</p>
          )}
          <p className="ld-panel-foot">
            <Link className="ld-link" to="/inventory">Open inventory</Link>
          </p>
        </section>

        <section className="ld-panel" aria-labelledby="ld-top-heading">
          <h2 id="ld-top-heading" className="ld-heading">Selling today</h2>
          {today?.topItems.length ? (
            <ul className="ld-list">
              {today.topItems.map((item) => (
                <li key={item.productId} className="ld-list-row">
                  <Link className="ld-item-name" to={`/inventory?search=${encodeURIComponent(item.sku)}`}>
                    {item.name}
                  </Link>
                  <span className="ld-item-value">{item.quantity} sold</span>
                  <span className="ld-item-detail">{detailOf(item.size, item.color)}</span>
                  <span className="ld-item-sub">{rupees(item.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ld-empty">No items sold yet today. Best sellers show here after the first bill.</p>
          )}
        </section>
      </div>

      <div className="ld-row-wide">
        <section className="ld-panel ld-panel-open" aria-labelledby="ld-bills-heading">
          <h2 id="ld-bills-heading" className="ld-heading">Latest bills</h2>
          {bills?.length ? (
            <div className="ld-table-wrap">
              <table className="ld-table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Bill</th>
                    <th scope="col">Customer</th>
                    <th scope="col" className="ld-num">Items</th>
                    <th scope="col">Paid by</th>
                    <th scope="col">Cashier</th>
                    <th scope="col" className="ld-num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const when = new Date(bill.date)
                    return (
                      <tr key={bill.id} onClick={() => navigate(`/orders?orderId=${bill.id}`)}>
                        <td className="ld-table-muted">
                          {isToday(when) ? format(when, 'h:mm a').toLowerCase() : format(when, 'd MMM')}
                        </td>
                        <td>
                          <Link className="ld-link" to={`/orders?orderId=${bill.id}`} onClick={(e) => e.stopPropagation()}>
                            {bill.invoiceNo}
                          </Link>
                        </td>
                        <td>{bill.customerName || <span className="ld-table-muted">Walk-in</span>}</td>
                        <td className="ld-num">{bill._count.items}</td>
                        <td>{METHOD_LABEL[bill.paymentMethod] ?? bill.paymentMethod}</td>
                        <td className="ld-table-muted">{bill.processedBy?.name ?? 'Unknown'}</td>
                        <td className="ld-num">{rupees(bill.totalAmount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ld-empty">
              No bills yet. <Link className="ld-link" to="/billing">Open billing</Link> to make the first one.
            </p>
          )}
          <p className="ld-panel-foot">
            <Link className="ld-link" to="/orders">See all orders</Link>
          </p>
        </section>

        <section className="ld-panel" aria-labelledby="ld-week-heading">
          <h2 id="ld-week-heading" className="ld-heading">Past 7 days</h2>
          {today ? (
            <ol className="ld-week">
              {today.week.map((day, i) => {
                const date = localDate(day.date)
                const isLast = i === today.week.length - 1
                return (
                  <li
                    key={day.date}
                    className={`ld-week-day${isLast ? ' is-today' : ''}`}
                    aria-label={`${format(date, 'EEEE d MMMM')}: ${rupees(day.amount)} from ${day.orders} ${day.orders === 1 ? 'bill' : 'bills'}`}
                  >
                    <span className="ld-week-amount" aria-hidden="true">
                      {day.amount > 0 ? rupeesShort(day.amount) : '–'}
                    </span>
                    <span
                      className="ld-week-bar"
                      aria-hidden="true"
                      style={{ height: `${(day.amount / weekMax) * 120}px` }}
                    />
                    <span className="ld-week-label" aria-hidden="true">
                      {isLast ? 'Today' : format(date, 'EEE')}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="ld-empty">The weekly view is unavailable. The server may need updating.</p>
          )}
        </section>
      </div>

      {showEOD && <EndOfDaySummary summary={summary} onClose={() => setShowEOD(false)} />}
    </div>
  )
}

function Comparison({
  shape,
  comparedDays,
  orderCount,
}: {
  shape: ReturnType<typeof shapeDay> | null
  comparedDays: number
  orderCount: number
}) {
  if (!shape) return null
  if (orderCount === 0) {
    return <p className="ld-compare">No bills yet today. Sales show here as soon as the first bill is saved.</p>
  }
  if (comparedDays === 0) {
    return <p className="ld-compare">Comparisons start once the store has a few days of sales.</p>
  }

  const gap = shape.todayTotal - shape.averageByNow
  const closeEnough = Math.abs(gap) < Math.max(shape.averageByNow * 0.02, 50)
  const when = shape.nowAt >= shape.end ? 'for a whole day' : 'by this time'

  if (closeEnough) {
    return <p className="ld-compare">Level with an average day {when}.</p>
  }
  return (
    <p className="ld-compare">
      <span className={`ld-compare-gap${gap < 0 ? ' is-behind' : ''}`}>{rupees(Math.abs(gap))}</span>{' '}
      {gap > 0 ? 'ahead of' : 'behind'} an average day {when}.
    </p>
  )
}

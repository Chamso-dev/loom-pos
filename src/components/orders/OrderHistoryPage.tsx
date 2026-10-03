import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Filter, RotateCw, Eye, Check, X } from 'lucide-react'
import { format, startOfMonth, subDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { StatusBadge, MethodList } from '@/components/ui/badges'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { PAYMENT_METHOD_CODES } from '@/lib/domain'
import { cn } from '@/lib/utils'
import { LoadError } from '@/components/ui/field'
import OrderDetailModal from './OrderDetailModal'

const STATUSES = ['CREDIT', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const
const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

export default function OrderHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const orderIdFromUrl = searchParams.get('orderId')
  const i18n = useI18n()
  const { t, money } = i18n

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [methods, setMethods] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<any>(null)

  const fetchOrders = useCallback(
    async (p = 1, overrides: Partial<{ search: string; startDate: string; endDate: string; methods: string[]; status: string }> = {}) => {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await api<{ orders: any[]; total: number; hasMore: boolean }>('/orders', {
          query: {
            search: overrides.search ?? search,
            startDate: overrides.startDate ?? startDate,
            endDate: overrides.endDate ?? endDate,
            methods: overrides.methods ?? methods,
            status: overrides.status ?? status,
            page: p,
            limit: 50,
          },
        })
        setOrders((prev) => (p === 1 ? data.orders : [...prev, ...data.orders]))
        setHasMore(data.hasMore)
        setTotal(data.total)
        setPage(p)
      } catch (error) {
        console.error('Failed to fetch sales', error)
        setLoadError(error)
      } finally {
        setLoading(false)
      }
    },
    [search, startDate, endDate, methods, status]
  )

  useEffect(() => {
    fetchOrders(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!orderIdFromUrl) return
    api(`/orders/${orderIdFromUrl}`).then(setSelected).catch(setLoadError)
  }, [orderIdFromUrl])

  const openOrder = async (id: string) => {
    try {
      setSelected(await api(`/orders/${id}`))
    } catch (error) {
      setLoadError(error)
    }
  }

  const applyPeriod = (period: 'today' | 'yesterday' | 'month') => {
    const now = new Date()
    const [s, e] =
      period === 'today' ? [now, now] : period === 'yesterday' ? [subDays(now, 1), subDays(now, 1)] : [startOfMonth(now), now]
    setStartDate(ymd(s))
    setEndDate(ymd(e))
    fetchOrders(1, { startDate: ymd(s), endDate: ymd(e) })
  }

  const toggleMethod = (m: string) => {
    const next = methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m]
    setMethods(next)
    fetchOrders(1, { methods: next })
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setMethods([])
    setStatus('')
    setSearch('')
    fetchOrders(1, { search: '', startDate: '', endDate: '', methods: [], status: '' })
  }

  const filtersActive = Boolean(startDate || endDate || methods.length || status)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">{t('orders.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('orders.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              fetchOrders(1)
            }}
            className="relative flex-1 sm:flex-none"
          >
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="search"
              placeholder={t('orders.searchPlaceholder')}
              aria-label={t('orders.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background w-full sm:w-72 h-10 ps-9 pe-3 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring/40 text-sm"
            />
          </form>
          <div className="relative">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className={cn('h-10 gap-1.5', filtersActive && 'bg-accent')}>
              <Filter size={14} /> {t('common.filters')}
              {filtersActive && <span className="w-1.5 h-1.5 bg-primary rounded-full" />}
            </Button>
            {showFilters && (
              <div className="absolute top-12 end-0 w-[min(380px,calc(100vw-1.5rem))] bg-card border border-border shadow-lg rounded-lg p-4 sm:p-5 z-50 space-y-5">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground">{t('orders.quickDates')}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['today', 'yesterday', 'month'] as const).map((p) => (
                      <button key={p} type="button" onClick={() => applyPeriod(p)} className="py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent">
                        {p === 'today' ? t('common.today') : p === 'yesterday' ? t('common.yesterday') : t('common.thisMonth')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block">{t('orders.customRange')}</span>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-muted-foreground space-y-1">
                      <span>{t('common.from')}</span>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground" />
                    </label>
                    <label className="text-xs text-muted-foreground space-y-1">
                      <span>{t('common.to')}</span>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground" />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground">{t('orders.paymentFilter')}</span>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHOD_CODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={methods.includes(m)}
                        onClick={() => toggleMethod(m)}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium',
                          methods.includes(m) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {methods.includes(m) && <Check size={12} />} {i18n.method(m)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground">{t('orders.statusFilter')}</span>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={status === s}
                        onClick={() => {
                          const next = status === s ? '' : s
                          setStatus(next)
                          fetchOrders(1, { status: next })
                        }}
                        className={cn(
                          'px-2.5 py-1 rounded-md border text-xs font-medium',
                          status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {t(`payments.status.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <button type="button" onClick={clearFilters} className="text-xs font-medium text-destructive hover:underline flex items-center gap-1">
                    <X size={13} /> {t('common.clearFilters')}
                  </button>
                  <Button
                    size="sm"
                    onClick={() => {
                      fetchOrders(1)
                      setShowFilters(false)
                    }}
                  >
                    {t('common.apply')}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={() => fetchOrders(1)} aria-label={t('common.refresh')} className="h-10 w-10 p-0">
            <RotateCw size={15} className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loadError != null && <LoadError message={i18n.error(loadError)} retryLabel={t('common.retry')} onRetry={() => fetchOrders(1)} />}
      <div className="relative bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border bg-accent/20 text-xs text-muted-foreground">
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('orders.receiptNo')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('orders.dateTime')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-sm:hidden">{t('orders.customer')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-end font-semibold">{t('orders.total')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-lg:hidden">{t('orders.paidBy')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-sm:hidden">{t('orders.status')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-xl:hidden">{t('orders.cashier')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 max-xl:hidden"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading && orders.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">{t('orders.loadingSales')}</td></tr>
            ) : orders.length === 0 && loadError == null ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">{t('orders.none')}</td></tr>
            ) : (
              orders.map((order) => {
                const methodsUsed = [
                  ...(order.payments ?? []).map((p: any) => p.method),
                  ...(order.totalAmount - order.amountPaid > 0.004 ? ['CREDIT'] : []),
                ]
                return (
                  <tr key={order.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => openOrder(order.id)}>
                    <td className="px-4 py-3 max-sm:px-2.5 font-semibold whitespace-nowrap">
                      {i18n.code(order.invoiceNo)}
                      {/* On phones the customer goes under the receipt number instead of its own column. */}
                      <span className="sm:hidden block text-xs font-normal text-muted-foreground max-w-[8rem] truncate"><bdi>{order.customerName || t('common.walkIn')}</bdi></span>
                    </td>
                    <td className="px-4 py-3 max-sm:px-2.5 whitespace-nowrap">
                      <span className="block">{i18n.date(order.date, 'medium')}</span>
                      <span className="block text-xs text-muted-foreground">{i18n.time(order.date)}</span>
                    </td>
                    <td className="px-4 py-3 max-sm:hidden">
                      <span className="block font-medium">{order.customerName || t('common.walkIn')}</span>
                      {order.customerMobile && <span className="block text-xs text-muted-foreground whitespace-nowrap">{i18n.phone(order.customerMobile)}</span>}
                    </td>
                    <td className="px-4 py-3 max-sm:px-2.5 text-end font-semibold tabular-nums whitespace-nowrap">{money(order.totalAmount)}</td>
                    <td className="px-4 py-3 max-sm:px-2.5 max-lg:hidden"><MethodList methods={methodsUsed.length ? methodsUsed : [order.paymentMethod]} /></td>
                    <td className="px-4 py-3 max-sm:px-2.5 max-sm:hidden"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 max-sm:px-2.5 text-xs max-xl:hidden">
                      {order.processedBy?.name ?? t('common.unknown')}
                      {order.processedBy && !order.processedBy.isActive && <span className="ms-1 text-muted-foreground">({t('orders.exStaff')})</span>}
                    </td>
                    <td className="px-4 py-3 max-sm:px-2.5 text-end max-xl:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          openOrder(order.id)
                        }}
                      >
                        <Eye size={14} /> {t('common.view')}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="p-4 border-t border-border flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">{t('common.showingOf', { shown: orders.length, total })}</p>
          {hasMore && (
            <Button variant="outline" disabled={loading} onClick={() => fetchOrders(page + 1)}>
              {loading ? t('common.loading') : t('common.loadMore')}
            </Button>
          )}
        </div>
      </div>

      {selected && (
        <OrderDetailModal
          order={selected}
          onClose={() => {
            setSelected(null)
            if (orderIdFromUrl) setSearchParams({})
          }}
          onChange={(updated) => setOrders((list) => list.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)))}
        />
      )}
    </div>
  )
}

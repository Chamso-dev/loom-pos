import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, Calendar, Filter, Eye, Printer, ChevronRight,
  CreditCard, Wallet, QrCode, ArrowLeft, RotateCw, X, Check,
  ChevronDown, Trash2, RotateCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { format, startOfDay, subDays, formatISO } from 'date-fns'
import { useStore } from '@/store/useStore'
import { PAYMENT_METHODS, paymentIcon, paymentLabel } from '@/lib/payments'
import PrintReceiptPortal from '../billing/PrintReceiptPortal'

export default function OrderHistoryPage() {
  const [searchParams] = useSearchParams()
  const orderIdFromUrl = searchParams.get('orderId')

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter & Pagination States
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [printType, setPrintType] = useState<'A4' | 'Thermal' | null>(null)
  const [fullOrderData, setFullOrderData] = useState<any>(null)

  useEffect(() => {
    fetchOrders()
    if (orderIdFromUrl) {
      handleAutoOpen(orderIdFromUrl)
    }
  }, [orderIdFromUrl])

  const handleAutoOpen = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedOrder(data)
        setFullOrderData(data)
      }
    } catch (error) {
      console.error('Failed to auto-open order', error)
    }
  }

  const fetchOrders = async (overrideParams?: any) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      const s = overrideParams?.search ?? search
      const start = overrideParams?.startDate ?? startDate
      const end = overrideParams?.endDate ?? endDate
      const meths = overrideParams?.methods ?? selectedMethods
      const p = overrideParams?.page ?? page
      const limit = 50

      if (s) params.append('search', s)
      if (start) params.append('startDate', start)
      if (end) params.append('endDate', end)
      params.append('page', p.toString())
      params.append('limit', limit.toString())
      
      meths.forEach((m: string) => params.append('methods', m))

      const res = await fetch(`/api/orders?${params.toString()}`)
      const data = await res.json()
      
      const newOrders = data.orders || []
      if (p === 1) {
        setOrders(newOrders)
      } else {
        setOrders(prev => [...(prev || []), ...newOrders])
      }
      
      setHasMore(data.hasMore || false)
      setTotalCount(data.total || 0)
    } catch (error) {

      console.error('Failed to fetch orders', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    fetchOrders({ page: next })
  }

  const applyPresets = (val: 'today' | 'yesterday' | 'dayBefore') => {
    const today = new Date()
    let start: Date
    let end: Date

    if (val === 'today') {
      start = startOfDay(today)
      end = today
    } else if (val === 'yesterday') {
      start = startOfDay(subDays(today, 1))
      end = startOfDay(today)
    } else {
      start = startOfDay(subDays(today, 2))
      end = startOfDay(subDays(today, 1))
    }

    const s = format(start, 'yyyy-MM-dd')
    const e = format(end, 'yyyy-MM-dd')
    setStartDate(s)
    setEndDate(e)
    setPage(1)
    fetchOrders({ startDate: s, endDate: e, page: 1 })
  }

  const toggleMethod = (method: string) => {
    const next = selectedMethods.includes(method) 
      ? selectedMethods.filter(m => m !== method) 
      : [...selectedMethods, method]
    setSelectedMethods(next)
    // Instant feedback: trigger fetch with the new array & reset page
    setPage(1)
    fetchOrders({ methods: next, page: 1 })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      // When searching specifically, clear other refinements and reset page
      setStartDate('')
      setEndDate('')
      setSelectedMethods([])
      setPage(1)
      fetchOrders({ search: search, startDate: '', endDate: '', methods: [], page: 1 })
    } else {
      setPage(1)
      fetchOrders({ page: 1 })
    }
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedMethods([])
    setSearch('')
    setPage(1)
    fetchOrders({ search: '', startDate: '', endDate: '', methods: [], page: 1 })
  }

  const openOrderDetails = async (order: any) => {
    setSelectedOrder(order)
    // Fetch full data with items for printing
    try {
      const res = await fetch(`/api/orders/${order.id}`)
      const data = await res.json()
      setFullOrderData(data)
    } catch (error) {
      console.error('Failed to fetch order details', error)
    }
  }

  const handleReprint = (type: 'A4' | 'Thermal') => {
    if (!fullOrderData) return
    setPrintType(type)
  }

  const { refundOrder } = useStore()
  const [refunding, setRefunding] = useState(false)

  const handleRefund = async () => {
    if (!selectedOrder) return
    if (!confirm('Refund this order? Stock will be restored and it will be excluded from revenue and profit.')) return
    setRefunding(true)
    const res = await refundOrder(selectedOrder.id)
    setRefunding(false)
    if (res.success) {
      setSelectedOrder((o: any) => (o ? { ...o, status: 'REFUNDED' } : o))
      setFullOrderData((o: any) => (o ? { ...o, status: 'REFUNDED' } : o))
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: 'REFUNDED' } : o)))
    } else {
      alert(res.error || 'Refund failed')
    }
  }

  const getPaymentIcon = (method: string) => {
    const Icon = paymentIcon(method)
    return <Icon size={14} className="text-muted-foreground" />
  }

  const hasActiveFilters = !!(startDate || endDate || selectedMethods.length > 0)

  return (
    <div className="space-y-4 animate-in fade-in duration-300 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">Sales Archives</h1>
          <p className="text-[11px] text-muted-foreground truncate">Historical transactions & invoices</p>
        </div>
        <button
          onClick={() => fetchOrders()}
          aria-label="Refresh"
          className="h-10 w-10 shrink-0 rounded-xl border border-border bg-card flex items-center justify-center text-foreground/80 active:scale-95 transition-transform"
        >
          <RotateCw size={16} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Search + filter trigger */}
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Invoice / Name / Mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card h-12 pl-10 pr-3 rounded-xl border border-border focus:outline-none focus:border-primary/60 text-sm"
          />
        </form>
        <button
          onClick={() => setShowFilters(true)}
          aria-label="Filters"
          className={cn(
            'relative h-12 w-12 shrink-0 rounded-xl border flex items-center justify-center transition-colors',
            hasActiveFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground/80',
          )}
        >
          <Filter size={18} />
          {hasActiveFilters && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-background rounded-full" />}
        </button>
      </div>

      {/* Orders card list */}
      {loading && orders.length === 0 ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      ) : orders?.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm font-medium border-2 border-dashed border-border rounded-2xl">No matching records found.</div>
      ) : (
        <div className="space-y-2.5">
          {orders?.map((order) => (
            <button
              key={order.id}
              onClick={() => openOrderDetails(order)}
              className="w-full text-left bg-card rounded-2xl border border-border p-3.5 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold font-mono text-foreground text-sm flex items-center gap-1.5">
                  {order.invoiceNo}
                  {order.status === 'REFUNDED' && (
                    <span className="text-[8px] bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Refunded</span>
                  )}
                </span>
                <span className={cn('font-bold tabular-nums', order.status === 'REFUNDED' ? 'text-muted-foreground line-through' : 'text-foreground')}>{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{order.customerName || 'Cash Customer'}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(order.date), 'dd MMM yyyy, hh:mm a')}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary border border-border rounded-full shrink-0">
                  {getPaymentIcon(order.paymentMethod)}
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground">{paymentLabel(order.paymentMethod)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {order.processedBy?.name || 'System'} · {order.processedBy?.role || 'Admin'}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                  <Eye size={12} /> View
                </span>
              </div>
            </button>
          ))}

          {hasMore && orders.length > 0 && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                onClick={handleLoadMore}
                disabled={loading}
                variant="outline"
                className="h-11 w-full rounded-xl border-border hover:bg-accent text-xs font-medium"
              >
                {loading ? <RotateCw className="animate-spin mr-1.5" size={14} /> : <ChevronDown className="mr-1.5" size={14} />}
                Load Next 50 Records
              </Button>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">
                Showing {orders?.length || 0} of {totalCount} Transactions
              </p>
            </div>
          )}
        </div>
      )}

      {/* Filter bottom sheet */}
      {showFilters && (
        <div onClick={() => setShowFilters(false)} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 flex items-end">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-card border-t border-border rounded-t-2xl pb-safe animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-center pt-2.5"><div className="w-9 h-1 rounded-full bg-muted-foreground/25" /></div>
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent"><X size={16} /></button>
            </div>
            <div className="px-4 pb-4 space-y-5">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Quick Date</span>
                <div className="grid grid-cols-3 gap-2">
                  {[{ id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'dayBefore', label: '2 Days Ago' }].map(p => (
                    <button
                      key={p.id}
                      onClick={() => applyPresets(p.id as 'today' | 'yesterday' | 'dayBefore')}
                      className="py-2.5 rounded-xl bg-accent/30 border border-border text-[11px] font-medium active:bg-accent transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground block">Custom Range</span>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background border border-border rounded-xl px-3 h-11 text-xs text-foreground focus:outline-none" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background border border-border rounded-xl px-3 h-11 text-xs text-foreground focus:outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Payment Method</span>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => toggleMethod(code)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 h-11 rounded-xl border transition-all text-xs font-medium',
                        selectedMethods.includes(code) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground',
                      )}
                    >
                      {selectedMethods.includes(code) && <Check size={12} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button onClick={() => { clearFilters(); setShowFilters(false) }} className="flex-1 h-11 rounded-xl border border-border text-xs font-semibold text-destructive flex items-center justify-center gap-1.5 active:bg-accent">
                  <Trash2 size={14} /> Clear All
                </button>
                <Button onClick={() => { fetchOrders(); setShowFilters(false) }} className="flex-1 h-11 text-xs rounded-xl">Apply Filters</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Compact Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-card w-full max-w-lg rounded-lg border border-border shadow-lg animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-4 border-b border-border/40 flex items-center justify-between">
                 <div>
                    <span className="text-[10px] text-primary uppercase font-semibold tracking-wider mb-0.5 block">Transaction Record</span>
                    <h2 className="text-base font-semibold text-foreground">{selectedOrder.invoiceNo}</h2>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(selectedOrder.date), 'dd MMM yyyy, hh:mm a')}</p>
                 </div>
                 <Button 
                  variant="ghost"
                  size="icon"
                  onClick={() => { setSelectedOrder(null); setFullOrderData(null); }} 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                 >
                    <X size={16} />
                 </Button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                 <div className="grid grid-cols-2 gap-4 pb-3 border-b border-border/40">
                    <div className="space-y-0.5">
                       <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Customer</p>
                       <p className="font-semibold text-sm text-foreground">{selectedOrder.customerName || 'Cash Customer'}</p>
                       <p className="text-[11px] text-muted-foreground font-mono">{selectedOrder.customerMobile || 'No contact'}</p>
                    </div>
                    <div className="space-y-0.5">
                       <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Payment Mode</p>
                       <div className="flex items-center gap-1.5">
                          {getPaymentIcon(selectedOrder.paymentMethod)}
                          <p className="font-semibold text-sm text-foreground">{paymentLabel(selectedOrder.paymentMethod)}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between items-end border-b border-border/40 pb-1">
                       <h3 className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Order Items</h3>
                       <span className="text-[10px] font-medium text-muted-foreground">Qty x Price</span>
                    </div>
                    {fullOrderData ? (
                       <div className="space-y-2.5">
                          {fullOrderData.items.map((item: any, idx: number) => (
                             <div key={idx} className="flex justify-between items-center group">
                                <div className="space-y-0.5">
                                   <p className="font-medium text-sm text-foreground">{item.product.name}</p>
                                   <p className="text-[10px] text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                </div>
                                <span className="font-medium text-sm text-foreground tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
                             </div>
                          ))}
                       </div>
                    ) : (
                       <div className="py-6 flex flex-col items-center gap-2 animate-pulse">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <p className="text-[10px] font-medium text-muted-foreground">Loading Items...</p>
                       </div>
                    )}
                 </div>
              </div>

              {/* Modal Footer / Summary */}
              <div className="p-5 bg-accent/10 border-t border-border/40">
                 <div className="bg-card px-4 py-3 rounded-md border border-border/40 shadow-sm space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                       <span>Sub Total</span>
                       <span>{formatCurrency(selectedOrder.totalAmount - selectedOrder.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground border-b border-border/20 pb-1.5">
                       <span>Total TVA</span>
                       <span>{formatCurrency(selectedOrder.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5">
                       <span className="font-semibold text-sm text-foreground">Total Paid</span>
                       <span className="font-bold text-lg text-primary">{formatCurrency(selectedOrder.totalAmount)}</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleReprint('A4')}
                      className="h-9 rounded-md text-xs font-medium"
                    >
                       <Printer size={14} className="mr-1.5" /> Reprint A4
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleReprint('Thermal')}
                      className="h-9 rounded-md text-xs font-medium"
                    >
                       <Printer size={14} className="mr-1.5" /> Reprint 80mm
                    </Button>
                 </div>

                 {selectedOrder.status === 'REFUNDED' ? (
                    <div className="mt-2 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-wider">
                       <RotateCcw size={14} /> Refunded
                    </div>
                 ) : (
                    <Button
                      variant="outline"
                      onClick={handleRefund}
                      disabled={refunding}
                      className="mt-2 w-full h-10 rounded-xl text-xs font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                       <RotateCcw size={14} className={cn('mr-1.5', refunding && 'animate-spin')} />
                       {refunding ? 'Processing Refund...' : 'Refund Order'}
                    </Button>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Reprint Portals */}
      {printType && fullOrderData && (
        <PrintReceiptPortal 
          order={fullOrderData} 
          type={printType} 
          onClose={() => setPrintType(null)} 
        />
      )}
    </div>
  )
}

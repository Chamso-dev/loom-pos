import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Search, Calendar, Filter, Eye, Printer, ChevronRight, 
  CreditCard, Wallet, QrCode, ArrowLeft, RotateCw, X, Check,
  ChevronDown, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { format, startOfDay, subDays, formatISO } from 'date-fns'
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

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'CASH': return <Wallet size={14} className="text-emerald-500" />
      case 'UPI': return <QrCode size={14} className="text-primary" />
      case 'CARD': return <CreditCard size={14} className="text-blue-500" />
      default: return null
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1">Sales Archives</h1>
          <p className="text-sm text-muted-foreground">Search and review historical transactions and invoice records</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Advanced Filter Popover */}
          <div className="relative">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-9 px-3 gap-1.5 rounded-md border-border text-xs transition-all",
                (startDate || endDate || selectedMethods.length > 0) ? "bg-accent text-accent-foreground border-border" : "hover:bg-accent"
              )}
            >
               <Filter size={14} />
               <span className="font-medium">Filters</span>
               {(startDate || endDate || selectedMethods.length > 0) && (
                 <span className="w-1.5 h-1.5 bg-primary rounded-full" />
               )}
            </Button>

            {showFilters && (
              <div className="absolute top-11 right-0 w-[360px] bg-card border border-border shadow-lg rounded-md p-5 z-[99] animate-in zoom-in-95 duration-150">
                 <div className="space-y-5">
                    {/* Date Presets */}
                    <div className="space-y-2">
                       <span className="text-xs font-semibold text-muted-foreground">Quick Date Filter</span>
                       <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'dayBefore', label: '2 Days Ago' }
                          ].map(p => (
                            <button 
                              key={p.id}
                              onClick={() => applyPresets(p.id as  'today' | 'yesterday' | 'dayBefore')}
                              className="py-1.5 rounded-md bg-accent/30 border border-border text-[11px] font-medium hover:bg-accent hover:border-border-hover transition-all"
                            >
                                {p.label}
                            </button>
                          ))}
                       </div>
                    </div>

                    {/* Custom Date Range */}
                    <div className="space-y-2">
                       <span className="text-xs font-semibold text-muted-foreground block">Custom Range</span>
                       <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none" 
                          />
                          <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none" 
                          />
                       </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-2">
                       <span className="text-xs font-semibold text-muted-foreground">Payment Method</span>
                       <div className="flex flex-wrap gap-2">
                          {['CASH', 'UPI', 'CARD'].map(m => (
                            <button 
                              key={m}
                              onClick={() => toggleMethod(m)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-xs font-medium",
                                selectedMethods.includes(m) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
                              )}
                            >
                               {selectedMethods.includes(m) && <Check size={12} />}
                               {m}
                            </button>
                          ))}
                       </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                       <button onClick={clearFilters} className="text-xs font-medium text-destructive hover:underline flex items-center gap-1">
                          <Trash2 size={13} /> Clear All
                       </button>
                       <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => { fetchOrders(); setShowFilters(false); }}
                        className="h-8 text-xs rounded-md"
                       >
                          Apply Filters
                       </Button>
                    </div>
                 </div>
              </div>
            )}
          </div>

          <Button 
            variant="outline" 
            onClick={() => fetchOrders()}
            className="h-9 w-9 rounded-md border-border hover:bg-accent flex items-center justify-center p-0"
          >
             <RotateCw size={15} className={cn(loading && "animate-spin")} />
          </Button>
          
          <form onSubmit={handleSearch} className="flex items-center gap-2">
             <div className="relative group text-foreground">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" size={15} />
                <input 
                  type="text" 
                  placeholder="Invoice / Name / Mobile" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-background w-64 h-9 pl-9 pr-4 rounded-md border border-border focus:outline-none text-sm"
                />
             </div>
             <Button type="submit" variant="default" className="h-9 px-4 rounded-md text-xs">
                Search
             </Button>
          </form>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left">
           <thead>
              <tr className="border-b border-border/40 bg-accent/20">
                 <th className="px-6 py-4 text-xs font-semibold text-muted-foreground">Invoice</th>
                 <th className="px-6 py-4 text-xs font-semibold text-muted-foreground">Date & Time</th>
                 <th className="px-6 py-4 text-xs font-semibold text-muted-foreground">Customer</th>
                 <th className="px-6 py-4 text-xs font-semibold text-muted-foreground">Amount</th>
                 <th className="px-6 py-4 text-xs font-semibold text-muted-foreground">Staff</th>
                 <th className="px-6 py-4 text-xs font-semibold text-muted-foreground">Method</th>
                 <th className="px-6 py-4 text-xs font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-border/20">
              {loading ? (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center animate-pulse text-muted-foreground text-sm font-medium">
                      Retrieving Archives...
                   </td>
                </tr>
              ) : orders?.length === 0 ? (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">
                      No matching records found.
                   </td>
                </tr>
              ) : orders?.map((order) => (
                <tr key={order.id} className="hover:bg-accent/40 transition-colors group">
                   <td className="px-6 py-4">
                      <span className="font-semibold font-mono text-foreground text-sm">{order.invoiceNo}</span>
                   </td>
                   <td className="px-6 py-4">
                      <div className="flex flex-col">
                         <span className="font-medium text-sm text-foreground">{format(new Date(order.date), 'dd MMM yyyy')}</span>
                         <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{format(new Date(order.date), 'hh:mm a')}</span>
                      </div>
                   </td>
                   <td className="px-6 py-4">
                      <div className="flex flex-col">
                         <span className="font-medium text-sm text-foreground">{order.customerName || 'Cash Customer'}</span>
                         <span className="text-[10px] font-mono text-muted-foreground">{order.customerMobile || '-'}</span>
                      </div>
                   </td>
                   <td className="px-6 py-4 text-sm font-medium text-foreground tabular-nums">
                      {formatCurrency(order.totalAmount)}
                   </td>
                   <td className="px-6 py-4">
                      <div className="flex flex-col">
                         <span className="font-medium text-xs text-foreground">
                            {order.processedBy?.name || 'System'}
                            {order.processedBy && !order.processedBy.isActive && (
                              <span className="ml-1 text-[8px] text-muted-foreground italic">(Ex-Staff)</span>
                            )}
                         </span>
                         <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{order.processedBy?.role || 'Admin'}</span>
                      </div>
                   </td>
                   <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-background border border-border/40 rounded-full w-fit">
                         {getPaymentIcon(order.paymentMethod)}
                         <span className="text-[10px] font-medium uppercase tracking-wider text-foreground">{order.paymentMethod}</span>
                      </div>
                   </td>

                   <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        onClick={() => openOrderDetails(order)}
                        className="rounded-md h-8 text-xs hover:bg-accent"
                      >
                         <Eye size={14} className="mr-1.5" /> View
                      </Button>
                   </td>
                </tr>
              ))}
           </tbody>
        </table>

        {/* Load More Button */}
        {hasMore && orders && orders.length > 0 && (
           <div className="p-6 border-t border-border/20 flex flex-col items-center gap-3 bg-accent/5">
              <Button 
                onClick={handleLoadMore} 
                disabled={loading}
                variant="outline"
                className="h-9 px-6 rounded-md border-border hover:bg-accent text-xs font-medium transition-all"
              >
                 {loading ? <RotateCw className="animate-spin mr-1.5" size={14} /> : <ChevronDown className="mr-1.5" size={14} />}
                 Load Next 50 Records
              </Button>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">
                 Showing {orders?.length || 0} of {totalCount} Historical Transactions
              </p>
           </div>
        )}
      </div>

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
                          <p className="font-semibold text-sm uppercase text-foreground">{selectedOrder.paymentMethod}</p>
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
                       <span>Total GST</span>
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

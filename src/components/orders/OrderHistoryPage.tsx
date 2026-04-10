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
      
      if (p === 1) {
        setOrders(data.orders)
      } else {
        setOrders(prev => [...prev, ...data.orders])
      }
      
      setHasMore(data.hasMore)
      setTotalCount(data.total)
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
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Sales Archives</h1>
          <p className="text-muted-foreground text-xs uppercase tracking-[0.3em] font-bold">Historical Invoice Management</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Advanced Filter Popover */}
          <div className="relative">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-12 px-5 gap-2 rounded-2xl border-border/40 transition-all active:scale-95",
                (startDate || endDate || selectedMethods.length > 0) ? "bg-primary/10 border-primary text-primary" : "hover:bg-accent"
              )}
            >
               <Filter size={18} />
               <span className="text-[10px] uppercase font-black tracking-widest">Filters</span>
               {(startDate || endDate || selectedMethods.length > 0) && (
                 <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
               )}
            </Button>

            {showFilters && (
              <div className="absolute top-14 right-0 w-[400px] bg-card border border-border/60 shadow-2xl rounded-[2rem] p-6 z-[99] animate-in zoom-in-95 slide-in-from-top-2 duration-200">
                 <div className="space-y-6">
                    {/* Date Presets */}
                    <div className="space-y-3">
                       <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest pl-1">Quick Date Filter</span>
                       <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'dayBefore', label: '2 Days Ago' }
                          ].map(p => (
                            <button 
                              key={p.id}
                              onClick={() => applyPresets(p.id as  'today' | 'yesterday' | 'dayBefore')}
                              className="py-2 rounded-xl bg-accent/20 border border-border/40 text-[9px] font-black uppercase hover:bg-primary/5 hover:border-primary/40 transition-all"
                            >
                               {p.label}
                            </button>
                          ))}
                       </div>
                    </div>

                    {/* Custom Date Range */}
                    <div className="space-y-3">
                       <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest pl-1 text-center block">Custom Range</span>
                       <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-accent/10 border border-border/40 rounded-xl px-3 py-2 text-[10px] focus:ring-1 focus:ring-primary outline-none" 
                          />
                          <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-accent/10 border border-border/40 rounded-xl px-3 py-2 text-[10px] focus:ring-1 focus:ring-primary outline-none" 
                          />
                       </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-3">
                       <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest pl-1">Payment Method (Multi-select)</span>
                       <div className="flex flex-wrap gap-2">
                          {['CASH', 'UPI', 'CARD'].map(m => (
                            <button 
                              key={m}
                              onClick={() => toggleMethod(m)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase",
                                selectedMethods.includes(m) ? "bg-primary text-white border-primary" : "bg-accent/20 border-border/40"
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
                       <button onClick={clearFilters} className="text-[10px] uppercase font-black text-red-500 hover:underline flex items-center gap-1">
                          <Trash2 size={12} /> Clear All
                       </button>
                       <Button 
                        variant="premium" 
                        size="sm" 
                        onClick={() => { fetchOrders(); setShowFilters(false); }}
                        className="px-6 rounded-xl uppercase font-black tracking-widest text-[9px]"
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
            className="h-12 w-12 rounded-2xl border-border/40 hover:bg-accent flex items-center justify-center p-0"
          >
             <RotateCw size={18} className={cn(loading && "animate-spin")} />
          </Button>
          
          <form onSubmit={handleSearch} className="flex items-center gap-2">
             <div className="relative group text-foreground">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary" size={18} />
                <input 
                  type="text" 
                  placeholder="Invoice / Name / Mobile" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-card w-64 h-12 pl-10 pr-4 rounded-2xl border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-sm"
                />
             </div>
             <Button type="submit" variant="premium" className="h-12 px-6 rounded-2xl uppercase font-black tracking-widest text-xs shadow-lg shadow-primary/10">
                Search
             </Button>
          </form>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card/50 backdrop-blur-xl rounded-[2.5rem] border border-border/40 shadow-2xl overflow-hidden">
        <table className="w-full text-left">
           <thead>
              <tr className="border-b border-border/40 bg-accent/10">
                 <th className="px-8 py-6 text-[10px] uppercase font-black tracking-[0.2em] opacity-60">Invoice</th>
                 <th className="px-8 py-6 text-[10px] uppercase font-black tracking-[0.2em] opacity-60">Date & Time</th>
                 <th className="px-8 py-6 text-[10px] uppercase font-black tracking-[0.2em] opacity-60">Customer</th>
                 <th className="px-8 py-6 text-[10px] uppercase font-black tracking-[0.2em] opacity-60">Amount</th>
                 <th className="px-8 py-6 text-[10px] uppercase font-black tracking-[0.2em] opacity-60">Method</th>
                 <th className="px-8 py-6 text-[10px] uppercase font-black tracking-[0.2em] opacity-60 text-right">Actions</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-border/20">
              {loading ? (
                <tr>
                   <td colSpan={6} className="px-8 py-20 text-center animate-pulse text-muted-foreground uppercase font-black tracking-widest">
                      Retrieving Archives...
                   </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                   <td colSpan={6} className="px-8 py-20 text-center text-muted-foreground uppercase font-black tracking-widest">
                      No matching records found.
                   </td>
                </tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="hover:bg-primary/5 transition-colors group">
                   <td className="px-8 py-6">
                      <span className="font-black font-mono text-primary">{order.invoiceNo}</span>
                   </td>
                   <td className="px-8 py-6">
                      <div className="flex flex-col">
                         <span className="font-bold text-sm">{format(new Date(order.date), 'dd MMM yyyy')}</span>
                         <span className="text-[10px] uppercase tracking-widest opacity-50">{format(new Date(order.date), 'hh:mm a')}</span>
                      </div>
                   </td>
                   <td className="px-8 py-6">
                      <div className="flex flex-col">
                         <span className="font-bold text-sm">{order.customerName || 'Cash Customer'}</span>
                         <span className="text-[10px] font-mono opacity-50">{order.customerMobile || '-'}</span>
                      </div>
                   </td>
                   <td className="px-8 py-6">
                      <span className="font-black tabular-nums">{formatCurrency(order.totalAmount)}</span>
                   </td>
                   <td className="px-8 py-6">
                      <div className="flex items-center gap-2 px-3 py-1 bg-background border border-border/40 rounded-full w-fit">
                         {getPaymentIcon(order.paymentMethod)}
                         <span className="text-[10px] font-black uppercase tracking-widest">{order.paymentMethod}</span>
                      </div>
                   </td>
                   <td className="px-8 py-6 text-right">
                      <Button 
                        variant="ghost" 
                        onClick={() => openOrderDetails(order)}
                        className="rounded-xl hover:bg-primary hover:text-white transition-all group-hover:px-6"
                      >
                         <Eye size={16} className="mr-2" /> View
                      </Button>
                   </td>
                </tr>
              ))}
           </tbody>
        </table>

        {/* Load More Button */}
        {hasMore && (
           <div className="p-8 border-t border-border/20 flex flex-col items-center gap-4 bg-accent/5">
              <Button 
                onClick={handleLoadMore} 
                disabled={loading}
                variant="outline"
                className="h-14 px-10 rounded-2xl border-primary/40 hover:bg-primary hover:text-white font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl shadow-primary/5 active:scale-95"
              >
                 {loading ? <RotateCw className="animate-spin mr-2" size={16} /> : <ChevronDown className="mr-2" size={16} />}
                 Load Next 50 Records
              </Button>
              <p className="text-[9px] uppercase font-black text-muted-foreground opacity-40 tracking-widest">
                 Showing {orders.length} of {totalCount} Historical Transactions
              </p>
           </div>
        )}
      </div>

      {/* Order Details Compact Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-card w-full max-w-lg rounded-[2.5rem] border border-border/60 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-border/40 flex items-center justify-between bg-accent/10 relative">
                 <div>
                    <span className="text-[9px] text-primary uppercase font-black tracking-[0.2em] mb-1 block">Transaction Record</span>
                    <h2 className="text-2xl font-black tracking-tighter uppercase italic">{selectedOrder.invoiceNo}</h2>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{format(new Date(selectedOrder.date), 'dd MMM yyyy, hh:mm a')}</p>
                 </div>
                 <button 
                  onClick={() => { setSelectedOrder(null); setFullOrderData(null); }} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-background rounded-full border border-border/40 transition-all shadow-sm active:scale-95"
                 >
                    <X size={20} />
                 </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                 <div className="grid grid-cols-2 gap-6 pb-2 border-b border-border/40">
                    <div className="space-y-0.5">
                       <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Customer</p>
                       <p className="font-bold text-base tracking-tight">{selectedOrder.customerName || 'Cash Customer'}</p>
                       <p className="text-[10px] opacity-60 font-mono italic">{selectedOrder.customerMobile || 'No contact'}</p>
                    </div>
                    <div className="space-y-0.5">
                       <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Payment Mode</p>
                       <div className="flex items-center gap-2">
                          {getPaymentIcon(selectedOrder.paymentMethod)}
                          <p className="font-bold text-base uppercase tracking-tight">{selectedOrder.paymentMethod}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <div className="flex justify-between items-end border-b border-border/40 pb-1">
                       <h3 className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Order Items</h3>
                       <span className="text-[9px] uppercase font-bold opacity-40">Qty x Price</span>
                    </div>
                    {fullOrderData ? (
                       <div className="space-y-3">
                          {fullOrderData.items.map((item: any, idx: number) => (
                             <div key={idx} className="flex justify-between items-center group">
                                <div className="space-y-0.5">
                                   <p className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{item.product.name}</p>
                                   <p className="text-[9px] opacity-40 uppercase font-bold">{item.quantity} x {formatCurrency(item.price)}</p>
                                </div>
                                <span className="font-bold text-sm tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
                             </div>
                          ))}
                       </div>
                    ) : (
                       <div className="py-8 flex flex-col items-center gap-3 animate-pulse">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <p className="text-[9px] uppercase font-black tracking-widest opacity-40">Loading Archive...</p>
                       </div>
                    )}
                 </div>
              </div>

              {/* Modal Footer / Summary */}
              <div className="p-6 bg-accent/20 border-t border-border/40">
                 <div className="bg-card px-5 py-4 rounded-3xl border border-border/40 shadow-lg space-y-2 mb-6">
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                       <span>Sub Total</span>
                       <span>{formatCurrency(selectedOrder.totalAmount - selectedOrder.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase border-b border-border/20 pb-2">
                       <span>Total GST</span>
                       <span>{formatCurrency(selectedOrder.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                       <span className="font-black text-lg uppercase italic tracking-tighter">Total Paid</span>
                       <span className="font-black text-2xl tracking-tighter text-primary">{formatCurrency(selectedOrder.totalAmount)}</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <Button 
                      onClick={() => handleReprint('A4')}
                      className="h-12 rounded-xl bg-white text-black border border-border/40 hover:bg-black hover:text-white transition-all font-black uppercase tracking-widest text-[9px]"
                    >
                       <Printer size={14} className="mr-2" /> Reprint A4
                    </Button>
                    <Button 
                      onClick={() => handleReprint('Thermal')}
                      className="h-12 rounded-xl bg-primary text-white hover:opacity-90 transition-all font-black uppercase tracking-widest text-[9px] shadow-lg shadow-primary/20"
                    >
                       <Printer size={14} className="mr-2" /> Reprint 80mm
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

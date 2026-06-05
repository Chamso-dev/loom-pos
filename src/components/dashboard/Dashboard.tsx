import React, { useEffect, useState } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts'
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight, 
  Wallet, QrCode, CreditCard, Clock
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import EndOfDaySummary from './EndOfDaySummary'

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [salesData, setSalesData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showEOD, setShowEOD] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, salesRes] = await Promise.all([
          fetch('/api/analytics/summary'),
          fetch('/api/analytics/sales')
        ])
        const sumData = await sumRes.json()
        const sales = await salesRes.json()
        setSummary(sumData)
        setSalesData(sales)
      } catch (error) {
        console.error('Failed to fetch dashboard data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="p-8 animate-pulse text-muted-foreground uppercase tracking-widest font-black">Loading Intelligence...</div>
  }

  const stats = [
    { 
      label: "Today's Revenue", 
      value: formatCurrency(summary?.revenue || 0), 
      icon: DollarSign, 
      color: "text-emerald-500", 
      bg: "bg-emerald-500/10",
      trend: "+12.5%",
      isPositive: true
    },
    { 
      label: "Total Sales", 
      value: summary?.orders || 0, 
      icon: ShoppingBag, 
      color: "text-primary", 
      bg: "bg-primary/10",
      trend: "+3 this hour",
      isPositive: true
    },
    { 
      label: "Total GST", 
      value: formatCurrency(summary?.gst || 0), 
      icon: TrendingUp, 
      color: "text-blue-500", 
      bg: "bg-blue-500/10",
      trend: "Tax Liability",
      isPositive: null
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-xs font-medium">Real-time performance metrics</p>
        </div>
        <div className="bg-card px-3.5 py-1.5 rounded-md border border-border text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
           <Clock size={12} className="text-muted-foreground" />
           {format(new Date(), 'dd MMM yyyy')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((s, idx) => (
          <div key={idx} className="bg-card p-5 rounded-md border border-border shadow-sm hover:shadow transition-all group">
            <div className="flex justify-between items-start mb-3">
               <div className={cn("p-2 rounded bg-secondary border border-border", s.color)}>
                  <s.icon size={18} />
               </div>
               {s.isPositive !== null && (
                 <div className={cn(
                   "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase",
                   s.isPositive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
                 )}>
                    {s.isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {s.trend}
                 </div>
               )}
            </div>
            <div>
               <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">{s.label}</p>
               <h3 className="text-2xl font-bold tracking-tight">{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-card p-6 rounded-md border border-border shadow-sm">
           <div className="flex justify-between items-center mb-6">
              <div>
                 <h2 className="text-sm font-bold uppercase tracking-wider">Revenue Stream</h2>
                 <p className="text-[10px] text-muted-foreground font-medium">Last 7 days activity</p>
              </div>
              <div className="flex gap-2">
                 <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-secondary border border-border rounded-full text-[9px] font-bold text-muted-foreground uppercase">
                    <TrendingUp size={10} /> Trend
                 </div>
              </div>
           </div>
           
           <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={salesData}>
                    <defs>
                       <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.05]" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: 'currentColor', fontSize: 9, fontWeight: 500}}
                      tickFormatter={(str) => format(new Date(str), 'ccc')}
                      dy={8}
                    />
                    <YAxis 
                      hide
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'oklch(var(--color-card))', borderRadius: '6px', border: '1px solid oklch(var(--color-border))', fontSize: '11px' }}
                      labelStyle={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '9px', opacity: 0.8 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="oklch(var(--color-foreground) / 0.8)" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorAmount)" 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-card p-6 rounded-md border border-border shadow-sm flex flex-col justify-between">
           <div className="space-y-4">
              <div>
                 <h2 className="text-sm font-bold uppercase tracking-wider">Cash Drawer</h2>
                 <p className="text-[10px] text-muted-foreground font-medium">Payment methods breakdown</p>
              </div>

              <div className="space-y-3 pt-2">
                 {[
                   { label: 'Cash', icon: Wallet, method: 'CASH', color: 'text-emerald-500' },
                   { label: 'UPI / Digital', icon: QrCode, method: 'UPI', color: 'text-primary' },
                   { label: 'Card', icon: CreditCard, method: 'CARD', color: 'text-blue-500' },
                 ].map((m) => {
                   const amount = summary?.paymentBreakdown?.find((p: any) => p.paymentMethod === m.method)?._sum?.totalAmount || 0
                   const percent = summary?.revenue ? (amount / summary.revenue) * 100 : 0

                   return (
                     <div key={m.method} className="space-y-1.5">
                       <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                             <m.icon size={12} className={m.color} />
                             <span className="text-[9px] uppercase font-bold text-muted-foreground">{m.label}</span>
                          </div>
                          <span className="font-semibold text-foreground">{formatCurrency(amount)}</span>
                       </div>
                       <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden border border-border/20">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", m.color.replace('text', 'bg').replace('-500', '-600 dark:bg-emerald-500'))}
                            style={{ width: `${percent}%` }}
                          />
                       </div>
                     </div>
                   )
                 })}
              </div>
           </div>

           <div className="pt-4 border-t border-border mt-4">
              <button 
                onClick={() => setShowEOD(true)}
                className="w-full py-2.5 rounded-md bg-secondary border border-border text-foreground hover:bg-accent font-semibold text-xs transition-all active:scale-[0.99]"
              >
                 Close Day Summary (EOD)
              </button>
           </div>
        </div>
      </div>

      {showEOD && (
        <EndOfDaySummary 
          summary={summary} 
          onClose={() => setShowEOD(false)} 
        />
      )}
    </div>
  )
}

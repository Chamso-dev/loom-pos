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
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Control Center</h1>
          <p className="text-muted-foreground text-xs uppercase tracking-[0.3em] font-bold">Real-time Performance Metrics</p>
        </div>
        <div className="bg-card px-4 py-2 rounded-2xl border border-border/40 text-xs font-black uppercase flex items-center gap-2">
           <Clock size={14} className="text-primary" />
           {format(new Date(), 'dd MMMM yyyy')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, idx) => (
          <div key={idx} className="bg-card/50 backdrop-blur-xl p-6 rounded-3xl border border-border/40 shadow-xl shadow-primary/5 hover:border-primary/40 transition-all group">
            <div className="flex justify-between items-start mb-4">
               <div className={cn("p-3 rounded-2xl border border-border/10", s.bg, s.color)}>
                  <s.icon size={24} />
               </div>
               {s.isPositive !== null && (
                 <div className={cn(
                   "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                   s.isPositive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
                 )}>
                   {s.isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                   {s.trend}
                 </div>
               )}
            </div>
            <div>
               <p className="text-xs text-muted-foreground uppercase font-black tracking-widest opacity-60 mb-1">{s.label}</p>
               <h3 className="text-3xl font-black tracking-tighter">{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-card/50 backdrop-blur-xl p-8 rounded-[2rem] border border-border/40 shadow-2xl">
           <div className="flex justify-between items-center mb-8">
              <div>
                 <h2 className="text-xl font-black tracking-tight uppercase">Revenue Stream</h2>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Last 7 Days Activity</p>
              </div>
              <div className="flex gap-2">
                 <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase">
                    <TrendingUp size={12} /> Moving Up
                 </div>
              </div>
           </div>
           
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={salesData}>
                    <defs>
                       <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.05]" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: 'currentColor', fontSize: 10, fontWeight: 900}}
                      tickFormatter={(str) => format(new Date(str), 'ccc')}
                      dy={10}
                    />
                    <YAxis 
                      hide
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgb(var(--color-card))', borderRadius: '16px', border: '1px solid rgba(var(--color-foreground), 0.1)' }}
                      labelStyle={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="var(--color-primary)" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorAmount)" 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-card/50 backdrop-blur-xl p-8 rounded-[2rem] border border-border/40 shadow-2xl space-y-6">
           <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Cash Drawer</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Payment Methods Breakdown</p>
           </div>

           <div className="space-y-4">
              {[
                { label: 'Cash', icon: Wallet, method: 'CASH', color: 'text-emerald-500' },
                { label: 'UPI / Digital', icon: QrCode, method: 'UPI', color: 'text-primary' },
                { label: 'Card', icon: CreditCard, method: 'CARD', color: 'text-blue-500' },
              ].map((m) => {
                const amount = summary?.paymentBreakdown?.find((p: any) => p.paymentMethod === m.method)?._sum?.totalAmount || 0
                const percent = summary?.revenue ? (amount / summary.revenue) * 100 : 0

                return (
                  <div key={m.method} className="space-y-2">
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-2">
                          <m.icon size={14} className={m.color} />
                          <span className="text-[10px] uppercase font-black tracking-widest">{m.label}</span>
                       </div>
                       <span className="text-xs font-black">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 w-full bg-accent/20 rounded-full overflow-hidden">
                       <div 
                         className={cn("h-full rounded-full transition-all duration-1000", m.color.replace('text', 'bg'))}
                         style={{ width: `${percent}%` }}
                       />
                    </div>
                  </div>
                )
              })}
           </div>

           <div className="pt-4 border-t border-border/40">
              <button 
                onClick={() => setShowEOD(true)}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
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

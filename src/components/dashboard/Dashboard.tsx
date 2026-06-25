import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, DollarSign, ShoppingBag, Boxes, RotateCcw, Crown, Coins,
  PackageX, CalendarClock, Users, Truck, Receipt, Clock, ChevronRight, Sparkles,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import EndOfDaySummary from './EndOfDaySummary'

export default function Dashboard() {
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEOD, setShowEOD] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/analytics/dashboard')
        if (res.ok) setD(await res.json())
      } catch (e) {
        console.error('Failed to load dashboard', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-28 rounded-2xl bg-card border border-border" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-card border border-border" />)}
        </div>
      </div>
    )
  }

  const s = d || {}

  return (
    <div className="space-y-4 font-sans pb-2">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <Sparkles size={18} className="text-primary" /> Dashboard
          </h1>
          <p className="text-muted-foreground text-[11px] font-medium">Live business overview</p>
        </div>
        <div className="bg-card px-3 py-1.5 rounded-xl border border-border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <Clock size={12} className="text-muted-foreground" />
          {format(new Date(), 'dd MMM')}
        </div>
      </div>

      {/* TOP: Today's Profit hero */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/[0.02] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Today's Profit</p>
          <div className="p-1.5 rounded-lg bg-primary/15 text-primary"><Coins size={16} /></div>
        </div>
        <p className="text-3xl font-bold tracking-tight tabular-nums mt-1.5 text-foreground">{formatCurrency(s.todayProfit || 0)}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Revenue minus cost of goods sold today</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Products Sold Today" value={s.productsSoldToday ?? 0} icon={ShoppingBag} tone="blue" />
        <Stat label="Today's Revenue" value={formatCurrency(s.todayRevenue || 0)} icon={DollarSign} tone="emerald" />

        {/* SECOND ROW */}
        <Stat label="Total Stock" value={s.totalStock ?? 0} sub={`${s.totalProducts ?? 0} products`} icon={Boxes} tone="slate" onClick={() => navigate('/inventory')} />
        <Stat
          label="Today's Refunds"
          value={s.refundsToday?.count ?? 0}
          sub={s.refundsToday?.amount ? formatCurrency(s.refundsToday.amount) : 'None'}
          icon={RotateCcw}
          tone={s.refundsToday?.count ? 'red' : 'slate'}
        />
      </div>

      {/* THIRD ROW: best seller / most profitable */}
      <div className="grid grid-cols-2 gap-3">
        <Highlight label="Best Selling" icon={Crown} tone="amber" name={s.bestSelling?.name} detail={s.bestSelling ? `${s.bestSelling.qty} sold` : '—'} />
        <Highlight label="Most Profitable" icon={TrendingUp} tone="emerald" name={s.mostProfitable?.name} detail={s.mostProfitable ? formatCurrency(s.mostProfitable.profit) : '—'} />
      </div>

      {/* FOURTH ROW: alerts */}
      <div className="grid grid-cols-2 gap-3">
        <AlertCard
          label="Low Stock"
          icon={PackageX}
          count={s.lowStock?.count ?? 0}
          items={(s.lowStock?.items || []).map((p: any) => ({ name: p.name, tag: p.weighted ? `${p.stock} kg` : `${p.stock}` }))}
          onClick={() => navigate('/inventory')}
          emptyText="All stocked"
        />
        <AlertCard
          label="Expiry Alerts"
          icon={CalendarClock}
          count={s.expiry?.count ?? 0}
          items={(s.expiry?.items || []).map((p: any) => ({ name: p.name, tag: p.days < 0 ? 'expired' : p.days === 0 ? 'today' : `${p.days}d` }))}
          onClick={() => navigate('/inventory')}
          emptyText="None expiring"
        />
      </div>

      {/* FIFTH ROW: counts */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Customers" value={s.totalCustomers ?? 0} icon={Users} tone="blue" onClick={() => navigate('/management')} />
        <Stat label="Total Suppliers" value={s.totalSuppliers ?? 0} icon={Truck} tone="slate" onClick={() => navigate('/management')} />
      </div>

      {/* BOTTOM: recent transactions */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5"><Receipt size={14} /> Recent Transactions</h2>
          <button onClick={() => navigate('/orders')} className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center">All <ChevronRight size={12} /></button>
        </div>
        {(s.recent || []).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No transactions yet</p>
        ) : (
          <div className="divide-y divide-border/60">
            {s.recent.map((o: any) => (
              <button key={o.id} onClick={() => navigate(`/orders?orderId=${o.id}`)} className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-accent/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground font-mono flex items-center gap-1.5">
                    {o.invoiceNo}
                    {o.status === 'REFUNDED' && <span className="text-[8px] bg-destructive/10 text-destructive px-1 py-0.5 rounded font-bold uppercase">Ref</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{o.customerName || 'Walk-in'} · {format(new Date(o.date), 'dd MMM, hh:mm a')}</p>
                </div>
                <span className={cn('text-sm font-bold tabular-nums shrink-0', o.status === 'REFUNDED' ? 'text-muted-foreground line-through' : 'text-foreground')}>{formatCurrency(o.totalAmount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowEOD(true)}
        className="w-full py-3 rounded-2xl bg-secondary border border-border text-foreground font-semibold text-xs active:scale-[0.99] transition-transform"
      >
        Close Day Summary (EOD)
      </button>

      {showEOD && <EndOfDaySummary summary={{ revenue: s.todayRevenue, orders: s.recent?.length, gst: 0, paymentBreakdown: [] }} onClose={() => setShowEOD(false)} />}
    </div>
  )
}

const TONES: Record<string, string> = {
  emerald: 'text-emerald-500 bg-emerald-500/10',
  blue: 'text-blue-500 bg-blue-500/10',
  amber: 'text-amber-500 bg-amber-500/10',
  red: 'text-red-500 bg-red-500/10',
  slate: 'text-muted-foreground bg-secondary',
}

function Stat({ label, value, sub, icon: Icon, tone = 'slate', onClick }: {
  label: string; value: React.ReactNode; sub?: string; icon: any; tone?: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn('text-left bg-card p-3.5 rounded-2xl border border-border shadow-sm transition-transform', onClick && 'active:scale-[0.98]')}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
        <div className={cn('p-1.5 rounded-lg', TONES[tone])}><Icon size={15} /></div>
      </div>
      <p className="text-xl font-bold tracking-tight tabular-nums mt-1.5 text-foreground truncate">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </button>
  )
}

function Highlight({ label, name, detail, icon: Icon, tone }: { label: string; name?: string; detail: string; icon: any; tone: string }) {
  return (
    <div className="bg-card p-3.5 rounded-2xl border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
        <div className={cn('p-1.5 rounded-lg', TONES[tone])}><Icon size={15} /></div>
      </div>
      <p className="text-sm font-bold text-foreground mt-1.5 truncate">{name || '—'}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{detail}</p>
    </div>
  )
}

function AlertCard({ label, icon: Icon, count, items, onClick, emptyText }: {
  label: string; icon: any; count: number; items: { name: string; tag: string }[]; onClick: () => void; emptyText: string
}) {
  const active = count > 0
  return (
    <button onClick={onClick} className={cn('text-left p-3.5 rounded-2xl border shadow-sm active:scale-[0.98] transition-transform', active ? 'bg-orange-500/[0.06] border-orange-500/25' : 'bg-card border-border')}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
        <div className={cn('p-1.5 rounded-lg', active ? 'bg-orange-500/15 text-orange-500' : TONES.slate)}><Icon size={15} /></div>
      </div>
      <p className={cn('text-xl font-bold tabular-nums mt-1.5', active ? 'text-orange-500' : 'text-foreground')}>{count}</p>
      {active ? (
        <div className="mt-1 space-y-0.5">
          {items.map((it, i) => (
            <p key={i} className="text-[10px] text-muted-foreground truncate flex justify-between gap-1">
              <span className="truncate">{it.name}</span><span className="font-bold text-foreground/70 shrink-0">{it.tag}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-0.5">{emptyText}</p>
      )}
    </button>
  )
}

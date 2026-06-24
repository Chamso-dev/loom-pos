import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, ShoppingBag, DollarSign, Clock,
  HeartPulse, PackageX, Truck, ArrowUpRight, ArrowDownRight, Boxes,
  AlertTriangle, Sparkles, Wallet, QrCode, CreditCard, Crown,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { BusinessIntelligence } from '@/lib/intelligence'
import EndOfDaySummary from './EndOfDaySummary'

const statusColor: Record<string, string> = {
  out: 'text-red-500 bg-red-500/10 border-red-500/20',
  critical: 'text-red-500 bg-red-500/10 border-red-500/20',
  low: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  dead: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
  overstock: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  healthy: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-500'
  if (score >= 70) return 'text-emerald-500'
  if (score >= 50) return 'text-amber-500'
  return 'text-red-500'
}

export default function Dashboard() {
  const [bi, setBi] = useState<BusinessIntelligence | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEOD, setShowEOD] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        const [biRes, sumRes] = await Promise.all([
          fetch('/api/analytics/intelligence'),
          fetch('/api/analytics/summary'),
        ])
        setBi(await biRes.json())
        setSummary(await sumRes.json())
      } catch (e) {
        console.error('Failed to load intelligence', e)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  if (loading || !bi) {
    return <div className="py-16 text-center animate-pulse text-muted-foreground uppercase tracking-widest font-black text-xs">Analysing your business…</div>
  }

  const h = bi.headline
  const health = bi.inventoryHealth
  const trend = bi.salesTrend

  // Combined revenue chart series (history + forecast).
  const chartData = [
    ...bi.revenueForecast.dailyHistory.map((d) => ({ date: d.date, actual: d.amount, forecast: null as number | null })),
    ...bi.revenueForecast.dailyForecast.map((d) => ({ date: d.date, actual: null as number | null, forecast: d.amount })),
  ]
  const firstForecastIdx = bi.revenueForecast.dailyHistory.length

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <Sparkles size={18} className="text-primary" /> Intelligence
          </h1>
          <p className="text-muted-foreground text-[11px] font-medium">Live business insights</p>
        </div>
        <div className="bg-card px-3 py-1.5 rounded-xl border border-border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <Clock size={12} className="text-muted-foreground" />
          {format(new Date(), 'dd MMM')}
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard className="col-span-2" icon={<DollarSign size={18} />} iconColor="text-emerald-500" label="Today's Revenue" value={formatCurrency(h.revenueToday)} sub={`${h.ordersToday} orders · avg ${formatCurrency(h.avgOrderValue)}`} big />
        <StatCard icon={<ShoppingBag size={18} />} iconColor="text-primary" label="30-Day Revenue" value={formatCurrency(h.revenue30)} />
        <StatCard icon={<TrendingUp size={18} />} iconColor="text-blue-500" label="30-Day Profit" value={formatCurrency(h.profit30)} />
      </div>

      {/* Inventory Health Score */}
      <Section>
        <div className="flex items-center justify-between">
          <SectionTitle icon={<HeartPulse size={14} />}>Inventory Health</SectionTitle>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', scoreColor(health.score), 'border-current/20')}>{health.grade}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <ScoreRing score={health.score} />
          <div className="flex-1 grid grid-cols-2 gap-2">
            <MiniStat label="Out of stock" value={health.outOfStock} tone={health.outOfStock ? 'red' : 'muted'} />
            <MiniStat label="Needs reorder" value={health.needsReorder} tone={health.needsReorder ? 'amber' : 'muted'} />
            <MiniStat label="Dead stock" value={health.deadStock} tone={health.deadStock ? 'zinc' : 'muted'} />
            <MiniStat label="Overstock" value={health.overstock} tone={health.overstock ? 'blue' : 'muted'} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/60">
          <KeyVal label="Stock value (cost)" value={formatCurrency(health.inventoryCostValue)} />
          <KeyVal label="Retail value" value={formatCurrency(health.inventoryRetailValue)} />
        </div>
      </Section>

      {/* Revenue forecast + trend */}
      <Section>
        <div className="flex items-center justify-between">
          <SectionTitle icon={<TrendingUp size={14} />}>Revenue Forecast</SectionTitle>
          <TrendBadge direction={trend.direction} changePct={trend.changePct} />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-bold tracking-tight">{formatCurrency(bi.revenueForecast.next7Days)}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">next 7 days</span>
        </div>
        <div className="h-[150px] w-full mt-2 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 8, fontWeight: 600 }} tickFormatter={(s) => format(new Date(s), 'd')} interval={4} dy={6} />
              <YAxis hide />
              <Tooltip contentStyle={{ backgroundColor: 'oklch(var(--color-card))', borderRadius: 10, border: '1px solid oklch(var(--color-border))', fontSize: 11 }} labelFormatter={(s) => format(new Date(s as string), 'dd MMM')} formatter={(v: any) => [formatCurrency(Number(v)), '']} />
              <ReferenceLine x={chartData[firstForecastIdx]?.date} stroke="currentColor" strokeDasharray="3 3" className="opacity-20" />
              <Area type="monotone" dataKey="actual" stroke="oklch(var(--color-foreground) / 0.8)" strokeWidth={2} fill="url(#actualFill)" connectNulls />
              <Area type="monotone" dataKey="forecast" stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="4 3" fill="none" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] text-muted-foreground text-center uppercase tracking-wider">
          Dashed = projected · model confidence {Math.round(bi.revenueForecast.confidence * 100)}%
        </p>
      </Section>

      {/* Smart restock suggestions */}
      {bi.restockSuggestions.length > 0 && (
        <Section>
          <SectionTitle icon={<Boxes size={14} />}>Smart Restock Suggestions</SectionTitle>
          <div className="space-y-2 mt-3">
            {bi.restockSuggestions.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-accent/10">
                <div className={cn('w-9 h-9 rounded-lg flex flex-col items-center justify-center border text-[8px] font-black uppercase shrink-0', statusColor[r.status] || statusColor.low)}>
                  {r.status}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.stock} left · {r.daysOfCover === null ? 'no recent sales' : `~${r.daysOfCover}d cover`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary tabular-nums">+{r.suggestedReorderQty}</p>
                  <p className="text-[9px] text-muted-foreground">{formatCurrency(r.estimatedCost)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Dead stock alert */}
      {health.deadStock > 0 && (
        <Section className="border-zinc-500/20">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<PackageX size={14} />}>Dead Stock</SectionTitle>
            <span className="text-[10px] font-bold text-zinc-500">{formatCurrency(health.deadStockCapital)} tied up</span>
          </div>
          <div className="space-y-1.5 mt-3">
            {bi.deadStock.slice(0, 4).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground truncate">{d.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {d.stock} units · {d.lastSaleDaysAgo === null ? 'never sold' : `${d.lastSaleDaysAgo}d idle`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2.5 flex items-center gap-1">
            <AlertTriangle size={11} /> Consider discounting or bundling to free up capital.
          </p>
        </Section>
      )}

      {/* Top & under performers */}
      <div className="grid grid-cols-1 gap-4">
        <Section>
          <SectionTitle icon={<Crown size={14} />}>Top Performers</SectionTitle>
          <div className="space-y-2 mt-3">
            {bi.topPerformers.map((p, i) => (
              <PerfRow key={p.id} rank={i + 1} name={p.name} score={p.performanceScore} meta={`${p.unitsSold30} sold · ${formatCurrency(p.revenue30)}`} abc={p.abc} />
            ))}
          </div>
        </Section>
        {bi.underPerformers.length > 0 && (
          <Section>
            <SectionTitle icon={<TrendingDown size={14} />}>Needs Attention</SectionTitle>
            <div className="space-y-2 mt-3">
              {bi.underPerformers.map((p) => (
                <PerfRow key={p.id} name={p.name} score={p.performanceScore} meta={`${p.unitsSold30} sold · ${p.daysOfCover === null ? 'idle' : `${p.daysOfCover}d cover`}`} abc={p.abc} />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* ABC mix + customers */}
      <div className="grid grid-cols-2 gap-4">
        <Section>
          <SectionTitle icon={<Sparkles size={14} />}>ABC Mix</SectionTitle>
          <div className="mt-3 space-y-2">
            <AbcBar label="A" count={bi.abcMix.A} total={health.skuCount} tone="bg-emerald-500" />
            <AbcBar label="B" count={bi.abcMix.B} total={health.skuCount} tone="bg-amber-500" />
            <AbcBar label="C" count={bi.abcMix.C} total={health.skuCount} tone="bg-zinc-400" />
          </div>
          <p className="text-[9px] text-muted-foreground mt-2.5 uppercase tracking-wider">A-items drive {bi.abcMix.aRevenueShare}% of revenue</p>
        </Section>
        <Section>
          <SectionTitle icon={<Truck size={14} />}>Top Supplier</SectionTitle>
          {bi.suppliers[0] ? (
            <div className="mt-3">
              <p className="text-sm font-semibold text-foreground truncate">{bi.suppliers[0].name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{bi.suppliers[0].products} products · {formatCurrency(bi.suppliers[0].revenue)}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums">{bi.suppliers[0].performanceScore}</span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground">perf score</span>
              </div>
            </div>
          ) : <p className="text-[10px] text-muted-foreground mt-3">No supplier data yet.</p>}
        </Section>
      </div>

      {/* Customer value (only if any tracked) */}
      {bi.customers.tracked > 0 && (
        <Section>
          <SectionTitle icon={<Crown size={14} />}>Top Customers</SectionTitle>
          <div className="space-y-2 mt-3">
            {bi.customers.top.slice(0, 4).map((c) => (
              <div key={c.key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold uppercase">{c.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.segment} · {c.orders} orders · {formatCurrency(c.spend)}</p>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', scoreColor(c.valueScore))}>{c.valueScore}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Cash drawer (payment breakdown) */}
      {summary && (
        <Section>
          <SectionTitle icon={<Wallet size={14} />}>Cash Drawer (Today)</SectionTitle>
          <div className="space-y-3 mt-3">
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
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{m.label}</span>
                    </div>
                    <span className="font-semibold text-foreground">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-500', m.color.replace('text', 'bg'))} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => setShowEOD(true)} className="w-full mt-4 py-3 rounded-xl bg-secondary border border-border text-foreground font-semibold text-xs active:scale-[0.99] transition-transform">
            Close Day Summary (EOD)
          </button>
        </Section>
      )}

      {showEOD && summary && <EndOfDaySummary summary={summary} onClose={() => setShowEOD(false)} />}
    </div>
  )
}

// ----------------------------- Small UI bits -----------------------------

function StatCard({ icon, iconColor, label, value, sub, big, className }: { icon: React.ReactNode; iconColor: string; label: string; value: string; sub?: string; big?: boolean; className?: string }) {
  return (
    <div className={cn('bg-card p-4 rounded-2xl border border-border shadow-sm', className)}>
      <div className={cn('p-2 rounded-xl bg-secondary border border-border w-fit', iconColor)}>{icon}</div>
      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-2.5 mb-0.5">{label}</p>
      <h3 className={cn('font-bold tracking-tight', big ? 'text-3xl' : 'text-xl')}>{value}</h3>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-card p-4 rounded-2xl border border-border shadow-sm', className)}>{children}</div>
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </h2>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 70 ? 'stroke-emerald-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-red-500'
  return (
    <div className="relative w-[78px] h-[78px] shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 78 78">
        <circle cx="39" cy="39" r={r} className="stroke-secondary" strokeWidth="7" fill="none" />
        <circle cx="39" cy="39" r={r} className={cn(color, 'transition-all duration-700')} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-xl font-bold tabular-nums', scoreColor(score))}>{score}</span>
        <span className="text-[7px] uppercase font-bold text-muted-foreground tracking-wider">/ 100</span>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'zinc' | 'blue' | 'muted' }) {
  const toneClass = {
    red: 'text-red-500', amber: 'text-amber-500', zinc: 'text-zinc-500', blue: 'text-blue-500', muted: 'text-foreground',
  }[tone]
  return (
    <div className="bg-accent/20 rounded-lg px-2.5 py-1.5 border border-border/60">
      <p className={cn('text-base font-bold tabular-nums leading-none', toneClass)}>{value}</p>
      <p className="text-[8.5px] uppercase font-bold text-muted-foreground tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">{label}</p>
      <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}

function TrendBadge({ direction, changePct }: { direction: string; changePct: number }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    rising: { icon: <ArrowUpRight size={11} />, cls: 'text-emerald-600 bg-emerald-500/10' },
    falling: { icon: <ArrowDownRight size={11} />, cls: 'text-red-600 bg-red-500/10' },
    stable: { icon: <Minus size={11} />, cls: 'text-muted-foreground bg-secondary' },
  }
  const m = map[direction] || map.stable
  return (
    <span className={cn('flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider', m.cls)}>
      {m.icon}{Math.abs(changePct)}% wk
    </span>
  )
}

function PerfRow({ rank, name, score, meta, abc }: { rank?: number; name: string; score: number; meta: string; abc: string }) {
  return (
    <div className="flex items-center gap-3">
      {rank && <span className="w-5 text-center text-xs font-black text-muted-foreground">{rank}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-foreground truncate">{name}</p>
          <span className="text-[8px] font-black px-1 rounded bg-secondary border border-border text-muted-foreground">{abc}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">{meta}</p>
      </div>
      <span className={cn('text-sm font-bold tabular-nums', scoreColor(score))}>{score}</span>
    </div>
  )
}

function AbcBar({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 text-[10px] font-black text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-5 text-right">{count}</span>
    </div>
  )
}

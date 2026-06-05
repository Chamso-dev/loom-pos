import React from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, Printer, Download, X, Wallet, QrCode, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface EODProps {
  summary: any
  onClose: () => void
}

export default function EndOfDaySummary({ summary, onClose }: EODProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-250 font-sans">
      <div className="bg-card w-full max-w-xl rounded-lg border border-border shadow-lg overflow-hidden animate-in zoom-in-98 duration-200">
        <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/50">
          <div>
            <h2 className="text-lg font-bold text-foreground">Day Closing Report</h2>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-md transition-colors border border-border bg-card">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg space-y-1">
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">Total Collection</p>
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(summary?.revenue || 0)}</p>
             </div>
             <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-1">
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Orders Processed</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{summary?.orders || 0}</p>
             </div>
          </div>

          <div className="space-y-2.5">
             <h4 className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider pl-0.5">Payment Breakdown</h4>
             <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Cash', icon: Wallet, method: 'CASH', color: 'text-emerald-500', bg: 'bg-emerald-500/5 border-emerald-500/10' },
                  { label: 'Digital', icon: QrCode, method: 'UPI', color: 'text-primary', bg: 'bg-primary/5 border-primary/10' },
                  { label: 'Card', icon: CreditCard, method: 'CARD', color: 'text-blue-500', bg: 'bg-blue-500/5 border-blue-500/10' },
                ].map((m) => {
                  const amount = summary?.paymentBreakdown?.find((p: any) => p.paymentMethod === m.method)?._sum?.totalAmount || 0
                  return (
                    <div key={m.method} className={cn("p-4 rounded-lg border space-y-2", m.bg)}>
                       <div className={cn("w-7 h-7 rounded flex items-center justify-center border border-border bg-card", m.color)}>
                          <m.icon size={14} />
                       </div>
                       <div>
                          <p className="text-[9px] text-muted-foreground uppercase font-semibold">{m.label}</p>
                          <p className="text-sm font-bold text-foreground">{formatCurrency(amount)}</p>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>

          <div className="bg-secondary/40 p-4 rounded-lg border border-border flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                   <CheckCircle2 size={16} />
                </div>
                <div>
                   <p className="font-semibold text-sm leading-none text-foreground">Settlement Ready</p>
                   <p className="text-[10px] text-muted-foreground mt-0.5">Stock and sales records are fully synced</p>
                </div>
             </div>
             <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-md border-border h-8 text-xs font-semibold px-3">
                   <Download size={14} className="mr-1.5" /> Export
                </Button>
                <Button size="sm" className="rounded-md h-8 text-xs font-semibold px-3 bg-primary text-primary-foreground">
                   <Printer size={14} className="mr-1.5" /> Print EOD
                </Button>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

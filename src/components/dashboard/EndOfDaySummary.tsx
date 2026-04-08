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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-card w-full max-w-2xl rounded-[2.5rem] border border-border/40 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-border/40 flex items-center justify-between bg-primary/5">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic">Day Closing Report</h2>
            <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors border border-border/40 bg-background">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-6">
             <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl space-y-1">
                <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Total Collection</p>
                <p className="text-4xl font-black tracking-tighter text-emerald-500">{formatCurrency(summary?.revenue || 0)}</p>
             </div>
             <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl space-y-1">
                <p className="text-[10px] text-primary uppercase font-black tracking-widest">Orders Processed</p>
                <p className="text-4xl font-black tracking-tighter">{summary?.orders || 0}</p>
             </div>
          </div>

          <div className="space-y-4">
             <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Payment Breakdown</h4>
             <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Cash', icon: Wallet, method: 'CASH', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { label: 'Digital', icon: QrCode, method: 'UPI', color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'Card', icon: CreditCard, method: 'CARD', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                ].map((m) => {
                  const amount = summary?.paymentBreakdown?.find((p: any) => p.paymentMethod === m.method)?._sum?.totalAmount || 0
                  return (
                    <div key={m.method} className={cn("p-6 rounded-3xl border border-border/40 space-y-3", m.bg.replace('/10', '/5'))}>
                       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border border-border/10", m.bg, m.color)}>
                          <m.icon size={20} />
                       </div>
                       <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{m.label}</p>
                          <p className="text-lg font-black">{formatCurrency(amount)}</p>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>

          <div className="bg-accent/20 p-6 rounded-3xl border border-border/40 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                   <CheckCircle2 size={24} />
                </div>
                <div>
                   <p className="font-bold text-lg leading-none">Ready for EOD Settlement</p>
                   <p className="text-xs text-muted-foreground mt-1">Stock and sales records are synced</p>
                </div>
             </div>
             <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl border-border/60">
                   <Download size={18} className="mr-2" /> Export
                </Button>
                <Button className="rounded-xl font-black uppercase tracking-widest">
                   <Printer size={18} className="mr-2" /> Print EOD
                </Button>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

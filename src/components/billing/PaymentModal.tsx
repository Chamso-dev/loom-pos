import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Wallet, CreditCard, QrCode, X, CheckCircle2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'

interface PaymentModalProps {
  amount: number
  method: string
  onConfirm: () => void
  onCancel: () => void
  isProcessing: boolean
}

export default function PaymentModal({ amount, method, onConfirm, onCancel, isProcessing }: PaymentModalProps) {
  const { settings } = useStore()
  const upiId = settings?.upiId || 'store@upi'
  const storeName = settings?.name || 'LOOMPOS'
  const upiLink = `upi://pay?pa=${upiId}&pn=${storeName.replace(/\s/g, '')}&am=${amount}&cu=INR`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card w-full max-w-sm rounded-[2.5rem] border border-border/60 shadow-2xl shadow-primary/20 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-8 border-b border-border/40 flex items-center justify-between bg-primary/5">
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase italic">{method} Payment</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Complete Transaction</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-accent rounded-full transition-colors border border-border/40 bg-background shadow-sm">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          <div className="flex flex-col items-center gap-1">
             <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Total Payable</span>
             <span className="text-5xl font-black tabular-nums tracking-tighter shadow-primary/10 drop-shadow-sm">{formatCurrency(amount)}</span>
          </div>

          {/* UPI QR Display (Only for UPI) */}
          {method === 'UPI' && (
            <div className="bg-white p-8 rounded-[2rem] border-2 border-primary/20 flex flex-col items-center gap-6 shadow-xl shadow-primary/5 animate-in slide-in-from-bottom-4">
               <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100 flex items-center justify-center">
                  <QRCodeSVG value={upiLink} size={180} level="H" includeMargin />
               </div>
               <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
                     <QrCode size={12} className="text-primary" />
                     <p className="text-[10px] text-primary uppercase font-black tracking-widest">Scan & Pay</p>
                  </div>
                  <p className="font-mono text-[9px] text-zinc-400 break-all max-w-[200px]">{upiId}</p>
               </div>
            </div>
          )}

          {/* Prompt for non-UPI (Though currently modal only opens for UPI) */}
          {method !== 'UPI' && (
            <div className="py-10 text-center space-y-4">
               <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary">
                  {method === 'CASH' ? <Wallet size={40} /> : <CreditCard size={40} />}
               </div>
               <p className="font-bold text-lg">Confirming {method} payment...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-accent/20 border-t border-border/40">
           <Button 
            variant="premium" 
            className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            onClick={onConfirm}
            disabled={isProcessing}
           >
             {isProcessing ? 'Finalizing...' : `Confirm ${method}`}
             <CheckCircle2 className="ml-2" size={20} />
           </Button>
        </div>
      </div>
    </div>
  )
}

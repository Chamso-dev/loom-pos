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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-250 font-sans">
      <div className="bg-card w-full max-w-xs rounded-lg border border-border shadow-lg overflow-hidden animate-in zoom-in-98 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/50">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{method} Payment</h2>
            <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">Complete Transaction</p>
          </div>
          <button onClick={onCancel} className="p-1.5 hover:bg-accent rounded border border-border bg-card">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-0.5">
             <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Total Payable</span>
             <span className="text-3xl font-bold tabular-nums tracking-tight">{formatCurrency(amount)}</span>
          </div>

          {/* UPI QR Display (Only for UPI) */}
          {method === 'UPI' && (
            <div className="bg-white p-6 rounded-md border border-border flex flex-col items-center gap-4 shadow-sm">
               <div className="p-2 bg-white rounded border border-zinc-100 flex items-center justify-center">
                  <QRCodeSVG value={upiLink} size={150} level="H" includeMargin />
               </div>
               <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 rounded-full">
                     <QrCode size={10} className="text-primary" />
                     <p className="text-[8px] text-primary uppercase font-bold tracking-wider">Scan & Pay</p>
                  </div>
                  <p className="font-mono text-[9px] text-zinc-400 break-all max-w-[180px]">{upiId}</p>
               </div>
            </div>
          )}

          {/* Prompt for non-UPI (Though currently modal only opens for UPI) */}
          {method !== 'UPI' && (
            <div className="py-6 text-center space-y-3">
               <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary">
                  {method === 'CASH' ? <Wallet size={28} /> : <CreditCard size={28} />}
               </div>
               <p className="font-bold text-sm">Confirming {method} payment...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-secondary/30 border-t border-border">
           <Button 
            className="w-full h-11 text-sm font-semibold uppercase tracking-wider transition-all active:scale-[0.99] rounded-md cursor-pointer bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
            onClick={onConfirm}
            disabled={isProcessing}
           >
             {isProcessing ? 'Finalizing...' : `Confirm`}
             <CheckCircle2 className="ml-1.5" size={16} />
           </Button>
        </div>
      </div>
    </div>
  )
}

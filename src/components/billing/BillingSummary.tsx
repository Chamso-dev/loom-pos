import { useState, useMemo } from 'react'
import { Printer, Receipt, Wallet, CreditCard, QrCode, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useStore } from '@/store/useStore'
import { formatCurrency, cn } from '@/lib/utils'
import PrintReceiptPortal from './PrintReceiptPortal'
import PaymentModal from './PaymentModal'

export default function BillingSummary() {
  // ... existing logic ...
  const { cart, clearCart } = useStore()
  const [receiptType, setReceiptType] = useState<'A4' | 'Thermal'>('Thermal')
  const [lastOrder, setLastOrder] = useState<any>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')

  const { subtotal, gstGroups, total } = useMemo(() => {
    // ... logic for subtotal/total remains same ...
    let sub = 0
    const groups: Record<number, number> = {}
    
    cart.forEach(item => {
      const itemSubtotal = item.price * item.quantity
      sub += itemSubtotal
      
      const itemGst = (itemSubtotal * item.gst) / 100
      groups[item.gst] = (groups[item.gst] || 0) + itemGst
    })
    
    const gstTotal = Object.values(groups).reduce((acc, val) => acc + val, 0)
    
    return {
      subtotal: sub,
      gstGroups: Object.entries(groups).map(([rate, amount]) => ({
        rate: Number(rate),
        amount
      })),
      total: sub + gstTotal
    }
  }, [cart])

  const handleCheckout = () => {
    if (cart.length === 0) return
    if (paymentMethod === 'UPI') {
      setShowPaymentModal(true)
    } else {
      completeOrder(paymentMethod)
    }
  }

  const completeOrder = async (method: string) => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: total,
          gstAmount: total - subtotal,
          paymentMethod: method, 
          customerName: customerName || null,
          customerMobile: customerMobile || null,
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          }))
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Checkout failed')
      }

      const orderData = await response.json()
      setLastOrder(orderData)
      setCustomerName('')
      setCustomerMobile('')
      setShowPaymentModal(false)
      setPaymentMethod('CASH')
      clearCart()
    } catch (error: any) {
      console.error('Checkout error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Card className="h-full flex flex-col border-border/60 shadow-2xl shadow-primary/5 bg-card/60 backdrop-blur-md overflow-hidden">
        {/* ... CardHeader ... */}
        <CardHeader className="border-b border-border/40 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Receipt size={20} />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">Order Summary</CardTitle>
            </div>
            
            <div className="flex bg-accent/30 p-1 rounded-xl border border-border/40 scale-90">
               <button 
                 onClick={() => setReceiptType('A4')}
                 className={cn(
                   "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                   receiptType === 'A4' ? "bg-white text-black shadow-sm" : "text-muted-foreground opacity-50"
                 )}
               >
                 <FileText size={12} /> A4
               </button>
               <button 
                 onClick={() => setReceiptType('Thermal')}
                 className={cn(
                   "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                   receiptType === 'Thermal' ? "bg-white text-black shadow-sm" : "text-muted-foreground opacity-50"
                 )}
               >
                 <Receipt size={12} /> 80mm
               </button>
            </div>
          </div>
        </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 shrink-0 custom-scrollbar">
        {/* Customer Info Inputs */}
        <div className="space-y-3 pb-2">
           <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Customer Information</span>
           <div className="grid grid-cols-1 gap-2">
             <input 
               type="text" 
               placeholder="Customer Name"
               value={customerName}
               onChange={(e) => setCustomerName(e.target.value)}
               className="w-full bg-accent/20 border border-border/40 px-3 py-2 rounded-lg text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
             />
             <input 
               type="text" 
               placeholder="Mobile Number"
               value={customerMobile}
               onChange={(e) => setCustomerMobile(e.target.value)}
               className="w-full bg-accent/20 border border-border/40 px-3 py-2 rounded-lg text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
             />
           </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-muted-foreground uppercase tracking-widest font-semibold">
            <span>Subtotal</span>
            <span className="text-foreground">{formatCurrency(subtotal)}</span>
          </div>
          
          <div className="space-y-2 pt-2 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Tax Breakdown</span>
            {gstGroups.length > 0 ? (
              gstGroups.map(group => (
                <div key={group.rate} className="flex justify-between text-xs text-muted-foreground">
                  <span>GST ({group.rate}%)</span>
                  <span>{formatCurrency(group.amount)}</span>
                </div>
              ))
            ) : (
                <div className="text-xs text-muted-foreground italic">No taxes applicable</div>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-6 mt-6 border-t border-border/60">
           <div className="flex items-center justify-between">
              <span className="text-xl font-black uppercase tracking-tighter">Total Payable</span>
              <span className="text-3xl font-black text-primary drop-shadow-sm tracking-tighter tabular-nums">
                {formatCurrency(total)}
              </span>
           </div>
        </div>

        {/* Payment Modes Selection */}
        <div className="space-y-3 pt-4">
           <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Select Payment Method</span>
           <div className="grid grid-cols-3 gap-2">
             <Button 
               variant="outline" 
               onClick={() => setPaymentMethod('CASH')}
               className={cn(
                 "flex-col h-16 gap-2 border-primary/20 transition-all",
                 paymentMethod === 'CASH' ? "bg-primary/10 border-primary text-primary shadow-sm" : "hover:bg-primary/5 hover:text-primary transition-all"
               )}
             >
                <Wallet size={18} />
                <span className="text-[10px] uppercase font-bold">Cash</span>
             </Button>
             <Button 
               variant="outline" 
               onClick={() => setPaymentMethod('UPI')}
               className={cn(
                 "flex-col h-16 gap-2 border-primary/20 transition-all",
                 paymentMethod === 'UPI' ? "bg-primary/10 border-primary text-primary shadow-sm" : "hover:bg-primary/5 hover:text-primary transition-all shadow-sm shadow-primary/10"
               )}
             >
                <QrCode size={18} />
                <span className="text-[10px] uppercase font-bold">UPI</span>
             </Button>
             <Button 
               variant="outline" 
               onClick={() => setPaymentMethod('CARD')}
               className={cn(
                 "flex-col h-16 gap-2 border-primary/20 transition-all",
                 paymentMethod === 'CARD' ? "bg-primary/10 border-primary text-primary shadow-sm" : "hover:bg-primary/5 hover:text-primary transition-all"
               )}
             >
                <CreditCard size={18} />
                <span className="text-[10px] uppercase font-bold">Card</span>
             </Button>
           </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-2 border-t border-border/40 shrink-0 bg-accent/20">
        <Button 
          variant="premium" 
          size="lg" 
          disabled={cart.length === 0}
          onClick={handleCheckout}
          className={cn(
            "w-full py-8 text-xl font-black uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98]",
            cart.length > 0 ? "shadow-primary/30" : "opacity-50 grayscale"
          )}
        >
          <Printer size={22} className="mr-3" />
          Complete Sale
        </Button>
      </CardFooter>
      </Card>

      {/* Actual Print Portal */}
      {lastOrder && (
        <PrintReceiptPortal 
          order={lastOrder} 
          type={receiptType} 
          onClose={() => setLastOrder(null)} 
        />
      )}

      {/* Payment Selection Modal */}
      {showPaymentModal && (
        <PaymentModal
          amount={total}
          method={paymentMethod}
          onConfirm={() => completeOrder(paymentMethod)}
          onCancel={() => setShowPaymentModal(false)}
          isProcessing={isProcessing}
        />
      )}
    </>
  )
}

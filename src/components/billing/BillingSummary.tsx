import { useState, useMemo } from 'react'
import { Printer, Receipt, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useStore } from '@/store/useStore'
import { formatCurrency, cn } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/lib/payments'
import PrintReceiptPortal from './PrintReceiptPortal'
import CustomerPicker, { type BillingCustomer } from './CustomerPicker'

export default function BillingSummary() {
  // ... existing logic ...
  const { cart, clearCart, user } = useStore()
  const [receiptType, setReceiptType] = useState<'A4' | 'Thermal'>('Thermal')
  const [lastOrder, setLastOrder] = useState<any>(null)
  const [customer, setCustomer] = useState<BillingCustomer>({ customerId: null, name: '', mobile: '' })
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')

  const { subtotal, gstGroups, total } = useMemo(() => {
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
    completeOrder(paymentMethod)
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
          customerId: customer.customerId,
          customerName: customer.name || null,
          customerMobile: customer.mobile || null,
          userId: user?.id,
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
      setCustomer({ customerId: null, name: '', mobile: '' })
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
      <Card className="flex flex-col border border-border shadow-sm bg-card rounded-2xl overflow-hidden font-sans">
        <CardHeader className="border-b border-border pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-secondary rounded text-foreground border border-border">
                <Receipt size={16} />
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Order Summary</CardTitle>
            </div>
            
            <div className="flex bg-secondary p-0.5 rounded border border-border scale-90">
               <button 
                 onClick={() => setReceiptType('A4')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all",
                   receiptType === 'A4' ? "bg-card text-foreground border border-border shadow-sm" : "text-muted-foreground"
                 )}
               >
                 <FileText size={10} /> A4
               </button>
               <button 
                 onClick={() => setReceiptType('Thermal')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all",
                   receiptType === 'Thermal' ? "bg-card text-foreground border border-border shadow-sm" : "text-muted-foreground"
                 )}
               >
                 <Receipt size={10} /> 80mm
               </button>
            </div>
          </div>
        </CardHeader>
      
      <CardContent className="p-4 space-y-4 custom-scrollbar">
        {/* Customer selection */}
        <div className="pb-1">
           <CustomerPicker value={customer} onChange={setCustomer} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            <span>Subtotal</span>
            <span className="text-foreground">{formatCurrency(subtotal)}</span>
          </div>
          
          <div className="space-y-1 pt-1.5 border-t border-border">
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Tax Breakdown</span>
            {gstGroups.length > 0 ? (
              gstGroups.map(group => (
                <div key={group.rate} className="flex justify-between text-[11px] text-muted-foreground">
                  <span>TVA ({group.rate}%)</span>
                  <span>{formatCurrency(group.amount)}</span>
                </div>
              ))
            ) : (
                <div className="text-[11px] text-muted-foreground italic">No taxes applicable</div>
            )}
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-border">
           <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-foreground">Total Payable</span>
              <span className="text-2xl font-bold text-foreground tracking-tight tabular-nums">
                {formatCurrency(total)}
              </span>
           </div>
        </div>

        {/* Payment Modes Selection */}
        <div className="space-y-2 pt-2">
           <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Payment Method</span>
           <div className="grid grid-cols-3 gap-2">
             {PAYMENT_METHODS.map((m) => (
               <Button
                 key={m.code}
                 variant="outline"
                 onClick={() => setPaymentMethod(m.code)}
                 className={cn(
                   "flex-col h-14 gap-1 border transition-all rounded-xl cursor-pointer",
                   paymentMethod === m.code ? "bg-secondary border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                 )}
               >
                 <m.icon size={15} />
                 <span className="text-[8px] uppercase font-bold leading-none text-center">{m.label}</span>
               </Button>
             ))}
           </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 border-t border-border shrink-0 bg-secondary/30">
        <Button 
          size="lg" 
          disabled={cart.length === 0}
          onClick={handleCheckout}
          className={cn(
            "w-full h-11 text-sm font-semibold uppercase tracking-wider transition-all active:scale-[0.99] rounded-md cursor-pointer bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
            cart.length === 0 && "opacity-50 grayscale"
          )}
        >
          <Printer size={16} className="mr-2" />
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
    </>
  )
}

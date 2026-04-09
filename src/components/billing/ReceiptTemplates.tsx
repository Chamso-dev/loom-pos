import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'

const upiId = 'store@api' // Replace with your actual UPI ID

const PaymentQR = ({ amount, size = 60 }: { amount: number, size?: number }) => {
  const upiLink = `upi://pay?pa=${upiId}&pn=LOOMPOS&am=${amount}&cu=INR`
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="p-1 bg-white border border-gray-100 rounded shadow-sm">
        <QRCodeSVG value={upiLink} size={size} level="M" />
      </div>
      <span className="text-[7px] uppercase font-bold text-gray-400">Scan to Pay</span>
    </div>
  )
}

interface ReceiptProps {
  order: any // Type from Prisma Order with items and products
}

export const A4Invoice = ({ order }: ReceiptProps) => {
  return (
    <div className="bg-white text-black p-12 max-w-[800px] mx-auto min-h-[1100px] flex flex-col font-sans">
      {/* Header */}
      <div className="flex justify-between items-start mb-12 border-b-2 border-black pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">TAX INVOICE</h1>
          <div className="text-sm space-y-1">
            <p className="font-bold text-lg">LOOMPOS</p>
            <p>123 Trend Avenue, Fashion District</p>
            <p>Mumbai, Maharashtra, 400001</p>
            <p>GSTIN: 27AAAAA0000A1Z5</p>
            <p>Phone: +91 98765 43210</p>
          </div>
        </div>
        <div className="text-right">
          <div className="mb-4">
             <p className="text-xs uppercase font-bold opacity-60">Invoice Date</p>
             <p className="font-bold">{format(new Date(order.date), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
          <div>
             <p className="text-xs uppercase font-bold opacity-60">Invoice No</p>
             <p className="text-2xl font-black tracking-tight">{order.invoiceNo}</p>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-8 mb-12">
        <div className="bg-gray-50 p-6 rounded-xl">
           <p className="text-[10px] uppercase font-bold opacity-40 mb-2 tracking-widest">Bill To</p>
           <p className="font-bold text-lg">{order.customerName || 'Cash Customer'}</p>
           <p className="text-sm opacity-60">{order.customerMobile || 'N/A'}</p>
        </div>
        <div className="bg-gray-50 p-6 rounded-xl flex flex-col justify-center">
           <p className="text-[10px] uppercase font-bold opacity-40 mb-1 tracking-widest">Payment Method</p>
           <p className="font-bold uppercase tracking-tight">{order.paymentMethod}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-black text-xs uppercase font-bold">
              <th className="py-4">Item Description</th>
              <th className="py-4 text-center">Qty</th>
              <th className="py-4 text-right">Price</th>
              <th className="py-4 text-center">GST %</th>
              <th className="py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {order.items.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-gray-100 italic">
                <td className="py-4">
                  <p className="font-bold not-italic">{item.product.name}</p>
                  <p className="text-xs opacity-60 uppercase font-mono">{item.product.sku} | {item.product.size || 'N/A'}</p>
                </td>
                <td className="py-4 text-center">{item.quantity}</td>
                <td className="py-4 text-right">{formatCurrency(item.price)}</td>
                <td className="py-4 text-center">{item.product.gst}%</td>
                <td className="py-4 text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Totals */}
      <div className="mt-12 border-t-2 border-black pt-8">
        <div className="flex justify-end">
          <div className="w-64 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="opacity-60">Subtotal</span>
              <span>{formatCurrency(order.totalAmount - order.gstAmount)}</span>
            </div>
            <div className="flex justify-between text-sm pb-3 border-b border-gray-100">
              <span className="opacity-60">Total GST</span>
              <span>{formatCurrency(order.gstAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-black tracking-tighter">
              <span>TOTAL</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-20 flex justify-between items-end">
          <div className="flex gap-8 items-end">
            <div className="text-[10px] opacity-40 leading-tight">
              <p>TERMS & CONDITIONS</p>
              <p>1. Goods once sold will not be taken back.</p>
              <p>2. No exchange without receipt.</p>
              <p>3. Subject to local jurisdiction.</p>
            </div>
            <PaymentQR amount={order.totalAmount} size={70} />
          </div>
          <div className="text-center border-t border-black w-48 pt-2">
            <p className="text-xs font-bold uppercase">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ThermalReceipt = ({ order }: ReceiptProps) => {
  return (
    <div className="bg-white text-black p-4 w-[80mm] mx-auto font-mono text-xs leading-tight">
      <div className="text-center mb-4 space-y-1">
        <h2 className="text-lg font-bold uppercase tracking-tighter">LOOMPOS</h2>
        <p>123 Trend Avenue, Fashion District</p>
        <p>GSTIN: 27AAAAA0000A1Z5</p>
        <p>Ph: +91 98765 43210</p>
      </div>

      <div className="border-y border-dashed border-black py-2 mb-2 flex justify-between uppercase">
        <span>In: {order.invoiceNo}</span>
        <span>{format(new Date(order.date), 'dd/MM/yy HH:mm')}</span>
      </div>

      <div className="mb-4">
        {order.items.map((item: any, idx: number) => (
          <div key={idx} className="mb-2">
             <div className="flex justify-between font-bold">
                <span>{item.product.name}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
             </div>
             <div className="flex justify-between opacity-70 text-[10px]">
                <span>{item.quantity} x {formatCurrency(item.price)}</span>
                <span>GST: {item.product.gst}%</span>
             </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black pt-2 space-y-1">
         <div className="flex justify-between">
            <span>SUBTOTAL</span>
            <span>{formatCurrency(order.totalAmount - order.gstAmount)}</span>
         </div>
         <div className="flex justify-between">
            <span>TOTAL GST</span>
            <span>{formatCurrency(order.gstAmount)}</span>
         </div>
         <div className="flex justify-between text-lg font-bold">
            <span>TOTAL</span>
            <span>{formatCurrency(order.totalAmount)}</span>
         </div>
      </div>

      <div className="mt-4 text-center border-t border-dashed border-black pt-4 space-y-4">
         <div className="flex justify-center">
            <PaymentQR amount={order.totalAmount} size={100} />
         </div>
         <div className="space-y-1">
            <p className="uppercase tracking-widest font-bold text-[10px]">Thank You!</p>
            <p className="text-[9px]">Visit again for more trends</p>
         </div>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { LayoutGrid, ShoppingCart, User, Calculator } from 'lucide-react'
import { useStore } from '@/store/useStore'
import ScannerInput from './ScannerInput'
import CartList from './CartList'
import BillingSummary from './BillingSummary'

export default function BillingPage() {
  const { fetchProducts, user } = useStore()

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* POS Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm shadow-primary/10">
            <Calculator size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Fast POS Billing</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <User size={14} /> Cashier: <span className="text-foreground font-semibold">{user?.name || 'Administrator'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden md:block">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block">Local Time</span>
              <span className="text-sm font-bold opacity-80">{new Date().toLocaleTimeString()}</span>
           </div>
           <div className="p-3 bg-card/40 rounded-xl border border-border/40 shadow-sm">
             <ShoppingCart size={20} className="text-primary" />
           </div>
        </div>
      </div>

      {/* Main Billing Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        {/* Left Section: Scanner & Cart (2 columns) */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          <div className="shrink-0">
            <ScannerInput />
          </div>
          
          <div className="flex-1 min-h-0">
             <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4 px-1 flex items-center gap-2">
               <LayoutGrid size={14} className="opacity-40" /> Active Basket
             </h3>
             <CartList />
          </div>
        </div>

        {/* Right Section: Summary & Checkout (1 column) */}
        <div className="lg:col-span-1 flex flex-col min-h-0 shrink-0">
           <BillingSummary />
        </div>
      </div>
    </div>
  )
}

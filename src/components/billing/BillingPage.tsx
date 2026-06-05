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
    <div className="h-[calc(100vh-6.5rem)] flex flex-col gap-5 animate-in fade-in duration-300 font-sans">
      {/* POS Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center text-foreground border border-border">
            <Calculator size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Billing</h1>
            <p className="text-muted-foreground text-[10px] flex items-center gap-1.5 mt-0.5">
              <User size={12} className="opacity-65" /> Cashier: <span className="text-foreground font-semibold">{user?.name || 'Administrator'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="text-right hidden md:block">
              <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider block">Local Time</span>
              <span className="text-xs font-semibold text-foreground/80">{new Date().toLocaleTimeString()}</span>
           </div>
           <div className="p-2 bg-card rounded border border-border">
             <ShoppingCart size={16} className="text-muted-foreground" />
           </div>
        </div>
      </div>

      {/* Main Billing Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
        {/* Left Section: Scanner & Cart (2 columns) */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="shrink-0">
            <ScannerInput />
          </div>
          
          <div className="flex-1 min-h-0 flex flex-col gap-2">
             <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider px-1 flex items-center gap-1.5">
               <LayoutGrid size={12} className="opacity-45" /> Active Basket
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

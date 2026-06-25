import { useEffect } from 'react'
import { LayoutGrid, User } from 'lucide-react'
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
    <div className="flex flex-col gap-3 animate-in fade-in duration-300 font-sans">
      {/* Compact POS header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Billing</h1>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <User size={13} className="opacity-65" />
          <span className="text-foreground font-semibold truncate max-w-[140px]">{user?.name || 'Administrator'}</span>
        </span>
      </div>

      {/* Scanner stays pinned below the app bar for quick repeated scans */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/85 backdrop-blur-md">
        <ScannerInput />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider px-1 flex items-center gap-1.5">
          <LayoutGrid size={12} className="opacity-45" /> Active Basket
        </h3>
        <CartList />
      </div>

      <BillingSummary />
    </div>
  )
}

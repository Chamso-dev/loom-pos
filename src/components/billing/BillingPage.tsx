import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, User, ShoppingBag, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import { scanBeep } from '@/native/liveScanner'
import EmbeddedScanner from './EmbeddedScanner'
import ScannerInput from './ScannerInput'
import CartList from './CartList'
import BillingSummary from './BillingSummary'

export default function BillingPage() {
  const { fetchProducts, user, addByBarcode, cart } = useStore()
  const [flash, setFlash] = useState<{ id: number; name: string } | null>(null)
  const lastRef = useRef<{ value: string; t: number }>({ value: '', t: 0 })

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleDetect = async (value: string) => {
    // De-dupe rapid repeats of the same code (camera reports it every frame).
    const now = Date.now()
    if (lastRef.current.value === value && now - lastRef.current.t < 1500) return
    lastRef.current = { value, t: now }

    const ok = await addByBarcode(value)
    if (ok) {
      const product = useStore.getState().products.find((p) => p.barcode === value)
      scanBeep()
      setFlash({ id: now, name: product?.name || 'Added' })
      setTimeout(() => setFlash((f) => (f && f.id === now ? null : f)), 950)
    }
    // Unrecognised codes are ignored; the scanner keeps running.
  }

  const isEmpty = cart.length === 0

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-300 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Cart</h1>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <User size={13} className="opacity-65" />
          <span className="text-foreground font-semibold truncate max-w-[140px]">{user?.name || 'Administrator'}</span>
        </span>
      </div>

      {/* Embedded scanner box (never full-screen, never a background) */}
      <EmbeddedScanner onDetect={handleDetect}>
        <AnimatePresence mode="wait">
          {flash ? (
            <motion.div
              key={`flash-${flash.id}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 text-white shadow-lg max-w-[80%]"
            >
              <Check size={16} strokeWidth={3} className="shrink-0" />
              <span className="text-sm font-bold truncate">{flash.name}</span>
            </motion.div>
          ) : isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-sm text-white text-sm font-semibold"
            >
              Your cart is empty
            </motion.div>
          ) : null}
        </AnimatePresence>
      </EmbeddedScanner>

      {/* Manual / HID fallback search */}
      <ScannerInput />

      {/* Products appear below the scanner; smooth empty -> active transition */}
      <AnimatePresence initial={false}>
        {!isEmpty && (
          <motion.div
            key="basket"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col gap-2"
          >
            <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider px-1 flex items-center gap-1.5">
              <LayoutGrid size={12} className="opacity-45" /> Active Basket ({cart.length})
            </h3>
            <CartList />
            <BillingSummary />
          </motion.div>
        )}
      </AnimatePresence>

      {isEmpty && (
        <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 py-2">
          <ShoppingBag size={13} className="opacity-50" /> Scan an item or search to start a sale
        </p>
      )}
    </div>
  )
}

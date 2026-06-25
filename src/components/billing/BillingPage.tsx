import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, User, ShoppingBag } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { scanBeep } from '@/native/liveScanner'
import EmbeddedScanner, { type ScanFeedback } from './EmbeddedScanner'
import ScannerInput from './ScannerInput'
import CartList from './CartList'
import BillingSummary from './BillingSummary'
import PrintReceiptPortal from './PrintReceiptPortal'

export default function BillingPage() {
  const { fetchProducts, user, addByBarcode, cart } = useStore()
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)
  // Receipt is owned here (not in BillingSummary) so it persists after the sale
  // clears the cart and unmounts the basket section.
  const [receipt, setReceipt] = useState<{ order: any; type: 'A4' | 'Thermal' } | null>(null)
  const lastRef = useRef<{ value: string; t: number }>({ value: '', t: 0 })
  const clearRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    fetchProducts()
    return () => clearTimeout(clearRef.current)
  }, [fetchProducts])

  // Show a transient banner, then auto-clear back to the idle prompt.
  const showFeedback = (fb: ScanFeedback, holdMs: number) => {
    setFeedback(fb)
    clearTimeout(clearRef.current)
    clearRef.current = setTimeout(
      () => setFeedback((f) => (f && f.id === fb.id ? null : f)),
      holdMs,
    )
  }

  const handleDetect = async (value: string) => {
    // Duplicate-scan protection: ignore the same code within a 1.5s cooldown
    // (the camera reports a held barcode on every frame).
    const now = Date.now()
    if (lastRef.current.value === value && now - lastRef.current.t < 1500) return
    lastRef.current = { value, t: now }

    // 1) Acknowledge the raw read immediately.
    console.log('[scanner] barcode detected:', value)
    showFeedback({ id: now, variant: 'detected', text: 'Barcode Detected' }, 1200)

    // 2) Look the product up and update the cart.
    const ok = await addByBarcode(value)
    if (ok) {
      const product = useStore.getState().products.find((p) => p.barcode === value)
      console.log('[scanner] product added to cart:', product?.name ?? value)
      scanBeep()
      navigator.vibrate?.(60) // haptic confirmation where supported
      showFeedback(
        { id: now, variant: 'success', text: product?.name ? `Added · ${product.name}` : 'Product Added To Cart' },
        1100,
      )
    } else {
      console.log('[scanner] product not found in inventory:', value)
      navigator.vibrate?.([40, 40, 40]) // distinct "not found" buzz
      showFeedback({ id: now, variant: 'error', text: 'Product Not Found' }, 1400)
    }
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

      {/* Scanner card. On native this is a transparent "window" onto the ML Kit
          camera that runs behind the UI; the rest of the page stays opaque. */}
      <EmbeddedScanner onDetect={handleDetect} feedback={feedback} cartEmpty={isEmpty} />

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
            <BillingSummary onComplete={(order, type) => setReceipt({ order, type })} />
          </motion.div>
        )}
      </AnimatePresence>

      {isEmpty && (
        <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 py-2">
          <ShoppingBag size={13} className="opacity-50" /> Scan an item or search to start a sale
        </p>
      )}

      {/* Receipt modal — owned at page level so it survives clearCart() and is
          controlled only by explicit open/close state, never the scan/cart
          lifecycle. Renders topmost (Camera → Overlay → Receipt). */}
      {receipt && (
        <PrintReceiptPortal
          order={receipt.order}
          type={receipt.type}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  )
}

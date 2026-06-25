import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, User, ScanLine, Camera, CameraOff, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import { isLiveScanSupported, startLiveScan, scanBeep, type LiveScanHandle } from '@/native/liveScanner'
import ScannerInput from './ScannerInput'
import CartList from './CartList'
import BillingSummary from './BillingSummary'

export default function BillingPage() {
  const { fetchProducts, user, addByBarcode } = useStore()
  const supported = isLiveScanSupported()

  const [liveOn, setLiveOn] = useState(supported)
  const [scanError, setScanError] = useState('')
  const [flash, setFlash] = useState<{ id: number; name: string } | null>(null)

  const handleRef = useRef<LiveScanHandle | null>(null)
  const lastRef = useRef<{ value: string; t: number }>({ value: '', t: 0 })

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Continuous live scanning while the Cart screen is open (native only).
  useEffect(() => {
    if (!liveOn || !supported) return
    let cancelled = false

    const onBarcode = async (value: string) => {
      // De-dupe rapid repeats of the same code so one item isn't added 10x.
      const now = Date.now()
      if (lastRef.current.value === value && now - lastRef.current.t < 1500) return
      lastRef.current = { value, t: now }

      const ok = await addByBarcode(value)
      if (ok) {
        const product = useStore.getState().products.find((p) => p.barcode === value)
        scanBeep()
        setFlash({ id: now, name: product?.name || 'Added to cart' })
        setTimeout(() => setFlash((f) => (f && f.id === now ? null : f)), 900)
      }
      // Unrecognised codes are ignored — the scanner keeps running.
    }

    ;(async () => {
      try {
        const handle = await startLiveScan(onBarcode)
        if (cancelled) { handle.stop(); return }
        handleRef.current = handle
        setScanError('')
      } catch (e: any) {
        if (!cancelled) { setScanError(e?.message || 'Camera unavailable'); setLiveOn(false) }
      }
    })()

    return () => {
      cancelled = true
      handleRef.current?.stop()
      handleRef.current = null
    }
  }, [liveOn, supported, addByBarcode])

  const scanning = liveOn && supported

  return (
    <div className={cn('flex flex-col gap-3 font-sans', !scanning && 'animate-in fade-in duration-300')}>
      {/* Compact POS header */}
      <div className="flex items-center justify-between">
        <h1 className={cn('text-xl font-bold tracking-tight', scanning ? 'text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground')}>Cart</h1>
        <div className="flex items-center gap-2">
          {supported && (
            <button
              onClick={() => setLiveOn((v) => !v)}
              aria-label={liveOn ? 'Turn camera off' : 'Turn camera on'}
              className={cn(
                'h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors active:scale-95',
                liveOn ? 'bg-primary/90 text-primary-foreground border-primary' : 'bg-card/80 text-muted-foreground border-border backdrop-blur',
              )}
            >
              {liveOn ? <Camera size={13} /> : <CameraOff size={13} />}
              {liveOn ? 'Live' : 'Off'}
            </button>
          )}
          <span className={cn('flex items-center gap-1.5 text-[11px]', scanning ? 'text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]' : 'text-muted-foreground')}>
            <User size={13} className="opacity-65" />
            <span className="font-semibold truncate max-w-[120px]">{user?.name || 'Administrator'}</span>
          </span>
        </div>
      </div>

      {/* Live scan reticle (camera shows behind the transparent page). */}
      {scanning && (
        <div className="relative h-44 rounded-2xl overflow-hidden border border-white/25 bg-white/[0.03]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-56 h-24 rounded-xl">
              {/* corner brackets */}
              {[
                'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
                'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
                'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
              ].map((c) => (
                <span key={c} className={cn('absolute w-6 h-6 border-white/80', c)} />
              ))}
              <div className="absolute inset-x-3 top-1/2 h-0.5 bg-primary/90 shadow-[0_0_12px_2px_rgba(255,255,255,0.4)] animate-scan-line" />
            </div>
          </div>
          <div className="absolute bottom-2 inset-x-0 flex justify-center">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
              <ScanLine size={12} className="animate-pulse" /> Scanning — point at a barcode
            </span>
          </div>

          {/* Success flash + product name (emil: opacity-based, fast, ease-out). */}
          <AnimatePresence>
            {flash && (
              <motion.div
                key={flash.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="absolute inset-0 flex items-center justify-center bg-emerald-500/25"
              >
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 text-white shadow-lg">
                  <Check size={16} strokeWidth={3} />
                  <span className="text-sm font-bold truncate max-w-[60vw]">{flash.name}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {scanError && (
        <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {scanError}. Use the search box or camera button below.
        </div>
      )}

      {/* Manual / HID scanner — stays available alongside live scanning */}
      <div className={cn('sticky top-0 z-30 -mx-4 px-4 py-2', !scanning && 'bg-background/85 backdrop-blur-md')}>
        <ScannerInput />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={cn('text-[10px] font-bold uppercase tracking-wider px-1 flex items-center gap-1.5', scanning ? 'text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]' : 'text-muted-foreground')}>
          <LayoutGrid size={12} className="opacity-45" /> Active Basket
        </h3>
        <CartList />
      </div>

      <BillingSummary />
    </div>
  )
}

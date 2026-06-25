import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { CameraOff, Loader2, ScanLine, Power } from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { cn } from '@/lib/utils'

interface EmbeddedScannerProps {
  /** Fires for each decoded barcode (caller de-dupes rapid repeats). */
  onDetect: (value: string) => void
  /** Centered overlay content rendered on top of the live preview. */
  children?: ReactNode
  className?: string
}

type Status = 'off' | 'starting' | 'live' | 'error'

// Retail-oriented symbologies + QR/DataMatrix. ZXing decodes these reliably
// inside the Android WebView, unlike the experimental BarcodeDetector API
// (which exists on `window` but never actually decodes here).
const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
]

/**
 * Self-contained, card-style live barcode scanner with an explicit ON/OFF
 * toggle. The camera preview lives INSIDE this box (an in-DOM <video>), never
 * full-screen and never behind the page. Decoding is done by ZXing on the live
 * video stream, giving real, continuous barcode reads. When OFF the camera is
 * fully released (tracks stopped) so it never drains the battery in the
 * background.
 */
export default function EmbeddedScanner({ onDetect, children, className }: EmbeddedScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState<Status>('off')

  // Fully release the camera + decoder.
  const stop = useCallback(() => {
    try { controlsRef.current?.stop() } catch { /* already stopped */ }
    controlsRef.current = null
    const v = videoRef.current
    if (v) {
      const s = v.srcObject as MediaStream | null
      s?.getTracks().forEach((t) => t.stop())
      v.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!active) {
      stop()
      setStatus('off')
      return
    }

    let cancelled = false
    setStatus('starting')

    const start = async () => {
      // Ensure the Android runtime camera permission is granted first.
      if (Capacitor.isNativePlatform()) {
        try {
          const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
          await BarcodeScanner.requestPermissions()
        } catch { /* fall through; getUserMedia will prompt/fail */ }
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus('error')
        return
      }

      try {
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS)
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
        readerRef.current = reader

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current!,
          (result) => {
            if (result) {
              const text = result.getText()?.trim()
              if (text) onDetectRef.current(text)
            }
            // Per-frame "not found" errors are expected and ignored.
          },
        )
        if (cancelled) { try { controls.stop() } catch { /* noop */ } return }
        controlsRef.current = controls
        setStatus('live')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [active, stop])

  // Safety net: release the camera if the component unmounts while active.
  useEffect(() => stop, [stop])

  return (
    <div
      className={cn(
        // Strictly bounded small card. Fixed height + capped width so the
        // preview is always a small centered rectangle — never full-screen.
        'relative mx-auto w-full max-w-[320px] h-44 sm:h-52 rounded-2xl border border-border bg-zinc-900 shadow-sm isolate overflow-hidden',
        className,
      )}
      style={{ contain: 'layout paint size' }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
          status === 'live' ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* ON/OFF toggle pill (always visible, top-right inside the card) */}
      <button
        type="button"
        onClick={() => setActive((a) => !a)}
        aria-pressed={active}
        className={cn(
          'absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-colors active:scale-95',
          active
            ? 'bg-emerald-500 text-white'
            : 'bg-white/90 text-zinc-700 hover:bg-white',
        )}
      >
        <Power size={12} strokeWidth={3} />
        {active ? 'Scanner On' : 'Scanner Off'}
      </button>

      {status === 'live' && (
        <>
          {/* subtle darken for overlay legibility */}
          <div className="absolute inset-0 bg-black/15 pointer-events-none" />
          {/* reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-3/5 h-1/2">
              {[
                'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
              ].map((c) => <span key={c} className={cn('absolute w-5 h-5 border-white/85', c)} />)}
              <div className="absolute inset-x-2 top-1/2 h-0.5 bg-primary shadow-[0_0_10px_2px_rgba(255,255,255,0.4)] animate-scan-line" />
            </div>
          </div>
        </>
      )}

      {/* OFF placeholder */}
      {status === 'off' && (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-white/70 hover:text-white/90 transition-colors"
        >
          <ScanLine size={26} className="opacity-80" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Scanner is off</span>
          <span className="rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
            Tap to start scanning
          </span>
        </button>
      )}

      {/* starting */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Starting camera…</span>
        </div>
      )}

      {/* error */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 px-6 text-center">
          <CameraOff size={22} />
          <span className="text-[11px] font-semibold">
            Camera unavailable. Check permission, then tap the toggle to retry — or use the search box below.
          </span>
        </div>
      )}

      {/* caller-provided centered overlay (e.g. scan confirmation), only while live */}
      {status === 'live' && children && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-4">{children}</div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { CameraOff, Loader2, ScanLine, Power, Check, X, ScanBarcode } from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { cn } from '@/lib/utils'

/** Result feedback pushed in by the parent after a product lookup. */
export interface ScanFeedback {
  id: number
  variant: 'detected' | 'success' | 'error'
  text: string
}

interface EmbeddedScannerProps {
  /** Fires for each decoded barcode (caller de-dupes rapid repeats). */
  onDetect: (value: string) => void
  /** Transient result banner shown over the preview (detected / added / not-found). */
  feedback?: ScanFeedback | null
  className?: string
}

type Status = 'off' | 'starting' | 'live' | 'error'

// Retail-oriented symbologies + QR/DataMatrix. ZXing decodes these reliably
// inside the Android WebView, unlike the experimental BarcodeDetector API.
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
 * Apply supermarket-scanner camera tuning to the live track: continuous
 * autofocus, continuous auto-exposure / white-balance, and a modest zoom to
 * help small close-range barcodes. All are applied only where the device
 * advertises support, so it degrades safely.
 */
async function tuneTrackForBarcodes(track: MediaStreamTrack) {
  try {
    const caps: any = track.getCapabilities?.() ?? {}
    const advanced: any[] = []
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' })
    }
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
      advanced.push({ exposureMode: 'continuous' })
    }
    if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
      advanced.push({ whiteBalanceMode: 'continuous' })
    }
    // Gentle optical zoom (~1.6x, capped) makes 1D barcodes larger in-frame
    // and noticeably easier to decode at close range.
    if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
      const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.6))
      advanced.push({ zoom: target })
    }
    if (advanced.length) await track.applyConstraints({ advanced } as any)
  } catch {
    /* tuning is best-effort; ignore unsupported constraints */
  }
}

/**
 * Self-contained, card-style live barcode scanner with an explicit ON/OFF
 * toggle. The camera preview lives INSIDE this box (an in-DOM <video>), never
 * full-screen and never behind the page. We own the MediaStream so we can
 * enable continuous autofocus/exposure and request a sharp resolution, then
 * hand the stream to ZXing for real, continuous decoding. When OFF the camera
 * is fully released so it never drains the battery in the background.
 */
export default function EmbeddedScanner({ onDetect, feedback, className }: EmbeddedScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState<Status>('off')
  // Brief "Scanner Ready" pulse right after the camera goes live.
  const [justReady, setJustReady] = useState(false)

  const stop = useCallback(() => {
    try { controlsRef.current?.stop() } catch { /* already stopped */ }
    controlsRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
  }, [])

  useEffect(() => {
    if (!active) {
      stop()
      setStatus('off')
      return
    }

    let cancelled = false
    setStatus('starting')
    setJustReady(false)

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
        // Own the stream so we can tune autofocus/exposure and resolution.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          } as any,
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream

        const track = stream.getVideoTracks()[0]
        if (track) await tuneTrackForBarcodes(track)

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS)
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 })

        const controls = await reader.decodeFromStream(
          stream,
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
        setJustReady(true)
        window.setTimeout(() => { if (!cancelled) setJustReady(false) }, 1400)
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

  // Idle (camera-status) message shown when there is no transient feedback.
  const idleMessage =
    status === 'off' ? 'Scanner is off'
      : status === 'starting' ? 'Starting camera…'
        : status === 'error' ? 'Camera unavailable — check permission or use search'
          : justReady ? 'Scanner Ready'
            : 'Point the camera at a barcode'

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
          'absolute top-2 right-2 z-30 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-colors active:scale-95',
          active ? 'bg-emerald-500 text-white' : 'bg-white/90 text-zinc-700 hover:bg-white',
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

      {/* starting spinner */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <Loader2 size={24} className="animate-spin" />
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

      {/* Success flash on a confirmed add */}
      {feedback?.variant === 'success' && (
        <div key={feedback.id} className="absolute inset-0 z-20 bg-emerald-500/25 animate-scan-flash pointer-events-none" />
      )}

      {/* Bottom status / feedback banner */}
      {status !== 'off' && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 pointer-events-none">
          {feedback ? (
            <span
              key={feedback.id}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg max-w-[92%] truncate animate-in fade-in slide-in-from-bottom-1 duration-150',
                feedback.variant === 'success' && 'bg-emerald-500 text-white',
                feedback.variant === 'error' && 'bg-destructive text-destructive-foreground',
                feedback.variant === 'detected' && 'bg-white/90 text-zinc-800',
              )}
            >
              {feedback.variant === 'success' && <Check size={14} strokeWidth={3} className="shrink-0" />}
              {feedback.variant === 'error' && <X size={14} strokeWidth={3} className="shrink-0" />}
              {feedback.variant === 'detected' && <ScanBarcode size={14} className="shrink-0" />}
              <span className="truncate">{feedback.text}</span>
            </span>
          ) : (
            <span className="rounded-full bg-black/45 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white/90">
              {idleMessage}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

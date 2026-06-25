import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CameraOff, Loader2, ScanLine, Power, Check, X, ScanBarcode } from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { cn } from '@/lib/utils'
import { isMlkitAvailable, startMlkitScan, type MlkitScanHandle } from '@/native/mlkitScanner'

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
  /** Show the "Your cart is empty" hint inside the card until the first scan. */
  cartEmpty?: boolean
  className?: string
}

type Status = 'off' | 'starting' | 'live' | 'error'

// Web-fallback (ZXing) symbologies — retail + QR/DataMatrix.
const ZXING_FORMATS = [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.ITF,
  BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
]

async function tuneTrackForBarcodes(track: MediaStreamTrack) {
  try {
    const caps: any = track.getCapabilities?.() ?? {}
    const advanced: any[] = []
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) advanced.push({ focusMode: 'continuous' })
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) advanced.push({ exposureMode: 'continuous' })
    if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' })
    if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
      advanced.push({ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.6)) })
    }
    if (advanced.length) await track.applyConstraints({ advanced } as any)
  } catch { /* best-effort */ }
}

/**
 * Card-style live barcode scanner with an explicit ON/OFF toggle.
 *
 * NATIVE (Android/iOS): uses Google ML Kit, which reads barcodes reliably by
 * decoding the platform camera directly. ML Kit shows the camera full-screen
 * behind a transparent WebView; the `scan-window` class + index.css repaint the
 * page opaque except this card, so it still looks like a small scanner window.
 *
 * WEB (browser/dev): falls back to an in-DOM <video> + ZXing decoding.
 *
 * When OFF, the camera is fully released so it never drains the battery.
 */
/**
 * Full-screen opaque mask with a transparent hole that tracks the scanner
 * card, so only the card reveals the ML Kit camera behind the WebView. Rendered
 * at z-index:-1 (behind all app UI, in front of the camera) via a body portal,
 * so it never covers the cart content and never bleeds at the screen edges.
 */
function CameraWindowMask({ cardRef }: { cardRef: React.RefObject<HTMLDivElement | null> }) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = cardRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        // Shrink the hole to whole pixels strictly INSIDE the card border, so
        // the opaque mask always overlaps the card edge — no sub-pixel camera
        // slivers, on any density or aspect ratio. ceil top/left, floor
        // right/bottom guarantees integer bounds within the card.
        const top = Math.ceil(r.top + 1)
        const left = Math.ceil(r.left + 1)
        const width = Math.max(0, Math.floor(r.right - 1) - left)
        const height = Math.max(0, Math.floor(r.bottom - 1) - top)
        setRect((prev) =>
          prev && prev.top === top && prev.left === left && prev.width === width && prev.height === height
            ? prev
            : { top, left, width, height },
        )
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cardRef])

  if (!rect) return null
  return createPortal(
    <div
      aria-hidden
      className="scan-window-mask"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    />,
    document.body,
  )
}

export default function EmbeddedScanner({ onDetect, feedback, cartEmpty, className }: EmbeddedScannerProps) {
  const native = isMlkitAvailable()
  const cardRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const zxingControlsRef = useRef<IScannerControls | null>(null)
  const zxingStreamRef = useRef<MediaStream | null>(null)
  const mlkitRef = useRef<MlkitScanHandle | null>(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState<Status>('off')
  const [justReady, setJustReady] = useState(false)

  const stop = useCallback(() => {
    // ML Kit
    if (mlkitRef.current) { mlkitRef.current.stop().catch(() => {}); mlkitRef.current = null }
    // ZXing
    try { zxingControlsRef.current?.stop() } catch { /* noop */ }
    zxingControlsRef.current = null
    zxingStreamRef.current?.getTracks().forEach((t) => t.stop())
    zxingStreamRef.current = null
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

    const goLive = () => {
      if (cancelled) return
      setStatus('live')
      setJustReady(true)
      window.setTimeout(() => { if (!cancelled) setJustReady(false) }, 1400)
    }

    const startNative = async () => {
      try {
        const handle = await startMlkitScan((value) => onDetectRef.current(value))
        if (cancelled) { handle.stop().catch(() => {}); return }
        mlkitRef.current = handle
        goLive()
      } catch (err) {
        console.warn('[scanner] ML Kit start failed:', err)
        if (!cancelled) setStatus('error')
      }
    }

    const startWeb = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('error'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } as any,
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        zxingStreamRef.current = stream
        const track = stream.getVideoTracks()[0]
        if (track) await tuneTrackForBarcodes(track)

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS)
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 })
        const controls = await reader.decodeFromStream(stream, videoRef.current!, (result) => {
          if (result) {
            const text = result.getText()?.trim()
            if (text) { console.log('[scanner] barcode decoded (web):', text); onDetectRef.current(text) }
          }
        })
        if (cancelled) { try { controls.stop() } catch { /* noop */ } return }
        zxingControlsRef.current = controls
        goLive()
      } catch (err) {
        console.warn('[scanner] web camera start failed:', err)
        if (!cancelled) setStatus('error')
      }
    }

    if (native) startNative(); else startWeb()
    return () => { cancelled = true; stop() }
  }, [active, native, stop])

  // Safety net: release the camera if the component unmounts while active.
  useEffect(() => stop, [stop])

  const idleMessage =
    status === 'off' ? 'Scanner is off'
      : status === 'starting' ? 'Starting camera…'
        : status === 'error' ? 'Camera unavailable — check permission or use search'
          : justReady ? 'Scanner Ready'
            : 'Scanning…'

  // On native, the card is a transparent "window" onto the camera behind the
  // WebView; on web it holds the <video>. Only the web card clips its contents.
  const liveWindow = status === 'live' && native

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative mx-auto w-full max-w-[320px] h-44 sm:h-52 rounded-2xl border border-border shadow-sm',
        liveWindow ? 'scan-window' : 'bg-zinc-900 overflow-hidden isolate',
        className,
      )}
      style={liveWindow ? undefined : { contain: 'layout paint' }}
    >
      {liveWindow && <CameraWindowMask cardRef={cardRef} />}
      {/* Web fallback preview */}
      {!native && (
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
      )}

      {/* ON/OFF toggle pill */}
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

      {/* Live reticle */}
      {status === 'live' && (
        <>
          {!native && <div className="absolute inset-0 bg-black/15 pointer-events-none" />}
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

      {/* "Your cart is empty" hint (centered, until the first product is added) */}
      {status === 'live' && cartEmpty && !feedback && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-4">
          <span className="rounded-full bg-black/45 backdrop-blur-sm px-3.5 py-1.5 text-sm font-semibold text-white">
            Your cart is empty
          </span>
        </div>
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

      {/* Success flash */}
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

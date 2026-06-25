import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { CameraOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmbeddedScannerProps {
  /** Fires for each decoded barcode (caller de-dupes rapid repeats). */
  onDetect: (value: string) => void
  /** Centered overlay content rendered on top of the live preview. */
  children?: ReactNode
  className?: string
}

/**
 * Self-contained, card-style live barcode scanner. The camera preview lives
 * INSIDE this box (an in-DOM <video>), never full-screen and never behind the
 * page. Uses getUserMedia + the WebView's BarcodeDetector for a continuous,
 * loop-based scan. Degrades gracefully where unsupported.
 */
export default function EmbeddedScanner({ onDetect, children, className }: EmbeddedScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [status, setStatus] = useState<'starting' | 'live' | 'error' | 'unsupported'>('starting')

  useEffect(() => {
    let cancelled = false
    let detector: any = null
    let lastTick = 0

    const loop = async () => {
      rafRef.current = requestAnimationFrame(loop)
      const video = videoRef.current
      if (!video || video.readyState < 2 || !detector) return
      const now = performance.now()
      if (now - lastTick < 110) return // throttle ~9fps for smooth performance
      lastTick = now
      try {
        const codes = await detector.detect(video)
        if (codes && codes.length) {
          const v = codes[0]?.rawValue
          if (v) onDetectRef.current(String(v).trim())
        }
      } catch {
        /* a frame may not be decodable — keep looping */
      }
    }

    const start = async () => {
      const hasGUM = !!navigator.mediaDevices?.getUserMedia
      const hasDetector = 'BarcodeDetector' in window
      if (!hasGUM || !hasDetector) { setStatus('unsupported'); return }

      // Ensure the Android runtime camera permission is granted before getUserMedia.
      if (Capacitor.isNativePlatform()) {
        try {
          const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
          await BarcodeScanner.requestPermissions()
        } catch { /* fall through; getUserMedia will prompt/fail */ }
      }

      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix'],
        })
      } catch {
        try { detector = new (window as any).BarcodeDetector() } catch { setStatus('unsupported'); return }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play().catch(() => {})
        setStatus('live')
        rafRef.current = requestAnimationFrame(loop)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    start()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  return (
    <div className={cn('relative mx-auto w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-zinc-900 shadow-sm', className)}>
      <video ref={videoRef} muted playsInline autoPlay className="absolute inset-0 w-full h-full object-cover" />

      {/* subtle darken for overlay legibility */}
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />

      {/* reticle */}
      {status === 'live' && (
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
      )}

      {/* status overlays */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Starting camera…</span>
        </div>
      )}
      {(status === 'error' || status === 'unsupported') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 px-6 text-center">
          <CameraOff size={22} />
          <span className="text-[11px] font-semibold">
            {status === 'unsupported' ? 'Live camera not available here — use the search box below.' : 'Camera unavailable. Check permission, or use the search box.'}
          </span>
        </div>
      )}

      {/* caller-provided centered overlay (e.g. "Your cart is empty") */}
      {children && <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">{children}</div>}
    </div>
  )
}

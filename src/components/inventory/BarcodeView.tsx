import { useEffect, useRef } from 'react'
import bwipjs from 'bwip-js'
import { cn } from '@/lib/utils'

interface BarcodeViewProps {
  value: string
  width?: number
  height?: number
  className?: string
}

export default function BarcodeView({ value, width = 100, height = 10, className }: BarcodeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        (bwipjs as any).toCanvas(canvasRef.current, {
          bcid: 'code128',       // Barcode type
          text: value,           // Text to encode
          scale: 2,              // Consistent scale
          height: height,        // Bar height in mm
          includetext: false,    // Show human-readable text
          textxalign: 'center',
        })
      } catch (e) {
        console.error('Barcode generation error:', e)
      }
    }
  }, [value, height])

  return (
    <div className={cn("overflow-hidden flex items-center justify-center bg-white", className)}>
      <canvas ref={canvasRef} className="max-w-full h-auto" />
    </div>
  )
}


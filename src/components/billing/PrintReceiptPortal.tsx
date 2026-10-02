import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { A4Invoice, ThermalReceipt, type ReceiptOrder } from './ReceiptTemplates'
import { hardware } from '@/lib/hardware'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'

interface PrintReceiptPortalProps {
  order: ReceiptOrder
  type: 'A4' | 'Thermal'
  onClose: () => void
  autoPrint?: boolean
}

export default function PrintReceiptPortal({ order, type, onClose, autoPrint = true }: PrintReceiptPortalProps) {
  const width = useStore((s) => s.settings?.receiptWidth ?? 80)
  const { t, dir } = useI18n()
  // Kept in a ref so a parent re-render does not print again.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const styleId = 'receipt-print-styles'
    let style = document.getElementById(styleId) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    // Roll printers feed continuously; the height only needs to fit the ticket.
    const rollHeight = 120 + order.items.length * 9 + (order.payments?.length ?? 1) * 5
    const pageSize = type === 'A4' ? 'A4 portrait' : `${width}mm ${rollHeight}mm`
    style.innerHTML = `
      @page { size: ${pageSize}; margin: 0; }
      @media print {
        body * { visibility: hidden; }
        #receipt-print-area, #receipt-print-area * { visibility: visible; }
        #receipt-print-area { position: absolute; inset-inline-start: 0; top: 0; width: 100%; }
        #root { display: none !important; }
      }
    `
    const timer = setTimeout(() => autoPrint && hardware.print(), 300)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      if (style) style.innerHTML = ''
    }
  }, [type, autoPrint, width, order])

  return createPortal(
    <div id="receipt-print-area" dir={dir} className="fixed inset-0 z-[9999] bg-white print:static h-screen overflow-auto">
      <div className="print:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] flex gap-3 bg-zinc-950 p-2.5 rounded-md shadow-xl font-sans">
        <button onClick={() => hardware.print()} className="px-4 py-2 bg-white text-black font-semibold text-sm rounded hover:opacity-90">
          {t('receipt.print')}
        </button>
        <button onClick={onClose} className="px-4 py-2 bg-zinc-800 text-white font-semibold text-sm rounded hover:bg-zinc-700">
          {t('receipt.closePreview')}
        </button>
      </div>
      <div className="bg-gray-100 min-h-screen py-10 print:p-0 print:bg-white flex justify-center">
        <div className="shadow-xl print:shadow-none bg-white self-start">
          {type === 'A4' ? <A4Invoice order={order} /> : <ThermalReceipt order={order} />}
        </div>
      </div>
    </div>,
    document.body
  )
}

import { createPortal } from 'react-dom'
import { A4Invoice, ThermalReceipt } from './ReceiptTemplates'
import { useEffect, useState } from 'react'
import { hardware } from '@/lib/hardware'
import BluetoothPrintButton from './BluetoothPrintButton'

interface PrintReceiptPortalProps {
  order: any
  type: 'A4' | 'Thermal'
  onClose: () => void
  autoPrint?: boolean
}

export default function PrintReceiptPortal({ order, type, onClose, autoPrint = true }: PrintReceiptPortalProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Inject dynamic print styles
    const styleId = 'receipt-print-styles'
    let styleElement = document.getElementById(styleId) as HTMLStyleElement
    
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      document.head.appendChild(styleElement)
    }

    const pageSize = type === 'A4' ? 'A4 portrait' : '80mm 200mm' // Adjust 200mm based on content or use 'auto'
    
    styleElement.innerHTML = `
      @page {
        size: ${pageSize};
        margin: 0;
      }
      @media print {
        body * {
          visibility: hidden;
        }
        #receipt-print-area, #receipt-print-area * {
          visibility: visible;
        }
        #receipt-print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        aside, header, #root {
          display: none !important;
        }
      }
    `

    // Small delay to ensure styles are applied
    const timer = setTimeout(() => {
      setIsReady(true)
      if (autoPrint) {
        hardware.print()
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      if (styleElement) styleElement.innerHTML = ''
    }
  }, [type, autoPrint])

  return createPortal(
    <div id="receipt-print-area" className="fixed inset-0 z-[9999] bg-white print:static print:z-auto h-screen overflow-auto">
      {/* Screen View (Preview/Buttons) */}
      <div className="print:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] flex gap-3 bg-zinc-950 p-2.5 rounded-md border border-white/15 shadow-xl font-sans">
         <button
           onClick={() => hardware.print()}
           className="px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:opacity-90 transition-all cursor-pointer"
         >
           Print Invoice
         </button>
         {type === 'Thermal' && <BluetoothPrintButton order={order} />}
         <button
           onClick={onClose}
           className="px-4 py-2 bg-zinc-800 text-white font-semibold text-xs rounded hover:bg-zinc-700 transition-all cursor-pointer"
         >
           Close Preview
         </button>
      </div>

      {/* Actual Content Area */}
      <div className="bg-gray-100 dark:bg-zinc-900 min-h-screen py-10 print:p-0 print:bg-white flex justify-center">
        {type === 'A4' ? (
          <div className="shadow-2xl print:shadow-none bg-white">
            <A4Invoice order={order} />
          </div>
        ) : (
          <div className="w-[80mm] shadow-[0_0_50px_rgba(0,0,0,0.1)] print:shadow-none bg-white border border-gray-200 print:border-none min-h-[150mm]">
            <ThermalReceipt order={order} />
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

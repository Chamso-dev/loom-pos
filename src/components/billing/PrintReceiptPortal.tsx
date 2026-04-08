import { createPortal } from 'react-dom'
import { A4Invoice, ThermalReceipt } from './ReceiptTemplates'
import { useEffect, useState } from 'react'

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
        window.print()
        // Close after print dialog is closed (note: this might be too fast in some browsers)
        // Alternative: let the user click "Done" in the UI
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
      <div className="print:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex gap-4 bg-black/80 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl">
         <button 
           onClick={() => window.print()}
           className="px-6 py-2 bg-primary text-primary-foreground font-black rounded-xl hover:scale-105 transition-transform"
         >
           Print Again
         </button>
         <button 
           onClick={onClose}
           className="px-6 py-2 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all"
         >
           Done / Close
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

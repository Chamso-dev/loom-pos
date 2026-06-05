import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Settings2, Minus, Plus, Ruler, Grid3X3 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type Product } from '@/store/useStore'
import BarcodeLabel from './BarcodeLabel'
import { cn } from '@/lib/utils'

interface PrintLabelsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProducts: Product[]
}

export default function PrintLabelsModal({ isOpen, onClose, selectedProducts }: PrintLabelsModalProps) {
  const [printerType, setPrinterType] = useState<'a4' | 'roll'>('roll')
  const [width, setWidth] = useState(50)
  const [height, setHeight] = useState(25)
  const [gap, setGap] = useState(4)
  const [quantities, setQuantities] = useState<Record<string, number>>(
    selectedProducts.reduce((acc, p) => ({ ...acc, [p.id]: 1 }), {})
  )

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const updateQuantity = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }))
  }

  const labelsToPrint = selectedProducts.flatMap(product => 
    Array.from({ length: quantities[product.id] || 1 }).map((_, i) => ({
      ...product,
      key: `${product.id}-${i}`
    }))
  )

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:p-0 print:bg-white print:relative print:block">
      {/* Dynamic Print Styles for Roll Printers */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          #root, aside, header, nav { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page {
            size: ${printerType === 'roll' ? `${width}mm ${height}mm` : 'A4'};
            margin: 0;
          }
          .print-roll-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 0 !important;
          }
          .print-label-wrapper {
            break-after: page !important;
            margin: 0 !important;
          }
        }
      `}} />

      <Card className={cn(
        "w-full max-w-5xl h-[90vh] flex flex-col shadow-lg border border-border animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:w-auto print:h-auto print:max-w-none print:static",
        "bg-card"
      )}>
        <CardHeader className="flex flex-row items-center justify-between print:hidden shrink-0 border-b border-border/40 py-4">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Print Barcode Labels</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-6 print:p-0 print:block">
          {/* Configuration - Hidden on Print */}
          <div className="w-full md:w-96 space-y-6 print:hidden overflow-y-auto pr-6 border-r border-border/40 custom-scrollbar">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Settings2 size={12} /> Printer Mode
              </h3>
              <div className="grid grid-cols-2 gap-1 p-1 bg-accent/20 rounded-md border border-border/40">
                <Button 
                  variant={printerType === 'roll' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setPrinterType('roll')}
                  className="text-xs h-8 gap-2"
                >
                  <Printer size={12} /> Roll
                </Button>
                <Button 
                  variant={printerType === 'a4' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setPrinterType('a4')}
                  className="text-xs h-8 gap-2"
                >
                  <Grid3X3 size={12} /> A4 Sheet
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Ruler size={12} /> Label Size & Gap (mm)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Width</span>
                  <Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="h-8 text-xs bg-background border-border" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Height</span>
                  <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="h-8 text-xs bg-background border-border" />
                </div>
                {printerType === 'a4' && (
                  <div className="space-y-1 col-span-2">
                    <span className="text-[10px] text-muted-foreground font-medium">Grid Gap</span>
                    <Input type="number" value={gap} onChange={(e) => setGap(Number(e.target.value))} className="h-8 text-xs bg-background border-border" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Label Quantities</h3>
              <div className="space-y-2">
                {selectedProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-2 bg-accent/20 rounded-md border border-border/20 text-xs text-foreground/80">
                    <span className="truncate flex-1 font-medium mr-2">{product.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(product.id, -1)} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"><Minus size={12} /></button>
                      <span className="w-4 text-center font-bold text-foreground">{quantities[product.id]}</span>
                      <button onClick={() => updateQuantity(product.id, 1)} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"><Plus size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Area - Shows only one of each product design on screen for verification */}
          <div className="flex-1 bg-accent/5 rounded-lg border border-border/20 p-8 overflow-y-auto print:hidden custom-scrollbar">
             <div className="flex flex-col items-center gap-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Settings2 size={12} /> Design Preview
                </h3>
               <div className="flex flex-wrap gap-6 justify-center">
                 {selectedProducts.map((product) => (
                   <div key={product.id} className="shadow-md border border-border/20 hover:scale-[1.02] transition-transform">
                     <BarcodeLabel 
                      product={product} 
                      width={width} 
                      height={height} 
                      showDottedBorder={printerType === 'a4'}
                     />
                   </div>
                 ))}
               </div>
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-4">
                 One preview shown per product design
               </p>
             </div>
          </div>

          {/* Hidden Print Area - This is what actually gets printed */}
          <div className="hidden print:block print:p-0 print:bg-transparent print:overflow-visible">
             <div 
               className={cn(
                 "justify-items-center print:bg-white",
                 printerType === 'roll' 
                  ? "flex flex-col items-center gap-0 print:print-roll-container" 
                  : "grid print:grid-cols-4"
               )}
               style={printerType === 'a4' ? { gap: `${gap}mm` } : {}}
             >
               {labelsToPrint.map((label) => (
                 <div key={label.key} className="print-label-wrapper shadow-none">
                   <BarcodeLabel 
                    product={label} 
                    width={width} 
                    height={height} 
                    showDottedBorder={printerType === 'a4'}
                   />
                 </div>
               ))}
             </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t border-border/40 pt-4 pb-6 px-6 print:hidden shrink-0">
          <p className="text-xs text-muted-foreground">
            Total labels: <span className="font-bold text-foreground">{labelsToPrint.length}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancel</Button>
            <Button variant="default" className="gap-2 h-9 text-xs" onClick={handlePrint}>
              <Printer size={14} />
              Print Labels
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )

  return createPortal(modalContent, document.body)
}



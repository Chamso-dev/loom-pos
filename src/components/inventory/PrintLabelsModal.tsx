import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type Product } from '@/store/useStore'
import { useI18n } from '@/i18n'
import BarcodeLabel from './BarcodeLabel'
import { cn } from '@/lib/utils'

interface PrintLabelsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProducts: Product[]
}

export default function PrintLabelsModal({ isOpen, onClose, selectedProducts }: PrintLabelsModalProps) {
  const { t, dir } = useI18n()
  const [printerType, setPrinterType] = useState<'a4' | 'roll'>('roll')
  const [width, setWidth] = useState(50)
  const [height, setHeight] = useState(25)
  const [gap, setGap] = useState(4)
  const [quantities, setQuantities] = useState<Record<string, number>>(Object.fromEntries(selectedProducts.map((p) => [p.id, 1])))

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const updateQuantity = (id: string, delta: number) => setQuantities((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }))
  const labels = selectedProducts.flatMap((product) => Array.from({ length: quantities[product.id] || 1 }, (_, i) => ({ ...product, key: `${product.id}-${i}` })))
  const numberInput = (value: number, onChange: (v: number) => void, label: string) => (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <input type="number" min={1} value={value} onChange={(e) => onChange(Number(e.target.value))} dir="ltr" className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground" />
    </label>
  )

  return createPortal(
    <div dir={dir} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 print:p-0 print:bg-white print:relative print:block font-sans">
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            #root { display: none !important; }
            body { background: white !important; margin: 0 !important; }
            @page { size: ${printerType === 'roll' ? `${width}mm ${height}mm` : 'A4'}; margin: 0; }
            .print-label-wrapper { break-after: ${printerType === 'roll' ? 'page' : 'auto'}; }
          }`,
        }}
      />
      <div role="dialog" aria-modal="true" className="w-full max-w-5xl h-[90vh] flex flex-col bg-card rounded-xl border border-border shadow-xl print:shadow-none print:border-none print:h-auto print:max-w-none">
        <div className="flex items-center justify-between p-4 border-b border-border print:hidden">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Printer size={18} className="text-muted-foreground" /> {t('inventory.labelsTitle')}
          </h2>
          <button onClick={onClose} aria-label={t('common.close')} className="p-2 rounded-md hover:bg-accent">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-6 print:p-0 print:block">
          <div className="w-full md:w-80 space-y-6 print:hidden overflow-y-auto pe-4 md:border-e border-border custom-scrollbar">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('inventory.printerMode')}</h3>
              <div className="grid grid-cols-2 gap-1 p-1 bg-accent/20 rounded-md border border-border">
                {(['roll', 'a4'] as const).map((mode) => (
                  <Button key={mode} variant={printerType === mode ? 'secondary' : 'ghost'} size="sm" onClick={() => setPrinterType(mode)} aria-pressed={printerType === mode}>
                    {mode === 'roll' ? t('inventory.roll') : t('inventory.sheet')}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('inventory.labelSize')}</h3>
              <div className="grid grid-cols-2 gap-3">
                {numberInput(width, setWidth, t('inventory.width'))}
                {numberInput(height, setHeight, t('inventory.height'))}
                {printerType === 'a4' && numberInput(gap, setGap, t('inventory.gap'))}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('inventory.quantities')}</h3>
              {selectedProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-2 p-2 bg-accent/20 rounded-md border border-border text-sm">
                  <span className="truncate flex-1"><bdi>{product.name}</bdi></span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(product.id, -1)} aria-label={t('billing.decrease')} className="p-1 hover:bg-accent rounded"><Minus size={12} /></button>
                    <span className="w-5 text-center font-bold tabular-nums">{quantities[product.id]}</span>
                    <button onClick={() => updateQuantity(product.id, 1)} aria-label={t('billing.increase')} className="p-1 hover:bg-accent rounded"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-accent/5 rounded-lg border border-border p-8 overflow-y-auto print:hidden custom-scrollbar">
            <h3 className="text-sm font-semibold text-muted-foreground text-center mb-6">{t('inventory.preview')}</h3>
            <div className="flex flex-wrap gap-6 justify-center">
              {selectedProducts.map((product) => (
                <div key={product.id} className="shadow-md">
                  <BarcodeLabel product={product} width={width} height={height} showDottedBorder={printerType === 'a4'} />
                </div>
              ))}
            </div>
          </div>

          <div className="hidden print:block">
            <div className={cn(printerType === 'roll' ? 'flex flex-col items-center' : 'grid grid-cols-4')} style={printerType === 'a4' ? { gap: `${gap}mm` } : {}}>
              {labels.map((label) => (
                <div key={label.key} className="print-label-wrapper">
                  <BarcodeLabel product={label} width={width} height={height} showDottedBorder={printerType === 'a4'} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border p-4 print:hidden">
          <p className="text-sm text-muted-foreground">{t('inventory.totalLabels', { count: labels.length })}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button className="gap-2" onClick={() => window.print()}>
              <Printer size={14} /> {t('inventory.print')}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

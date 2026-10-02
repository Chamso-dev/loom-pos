import BarcodeView from './BarcodeView'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

interface BarcodeLabelProps {
  product: { name: string; sku: string; size?: string | null; sellingPrice: number; barcode: string; unit?: string }
  width?: number
  height?: number
  showDottedBorder?: boolean
}

/** Shelf and product label: name, barcode and the tax-included price per unit. */
export default function BarcodeLabel({ product, width = 50, height = 25, showDottedBorder = true }: BarcodeLabelProps) {
  const { unitPrice, code, dir } = useI18n()
  return (
    <div
      dir={dir}
      className={cn(
        'flex flex-col items-center justify-between bg-white text-black p-1.5 select-none overflow-hidden print:m-0 font-sans',
        showDottedBorder ? 'border border-dashed border-black/30' : 'border-none'
      )}
      style={{ width: `${width}mm`, height: `${height}mm` }}
    >
      <div className="w-full text-center">
        <p className="text-[10px] font-bold leading-tight truncate"><bdi>{product.name}</bdi></p>
        {product.size && <p className="text-[8px] leading-tight opacity-80">{product.size}</p>}
      </div>
      <div className="flex-1 flex items-center justify-center w-full min-h-0 py-1">
        <BarcodeView value={product.barcode} width={width * 3} height={8} className="w-full" />
      </div>
      <div className="w-full flex justify-between items-end gap-1">
        <span className="text-[7px] leading-none opacity-70">{code(product.barcode)}</span>
        <span className="text-[12px] font-black leading-none whitespace-nowrap">{unitPrice(product.sellingPrice, product.unit ?? 'piece')}</span>
      </div>
    </div>
  )
}

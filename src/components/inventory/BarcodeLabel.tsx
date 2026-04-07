import BarcodeView from './BarcodeView'
import { formatCurrency, cn } from '@/lib/utils'

interface BarcodeLabelProps {
  product: {
    name: string
    sku: string
    size?: string | null
    sellingPrice: number
    barcode: string
  }
  width?: number // in mm
  height?: number // in mm
  showDottedBorder?: boolean
}

export default function BarcodeLabel({ 
  product, 
  width = 50, 
  height = 25, 
  showDottedBorder = true 
}: BarcodeLabelProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-between bg-white text-black p-2 select-none overflow-hidden print:m-0",
        showDottedBorder ? "border border-dashed border-black/30" : "border-none"
      )}
      style={{ 
        width: `${width}mm`, 
        height: `${height}mm`,
      }}
    >
      <div className="w-full flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-black uppercase leading-none truncate w-full text-center tracking-tight">
          {product.name}
        </span>
        <div className="flex justify-between w-full text-[8px] font-bold px-0.5 opacity-80">
          <span className="truncate mr-1">SKU: {product.sku}</span>
          {product.size && <span className="whitespace-nowrap">Size: {product.size}</span>}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center w-full min-h-0 py-2">
        <BarcodeView 
          value={product.barcode} 
          width={width * 3} 
          height={8} // 8mm bar height is perfect for small labels
          className="grayscale mix-blend-multiply w-full"
        />
      </div>

      <div className="w-full flex justify-between items-end px-0.5">
         <span className="text-[7px] font-mono leading-none opacity-70">{product.barcode}</span>
         <span className="text-[12px] font-black leading-none">{formatCurrency(product.sellingPrice)}</span>
      </div>
    </div>
  )
}


import { type Product, useStore } from '@/store/useStore'
import { Checkbox } from '@/components/ui/checkbox'
import { Edit2, Trash2, Tag } from 'lucide-react'
import BarcodeView from './BarcodeView'
import { cn, formatCurrency } from '@/lib/utils'

interface InventoryTableProps {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  selectedIds: string[]
  onSelectionToggle: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
}

export default function InventoryTable({
  products,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionToggle,
  onSelectAll,
}: InventoryTableProps) {
  const { isLoadingProducts } = useStore()

  if (isLoadingProducts && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground animate-pulse text-sm">
        Fetching products...
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-muted-foreground border-2 border-dashed border-border rounded-2xl text-center px-6">
        <Tag size={36} className="mb-3 opacity-20" />
        <p className="text-sm">No products found. Start by adding one!</p>
      </div>
    )
  }

  const allSelected = products.length > 0 && selectedIds.length === products.length

  return (
    <div className="space-y-2.5 font-sans">
      {/* Select-all bar */}
      <label className="flex items-center gap-2.5 px-1 py-1 cursor-pointer">
        <Checkbox
          checked={allSelected}
          onChange={(e) => onSelectAll((e.target as HTMLInputElement).checked)}
        />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
        </span>
      </label>

      {products.map((product) => {
        const isWeighted = product.productType === 'WEIGHTED'
        const isLowStock = product.stock < (isWeighted ? 2 : 10)
        const isSelected = selectedIds.includes(product.id)
        const expiry = product.expiryDate ? new Date(product.expiryDate) : null
        const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null

        return (
          <div
            key={product.id}
            className={cn(
              'rounded-2xl border bg-card p-3.5 shadow-sm transition-colors',
              isSelected ? 'border-primary/40 bg-accent/30' : 'border-border',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="pt-0.5">
                <Checkbox
                  checked={isSelected}
                  onChange={(e) => onSelectionToggle(product.id, (e.target as HTMLInputElement).checked)}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm tracking-tight truncate">{product.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{product.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground text-sm tabular-nums">{formatCurrency(product.sellingPrice)}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">GST {product.gst}%</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">
                    SKU: {product.sku}
                  </span>
                  {isWeighted && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Weighed</span>}
                  {daysToExpiry !== null && (
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border',
                      daysToExpiry < 0 ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : daysToExpiry <= 7 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                        : 'bg-secondary text-muted-foreground border-border',
                    )}>
                      {daysToExpiry < 0 ? 'Expired' : daysToExpiry === 0 ? 'Expires today' : `${daysToExpiry}d left`}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-2.5">
                  <div className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold',
                    isLowStock
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-secondary text-foreground border-border',
                  )}>
                    {isWeighted ? `${product.stock} kg` : `${product.stock} units`}
                    {isLowStock && <span className="uppercase ml-0.5">· Low</span>}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEdit(product)}
                      aria-label="Edit product"
                      className="h-9 w-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground/80 active:scale-95 transition-transform"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(product.id)}
                      aria-label="Delete product"
                      className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center text-red-500 active:scale-95 transition-transform"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <BarcodeView
                  value={product.barcode}
                  width={120}
                  height={28}
                  className="mt-2.5 bg-white border border-zinc-150 rounded-lg p-1.5 w-full max-w-[180px] h-9 opacity-80"
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

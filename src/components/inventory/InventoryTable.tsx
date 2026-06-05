import { type Product, useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Edit2, Trash2, Tag, AlertCircle } from 'lucide-react'
import BarcodeView from './BarcodeView'
import { cn } from '@/lib/utils'

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
  onSelectAll 
}: InventoryTableProps) {
  const { isLoadingProducts } = useStore()

  if (isLoadingProducts) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
        Fetching products...
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-border rounded-xl">
        <Tag size={40} className="mb-4 opacity-20" />
        <p>No products found. Start by adding one!</p>
      </div>
    )
  }

  const allSelected = products.length > 0 && selectedIds.length === products.length

  return (
    <div className="overflow-x-auto rounded border border-border bg-card shadow-sm font-sans">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/40 text-muted-foreground border-b border-border">
          <tr>
            <th className="px-4 py-3 w-4">
              <Checkbox 
                checked={allSelected}
                onChange={(e) => onSelectAll((e.target as HTMLInputElement).checked)}
              />
            </th>
            <th className="px-4 py-3 font-bold uppercase tracking-wider text-[9px]">Product</th>
            <th className="px-4 py-3 font-bold uppercase tracking-wider text-[9px]">Identifiers</th>
            <th className="px-4 py-3 font-bold uppercase tracking-wider text-[9px]">Pricing</th>
            <th className="px-4 py-3 font-bold uppercase tracking-wider text-[9px]">Stock Status</th>
            <th className="px-4 py-3 font-bold uppercase tracking-wider text-[9px] text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {products.map((product) => {
            const isLowStock = product.stock < 10
            const isSelected = selectedIds.includes(product.id)

            return (
              <tr 
                key={product.id} 
                className={cn(
                  "group transition-colors",
                  isSelected ? "bg-accent/40" : "hover:bg-accent/15"
                )}
              >
                <td className="px-4 py-3">
                  <Checkbox 
                    checked={isSelected}
                    onChange={(e) => onSelectionToggle(product.id, (e.target as HTMLInputElement).checked)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-sm tracking-tight">{product.name}</span>
                    <span className="text-[9px] text-muted-foreground uppercase mt-0.5">{product.category}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                       <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">SKU: {product.sku}</span>
                    </div>
                    <BarcodeView 
                      value={product.barcode} 
                      width={80} 
                      height={10} 
                      className="mt-1 opacity-70 group-hover:opacity-100 transition-opacity bg-white border border-zinc-150 rounded p-1 max-w-[90px] h-6" 
                    />
                    <span className="text-[9px] text-muted-foreground font-mono">{product.barcode}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">₹{product.sellingPrice.toFixed(2)}</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">GST: {product.gst}% (₹{((product.sellingPrice * product.gst) / 100).toFixed(2)})</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold transition-all",
                      isLowStock 
                        ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" 
                        : "bg-secondary text-foreground border-border"
                    )}>
                      {product.stock} units
                    </div>
                    {isLowStock && <span className="text-[9px] text-destructive font-semibold uppercase">Low</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(product)} className="h-7 w-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                      <Edit2 size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(product.id)} className="h-7 w-7 rounded hover:bg-red-500/5 text-muted-foreground hover:text-destructive">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


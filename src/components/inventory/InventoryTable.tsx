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
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-accent/50 text-muted-foreground border-b border-border">
          <tr>
            <th className="px-6 py-4 w-4">
              <Checkbox 
                checked={allSelected}
                onChange={(e) => onSelectAll((e.target as HTMLInputElement).checked)}
              />
            </th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Product Info</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Codes</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Price Details</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Stock Status</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px] text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((product) => {
            const isLowStock = product.stock < 10
            const isSelected = selectedIds.includes(product.id)

            return (
              <tr 
                key={product.id} 
                className={cn(
                  "group transition-colors",
                  isSelected ? "bg-primary/5" : "hover:bg-accent/30"
                )}
              >
                <td className="px-6 py-4">
                  <Checkbox 
                    checked={isSelected}
                    onChange={(e) => onSelectionToggle(product.id, (e.target as HTMLInputElement).checked)}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-base tracking-tight">{product.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{product.category}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border/60">SKU: {product.sku}</span>
                    </div>
                    <BarcodeView 
                      value={product.barcode} 
                      width={100} 
                      height={12} 
                      className="mt-1 opacity-70 group-hover:opacity-100 transition-opacity bg-white/50 rounded p-1 max-w-[120px]" 
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">{product.barcode}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-foreground font-medium">₹{product.sellingPrice.toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground">GST: {product.gst}% (₹{((product.sellingPrice * product.gst) / 100).toFixed(2)})</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm transition-all",
                      isLowStock 
                        ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" 
                        : "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {isLowStock && <AlertCircle size={14} />}
                      {product.stock} units
                    </div>
                    {isLowStock && <span className="text-[10px] text-destructive font-medium uppercase animate-in fade-in duration-500">Low Stock</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(product)} className="h-8 w-8 hover:text-primary transition-colors">
                      <Edit2 size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(product.id)} className="h-8 w-8 hover:text-destructive transition-colors">
                      <Trash2 size={16} />
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


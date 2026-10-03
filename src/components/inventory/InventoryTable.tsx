import { type Product } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Edit2, Trash2, Tag } from 'lucide-react'
import BarcodeView from './BarcodeView'
import { useI18n } from '@/i18n'
import { unitRule } from '@/lib/domain'
import { cn } from '@/lib/utils'
import ExpiryBadge from './ExpiryBadge'

interface InventoryTableProps {
  products: Product[]
  loading: boolean
  searching: boolean
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  selectedIds: string[]
  onSelectionToggle: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
}

export default function InventoryTable({ products, loading, searching, onEdit, onDelete, selectedIds, onSelectionToggle, onSelectAll }: InventoryTableProps) {
  const { t, money, unitPrice, qty, code, percent } = useI18n()

  if (loading && products.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('inventory.loadingProducts')}</div>
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl p-6">
        <Tag size={36} className="mb-3 opacity-30" />
        <p className="font-semibold text-foreground/80">{searching ? t('inventory.noMatch') : t('inventory.emptyTitle')}</p>
        {!searching && <p className="text-sm mt-1">{t('inventory.emptyHint')}</p>}
      </div>
    )
  }

  const allSelected = selectedIds.length === products.length

  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-start text-sm">
        <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs">
          <tr>
            <th className="px-4 py-3 w-4 max-sm:hidden">
              <Checkbox checked={allSelected} aria-label={t('inventory.selectAll')} onChange={(e) => onSelectAll((e.target as HTMLInputElement).checked)} />
            </th>
            <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('inventory.product')}</th>
            <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-lg:hidden">{t('inventory.identifiers')}</th>
            <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('inventory.pricing')}</th>
            <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-sm:hidden">{t('inventory.stock')}</th>
            <th className="px-4 py-3"><span className="sr-only">{t('common.actions')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {products.map((product) => {
            const low = product.stock <= unitRule(product.unit).lowStockAt
            const out = product.stock <= 0
            const isSelected = selectedIds.includes(product.id)
            const stockBadge = (
              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold whitespace-nowrap',
                    out
                      ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                      : low
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30'
                        : 'bg-secondary text-foreground border-border'
                  )}
                >
                  {out ? t('inventory.out') : qty(product.stock, product.unit, true)}
                </span>
                {low && !out && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t('inventory.low')}</span>}
              </span>
            )
            return (
              <tr key={product.id} className={cn('transition-colors', isSelected ? 'bg-accent/40' : 'hover:bg-accent/15')}>
                {/* Label printing (the checkboxes) is a desk task; phones keep the room for stock. */}
                <td className="px-4 py-3 max-sm:hidden">
                  <Checkbox
                    checked={isSelected}
                    aria-label={t('inventory.selectProduct', { name: product.name })}
                    onChange={(e) => onSelectionToggle(product.id, (e.target as HTMLInputElement).checked)}
                  />
                </td>
                <td className="px-4 py-3 max-sm:px-2.5">
                  <p className="font-semibold text-foreground"><bdi>{product.name}</bdi></p>
                  {/* A flex gap, not a margin: inside <bdi> a margin follows the text's own direction and
                      ended up on the wrong side in Arabic, joining "5 kg" and "Épicerie". */}
                  <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <bdi>{product.category}</bdi>
                    {product.size && <bdi>{product.size}</bdi>}
                  </p>
                  <ExpiryBadge value={product.expiryDate} className="mt-1" />
                </td>
                <td className="px-4 py-3 max-lg:hidden">
                  <BarcodeView value={product.barcode} width={80} height={10} className="bg-white border border-zinc-200 rounded p-1 max-w-[110px] h-7" />
                  <p className="text-[11px] text-muted-foreground mt-0.5">{code(product.barcode)}</p>
                </td>
                <td className="px-4 py-3 max-sm:px-2.5 whitespace-nowrap">
                  <p className="font-semibold text-foreground">{unitPrice(product.sellingPrice, product.unit)}</p>
                  {/* Phones show the stock here instead of in its own column. */}
                  <div className="sm:hidden mt-1">{stockBadge}</div>
                  <p className="text-xs text-muted-foreground">{t('inventory.cost', { amount: money(product.costPrice) })}</p>
                  {product.taxRate > 0 && <p className="text-xs text-muted-foreground">{t('inventory.taxRate', { rate: product.taxRate })}</p>}
                  {product.sellingPrice > 0 && product.taxRate === 0 && (
                    <p className={cn('text-xs', product.sellingPrice < product.costPrice ? 'font-semibold text-loss' : 'text-muted-foreground')}>
                      {t('inventory.margin', { percent: percent(((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100) })}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 max-sm:hidden">{stockBadge}</td>
                <td className="px-4 py-3 max-sm:px-2.5">
                  <div className="flex items-center justify-end gap-1.5 max-sm:flex-col">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(product)} aria-label={t('inventory.editProduct', { name: product.name })} className="h-8 w-8">
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(product)}
                      aria-label={t('inventory.deleteProduct', { name: product.name })}
                      className="h-8 w-8 hover:text-destructive"
                    >
                      <Trash2 size={14} />
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

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Package, Search, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '@/components/ui/field'
import ConfirmDialog from '@/components/ui/confirm'
import InventoryTable from './InventoryTable'
import ProductModal from './ProductModal'
import PrintLabelsModal from './PrintLabelsModal'
import AdminVerifyModal from './AdminVerifyModal'
import { useStore, type Product } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { EXPIRY_SOON_DAYS } from '@/lib/domain'

type Pending = { type: 'add' } | { type: 'edit'; product: Product } | { type: 'delete'; product: Product }

export default function InventoryPage() {
  const [searchParams] = useSearchParams()
  const { fetchProducts, products, hasMoreProducts, totalProducts, isLoadingProducts, user, deleteProduct } = useStore()
  const i18n = useI18n()
  const { t } = i18n

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [expiringOnly, setExpiringOnly] = useState(searchParams.get('expiring') === '1')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [adminKey, setAdminKey] = useState<string | undefined>()
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [toDelete, setToDelete] = useState<{ product: Product; key?: string } | null>(null)
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    setPage(1)
    const timer = setTimeout(() => fetchProducts({ page: 1, search: searchQuery, expiring: expiringOnly }), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, expiringOnly, fetchProducts])

  // The notifications panel links here with ?expiring=1; follow it while the page is open.
  useEffect(() => {
    setExpiringOnly(searchParams.get('expiring') === '1')
    if (searchParams.has('search')) setSearchQuery(searchParams.get('search') || '')
  }, [searchParams])

  const openForm = (product: Product | null, key?: string) => {
    setEditingProduct(product)
    setAdminKey(key)
    setIsModalOpen(true)
  }

  const remove = async (product: Product, key?: string) => {
    const result = await deleteProduct(product.id, key)
    setError(result.ok ? null : result.error)
  }

  const run = (action: Pending, key?: string) => {
    if (action.type === 'add') openForm(null, key)
    else if (action.type === 'edit') openForm(action.product, key)
    else setToDelete({ product: action.product, key })
  }

  // Cashiers need the manager's password for any product change.
  const request = (action: Pending) => (isAdmin ? run(action) : setPending(action))

  const selectedProducts = useMemo(() => products.filter((p) => selectedIds.includes(p.id)), [products, selectedIds])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('inventory.title')}</h1>
            <p className="text-muted-foreground text-sm">{t('inventory.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="outline" onClick={() => setIsPrintModalOpen(true)} className="gap-1.5 h-10">
              <Printer size={16} /> {t('inventory.printLabels', { count: selectedIds.length })}
            </Button>
          )}
          <Button onClick={() => request({ type: 'add' })} className="gap-1.5 h-10">
            <Plus size={16} /> {t('inventory.addProduct')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="search"
            placeholder={t('inventory.searchPlaceholder')}
            aria-label={t('inventory.searchPlaceholder')}
            className="w-full ps-10 pe-3 h-10 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} className="h-4 w-4 accent-primary" />
          {t('inventory.expiry.filter', { days: EXPIRY_SOON_DAYS })}
        </label>
      </div>

      {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}

      <InventoryTable
        products={products}
        loading={isLoadingProducts}
        searching={Boolean(searchQuery) || expiringOnly}
        onEdit={(product) => request({ type: 'edit', product })}
        onDelete={(product) => request({ type: 'delete', product })}
        selectedIds={selectedIds}
        onSelectionToggle={(id, selected) => setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((x) => x !== id)))}
        onSelectAll={(selected) => setSelectedIds(selected ? products.map((p) => p.id) : [])}
      />

      <div className="flex flex-col items-center gap-2 py-4">
        {products.length > 0 && <p className="text-xs text-muted-foreground">{t('common.showingOf', { shown: products.length, total: totalProducts })}</p>}
        {hasMoreProducts && (
          <Button
            variant="outline"
            disabled={isLoadingProducts}
            onClick={() => {
              setPage(page + 1)
              fetchProducts({ page: page + 1, search: searchQuery, expiring: expiringOnly })
            }}
          >
            {isLoadingProducts ? t('common.loading') : t('inventory.loadMore')}
          </Button>
        )}
      </div>

      <ProductModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setAdminKey(undefined) }} product={editingProduct} adminKey={adminKey} />
      <AdminVerifyModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onVerify={(key) => {
          if (pending) run(pending, key)
          setPending(null)
        }}
      />
      {toDelete && (
        <ConfirmDialog
          title={t('inventory.deleteProduct', { name: toDelete.product.name })}
          message={t('inventory.deleteConfirm', { name: toDelete.product.name })}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={() => remove(toDelete.product, toDelete.key)}
          onClose={() => setToDelete(null)}
        />
      )}
      {isPrintModalOpen && <PrintLabelsModal isOpen onClose={() => setIsPrintModalOpen(false)} selectedProducts={selectedProducts} />}
    </div>
  )
}

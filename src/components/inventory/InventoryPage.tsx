import { useState, useEffect, useMemo } from 'react'
import { Plus, Package, Search, LayoutGrid, List as ListIcon, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import InventoryTable from './InventoryTable'
import ProductModal from './ProductModal'
import PrintLabelsModal from './PrintLabelsModal'
import { useStore, type Product } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function InventoryPage() {
  const { fetchProducts, products, hasMoreProducts, totalProducts, isLoadingProducts } = useStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  useEffect(() => {
    // Reset page and fetch on search change
    setPage(1)
    const delayDebounceFn = setTimeout(() => {
      fetchProducts({ page: 1, search: searchQuery })
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, fetchProducts])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchProducts({ page: nextPage, search: searchQuery })
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setEditingProduct(null)
    setIsModalOpen(true)
  }


  const selectedProducts = useMemo(() => 
    products.filter(p => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  )

  const handleSelectionToggle = (id: string, selected: boolean) => {
    setSelectedProductIds(prev => 
      selected ? [...prev, id] : prev.filter(item => item !== id)
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedProductIds(selected ? products.map(p => p.id) : [])
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm shadow-primary/10">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Inventory Management</h1>
            <p className="text-muted-foreground text-sm">Monitor stock levels and manage product listings.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {selectedProductIds.length > 0 && (
             <Button 
               variant="outline" 
               onClick={() => setIsPrintModalOpen(true)}
               className="gap-2 h-11 px-6 border-primary/20 hover:bg-primary/5 text-primary animate-in zoom-in-95"
             >
               <Printer size={20} />
               Print Labels ({selectedProductIds.length})
             </Button>
           )}
           <Button variant="premium" onClick={handleAddNew} className="gap-2 shadow-lg shadow-primary/20 h-11 px-6">
            <Plus size={20} />
            Add Product
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search by name, SKU, or barcode..." 
            className="pl-10 h-11 bg-card/40 border-border/60 hover:border-primary/40 focus:border-primary/60 transition-all rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-accent/30 p-1 rounded-xl border border-border/40 ml-auto">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-background shadow-sm"><ListIcon size={18} /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg opacity-40 hover:opacity-100"><LayoutGrid size={18} /></Button>
        </div>
      </div>

      <InventoryTable 
        products={products}
        onEdit={handleEdit} 
        selectedIds={selectedProductIds}
        onSelectionToggle={handleSelectionToggle}
        onSelectAll={handleSelectAll}
      />

      {hasMoreProducts && (
        <div className="flex flex-col items-center gap-4 py-8">
           <Button 
            variant="outline" 
            onClick={handleLoadMore} 
            disabled={isLoadingProducts}
            className="h-12 px-10 rounded-xl border-primary/20 hover:bg-primary/5 text-primary font-bold uppercase tracking-widest text-[10px]"
           >
              {isLoadingProducts ? 'Loading...' : 'Load Next 50 Products'}
           </Button>
           <p className="text-[10px] uppercase font-bold text-muted-foreground opacity-50 tracking-[0.2em]">
             Showing {products.length} of {totalProducts} Products
           </p>
        </div>
      )}

      <ProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        product={editingProduct} 
      />

      <PrintLabelsModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedProducts={selectedProducts}
      />
    </div>
  )
}



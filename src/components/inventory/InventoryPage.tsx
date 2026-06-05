import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Package, Search, LayoutGrid, List as ListIcon, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import InventoryTable from './InventoryTable'
import ProductModal from './ProductModal'
import PrintLabelsModal from './PrintLabelsModal'
import AdminVerifyModal from './AdminVerifyModal'
import { useStore, type Product } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function InventoryPage() {
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  
  const { fetchProducts, products, hasMoreProducts, totalProducts, isLoadingProducts, user, deleteProduct } = useStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [page, setPage] = useState(1)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [adminKey, setAdminKey] = useState<string | undefined>()
  const [pendingAction, setPendingAction] = useState<{ type: 'add' | 'edit' | 'delete', data?: any } | null>(null)

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
    if (user?.role === 'ADMIN') {
      setEditingProduct(product)
      setAdminKey(undefined)
      setIsModalOpen(true)
    } else {
      setPendingAction({ type: 'edit', data: product })
      setIsVerifyModalOpen(true)
    }
  }

  const handleAddNew = () => {
    if (user?.role === 'ADMIN') {
      setEditingProduct(null)
      setAdminKey(undefined)
      setIsModalOpen(true)
    } else {
      setPendingAction({ type: 'add' })
      setIsVerifyModalOpen(true)
    }
  }

  const handleDelete = (id: string) => {
    if (user?.role === 'ADMIN') {
      if (confirm('Are you sure you want to delete this product?')) {
        deleteProduct(id)
      }
    } else {
      setPendingAction({ type: 'delete', data: id })
      setIsVerifyModalOpen(true)
    }
  }

  const handleVerifySuccess = async (key: string) => {
    if (!pendingAction) return

    if (pendingAction.type === 'add') {
      setAdminKey(key)
      setEditingProduct(null)
      setIsModalOpen(true)
    } else if (pendingAction.type === 'edit') {
      setAdminKey(key)
      setEditingProduct(pendingAction.data)
      setIsModalOpen(true)
    } else if (pendingAction.type === 'delete') {
      if (confirm('Are you sure you want to delete this product?')) {
        const success = await deleteProduct(pendingAction.data, key)
        if (!success) {
          alert('Verification failed or unauthorized action.')
        }
      }
    }
    
    setIsVerifyModalOpen(false)
    setPendingAction(null)
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
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center text-foreground border border-border">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Inventory</h1>
            <p className="text-muted-foreground text-xs font-medium">Monitor stock levels and manage product listings.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {selectedProductIds.length > 0 && (
             <Button 
               variant="outline" 
               onClick={() => setIsPrintModalOpen(true)}
               className="gap-1.5 h-10 px-4 border-border hover:bg-accent text-foreground text-xs font-semibold rounded-md"
             >
               <Printer size={16} />
               Print Labels ({selectedProductIds.length})
             </Button>
           )}
           <Button onClick={handleAddNew} className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90 h-10 px-4 text-xs font-semibold rounded-md shadow-none cursor-pointer">
            <Plus size={16} />
            Add Product
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search by name, SKU, or barcode..." 
            className="pl-10 h-10 bg-card border-border hover:border-primary/40 focus:border-primary/60 transition-all rounded-md text-sm font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded border border-border ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded bg-card border border-border shadow-sm text-foreground"><ListIcon size={16} /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded opacity-40 hover:opacity-100"><LayoutGrid size={16} /></Button>
        </div>
      </div>

      <InventoryTable 
        products={products}
        onEdit={handleEdit} 
        onDelete={handleDelete}
        selectedIds={selectedProductIds}
        onSelectionToggle={handleSelectionToggle}
        onSelectAll={handleSelectAll}
      />

      {hasMoreProducts && (
        <div className="flex flex-col items-center gap-2 py-6">
           <Button 
            variant="outline" 
            onClick={handleLoadMore} 
            disabled={isLoadingProducts}
            className="h-10 px-6 rounded-md border-border hover:bg-accent text-foreground font-semibold text-xs transition-all active:scale-[0.99]"
           >
              {isLoadingProducts ? 'Loading...' : 'Load Next 50 Products'}
           </Button>
           <p className="text-[9px] uppercase font-bold text-muted-foreground opacity-55 tracking-wider">
             Showing {products.length} of {totalProducts} Products
           </p>
        </div>
      )}

      <ProductModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false)
          setAdminKey(undefined)
        }} 
        product={editingProduct}
        adminKey={adminKey}
      />

      <AdminVerifyModal 
        isOpen={isVerifyModalOpen}
        onClose={() => {
          setIsVerifyModalOpen(false)
          setPendingAction(null)
        }}
        onVerify={handleVerifySuccess}
      />

      <PrintLabelsModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedProducts={selectedProducts}
      />
    </div>
  )
}



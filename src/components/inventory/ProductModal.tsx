import { useState, useEffect } from 'react'
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStore, type Product } from '@/store/useStore'
import { X, Save, RefreshCw } from 'lucide-react'

interface ProductModalProps {
  product?: Product | null
  isOpen: boolean
  onClose: () => void
  adminKey?: string
}

export default function ProductModal({ product, isOpen, onClose, adminKey }: ProductModalProps) {
  const { addProduct, updateProduct } = useStore()
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    size: '',
    color: '',
    costPrice: 0,
    sellingPrice: 0,
    gst: 18,
    stock: 0,
    supplier: '',
  })

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        size: product.size || '',
        color: product.color || '',
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        gst: product.gst,
        stock: product.stock,
        supplier: product.supplier || '',
      })
    } else {
      // Generate initial SKU/Barcode if empty
      const timestamp = Date.now().toString().slice(-6)
      setFormData(prev => ({
        ...prev,
        sku: `SKU-${timestamp}`,
        barcode: `BR-${timestamp}`,
      }))
    }
  }, [product])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (product) {
      await updateProduct(product.id, formData, adminKey)
    } else {
      await addProduct(formData, adminKey)
    }
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }))
  }

  const generateCodes = () => {
    const timestamp = Date.now().toString().slice(-6)
    setFormData(prev => ({
      ...prev,
      sku: `SKU-${timestamp}`,
      barcode: `BR-${timestamp}`,
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
      <Card className="w-full sm:max-w-2xl border border-border bg-card shadow-lg rounded-t-2xl sm:rounded-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden pb-safe">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4 shrink-0">
            <CardTitle className="text-lg font-semibold">{product ? 'Edit Product' : 'Add New Product'}</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} type="button" className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </Button>
          </CardHeader>

          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 overflow-y-auto custom-scrollbar min-h-0">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Product Name</label>
              <Input name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Silk Shirt" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">SKU</label>
                {!product && (
                  <button type="button" onClick={generateCodes} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RefreshCw size={10} /> Regen
                  </button>
                )}
              </div>
              <Input name="sku" value={formData.sku} onChange={handleChange} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Barcode</label>
              <Input name="barcode" value={formData.barcode} onChange={handleChange} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Input name="category" value={formData.category} onChange={handleChange} required placeholder="e.g. Apparel" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Stock Level</label>
              <Input name="stock" type="number" value={formData.stock} onChange={handleChange} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cost Price</label>
              <Input name="costPrice" type="number" step="0.01" value={formData.costPrice} onChange={handleChange} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Selling Price</label>
              <Input name="sellingPrice" type="number" step="0.01" value={formData.sellingPrice} onChange={handleChange} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">GST (%)</label>
              <Input name="gst" type="number" value={formData.gst} onChange={handleChange} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Supplier</label>
              <Input name="supplier" value={formData.supplier || ''} onChange={handleChange} className="h-11 text-sm" />
            </div>
          </CardContent>

          <CardFooter className="flex gap-2 border-t border-border/40 pt-4 pb-4 px-4 shrink-0">
            <Button variant="outline" type="button" onClick={onClose} className="flex-1 h-11 text-sm rounded-xl">Cancel</Button>
            <Button variant="default" type="submit" className="flex-1 gap-2 h-11 text-sm rounded-xl">
              <Save size={15} />
              {product ? 'Update' : 'Save Product'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

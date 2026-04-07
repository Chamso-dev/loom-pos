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
}

export default function ProductModal({ product, isOpen, onClose }: ProductModalProps) {
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
      await updateProduct(product.id, formData)
    } else {
      await addProduct(formData)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{product ? 'Edit Product' : 'Add New Product'}</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} type="button">
              <X size={20} />
            </Button>
          </CardHeader>
          
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-sm font-medium">Product Name</label>
              <Input name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Silk Shirt" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">SKU</label>
                {!product && (
                  <button type="button" onClick={generateCodes} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    <RefreshCw size={10} /> Regen
                  </button>
                )}
              </div>
              <Input name="sku" value={formData.sku} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Barcode</label>
              <Input name="barcode" value={formData.barcode} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Input name="category" value={formData.category} onChange={handleChange} required placeholder="e.g. Apparel" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Stock Level</label>
              <Input name="stock" type="number" value={formData.stock} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cost Price</label>
              <Input name="costPrice" type="number" step="0.01" value={formData.costPrice} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Selling Price</label>
              <Input name="sellingPrice" type="number" step="0.01" value={formData.sellingPrice} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">GST (%)</label>
              <Input name="gst" type="number" value={formData.gst} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Supplier</label>
              <Input name="supplier" value={formData.supplier || ''} onChange={handleChange} />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-3 pt-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="premium" type="submit" className="gap-2">
              <Save size={18} />
              {product ? 'Update' : 'Save Product'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

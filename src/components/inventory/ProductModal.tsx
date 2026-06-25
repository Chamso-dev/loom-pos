import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStore, type Product } from '@/store/useStore'
import { X, Save, RefreshCw, Package, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductModalProps {
  product?: Product | null
  isOpen: boolean
  onClose: () => void
  adminKey?: string
}

type FormState = {
  name: string
  sku: string
  barcode: string
  category: string
  productType: 'UNIT' | 'WEIGHTED'
  costPrice: number
  sellingPrice: number
  gst: number
  stock: number
  minSellWeight: number
  supplier: string
  expiryDate: string
}

const blank = (): FormState => {
  const ts = Date.now().toString().slice(-6)
  return {
    name: '', sku: `SKU-${ts}`, barcode: `BR-${ts}`, category: '',
    productType: 'UNIT', costPrice: 0, sellingPrice: 0, gst: 0,
    stock: 0, minSellWeight: 0.25, supplier: '', expiryDate: '',
  }
}

export default function ProductModal({ product, isOpen, onClose, adminKey }: ProductModalProps) {
  const { addProduct, updateProduct } = useStore()
  const [form, setForm] = useState<FormState>(blank())

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        productType: product.productType === 'WEIGHTED' ? 'WEIGHTED' : 'UNIT',
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        gst: product.gst,
        stock: product.stock,
        minSellWeight: product.minSellWeight ?? 0.25,
        supplier: product.supplier || '',
        expiryDate: product.expiryDate ? String(product.expiryDate).slice(0, 10) : '',
      })
    } else {
      setForm(blank())
    }
  }, [product, isOpen])

  if (!isOpen) return null

  const weighted = form.productType === 'WEIGHTED'

  const set = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }))
  const num = (v: string) => (v === '' ? 0 : parseFloat(v))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ts = Date.now().toString().slice(-6)
    const payload: any = {
      name: form.name,
      sku: form.sku || `SKU-${ts}`,
      barcode: form.barcode || `BR-${ts}`, // barcode optional for weighted; keep DB unique
      category: form.category,
      productType: form.productType,
      costPrice: form.costPrice,
      sellingPrice: form.sellingPrice,
      gst: form.gst,
      stock: form.stock,
      minSellWeight: weighted ? form.minSellWeight : null,
      supplier: form.supplier || null,
      expiryDate: form.expiryDate || null,
    }
    if (product) await updateProduct(product.id, payload, adminKey)
    else await addProduct(payload, adminKey)
    onClose()
  }

  const regen = () => {
    const ts = Date.now().toString().slice(-6)
    setForm((p) => ({ ...p, sku: `SKU-${ts}`, barcode: `BR-${ts}` }))
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="text-xs font-medium text-muted-foreground">{children}</label>
  )

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
            {/* Product type picker */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Product Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { t: 'UNIT', icon: Package, title: 'Unit', sub: 'Sold per piece' },
                  { t: 'WEIGHTED', icon: Scale, title: 'Weighted', sub: 'Sold by weight (kg)' },
                ] as const).map(({ t, icon: Icon, title, sub }) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('productType', t)}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all active:scale-[0.98]',
                      form.productType === t ? 'bg-primary/10 border-primary/40 text-foreground' : 'bg-card border-border text-muted-foreground',
                    )}
                  >
                    <Icon size={18} className={form.productType === t ? 'text-primary' : ''} />
                    <div>
                      <p className="text-xs font-bold">{title}</p>
                      <p className="text-[10px] opacity-70">{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Product Name</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Tomatoes" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => set('category', e.target.value)} required placeholder="e.g. Produce" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{weighted ? 'Barcode (optional)' : 'Barcode'}</Label>
                <button type="button" onClick={regen} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RefreshCw size={10} /> Regen
                </button>
              </div>
              <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} required={!weighted} className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>{weighted ? 'Purchase Price / KG' : 'Purchase Price'}</Label>
              <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => set('costPrice', num(e.target.value))} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>{weighted ? 'Selling Price / KG' : 'Selling Price'}</Label>
              <Input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => set('sellingPrice', num(e.target.value))} required className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>{weighted ? 'Current Stock (KG)' : 'Current Stock (units)'}</Label>
              <Input type="number" step={weighted ? '0.001' : '1'} value={form.stock} onChange={(e) => set('stock', num(e.target.value))} required className="h-11 text-sm" />
            </div>

            {weighted && (
              <div className="space-y-1.5">
                <Label>Minimum Sell Weight (KG)</Label>
                <Input type="number" step="0.001" value={form.minSellWeight} onChange={(e) => set('minSellWeight', num(e.target.value))} required className="h-11 text-sm" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>GST (%)</Label>
              <Input type="number" value={form.gst} onChange={(e) => set('gst', num(e.target.value))} className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="Optional" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} className="h-11 text-sm" />
            </div>

            {!product && (
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} required className="h-11 text-sm" />
              </div>
            )}
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

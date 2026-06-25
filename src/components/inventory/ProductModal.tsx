import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberField, toNum } from '@/components/ui/number-field'
import { useStore, type Product } from '@/store/useStore'
import { X, Save, RefreshCw, Package, Scale, Camera, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isCameraScanSupported, scanBarcode } from '@/native/scanner'

interface ProductModalProps {
  product?: Product | null
  isOpen: boolean
  onClose: () => void
  adminKey?: string
}

type FormState = {
  name: string
  category: string
  barcode: string
  productType: 'UNIT' | 'WEIGHTED'
  costPrice: string
  sellingPrice: string
  stock: string
  minSellWeight: string
  gst: string
  supplier: string
  expiryDate: string
  taxOverride: boolean
}

export default function ProductModal({ product, isOpen, onClose, adminKey }: ProductModalProps) {
  const { addProduct, updateProduct, settings, suppliers, fetchSuppliers } = useStore()
  const taxEnabled = settings?.taxEnabled !== false
  const defaultRate = settings?.defaultTaxRate ?? 19

  const blank = (): FormState => ({
    name: '', category: '', barcode: '', productType: 'UNIT',
    costPrice: '', sellingPrice: '', stock: '', minSellWeight: '0.25',
    gst: String(defaultRate), supplier: '', expiryDate: '', taxOverride: false,
  })

  const [form, setForm] = useState<FormState>(blank())
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        category: product.category,
        barcode: product.barcode || '',
        productType: product.productType === 'WEIGHTED' ? 'WEIGHTED' : 'UNIT',
        costPrice: String(product.costPrice ?? ''),
        sellingPrice: String(product.sellingPrice ?? ''),
        stock: String(product.stock ?? ''),
        minSellWeight: String(product.minSellWeight ?? 0.25),
        gst: String(product.gst ?? defaultRate),
        supplier: product.supplier || '',
        expiryDate: product.expiryDate ? String(product.expiryDate).slice(0, 10) : '',
        taxOverride: taxEnabled && product.gst != null && product.gst !== defaultRate,
      })
    } else {
      setForm(blank())
    }
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, isOpen])

  const weighted = form.productType === 'WEIGHTED'
  const set = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }))

  const filteredSuppliers = useMemo(() => {
    const q = form.supplier.toLowerCase()
    return suppliers.filter((s) => s.name.toLowerCase().includes(q))
  }, [suppliers, form.supplier])

  if (!isOpen) return null

  const scan = async () => {
    if (scanning) return
    setScanning(true)
    try {
      const res = await scanBarcode()
      if (res.ok && res.value) set('barcode', res.value)
    } finally {
      setScanning(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Product name is required')
    if (!form.category.trim()) return setError('Category is required')
    if (toNum(form.sellingPrice) <= 0) return setError('Enter a selling price')

    const ts = Date.now().toString().slice(-6)
    const gst = !taxEnabled ? 0 : form.taxOverride ? toNum(form.gst) : defaultRate
    const payload: any = {
      name: form.name.trim(),
      sku: product?.sku || `SKU-${ts}`,
      barcode: form.barcode.trim() || `BR-${ts}`,
      category: form.category.trim(),
      productType: form.productType,
      costPrice: toNum(form.costPrice),
      sellingPrice: toNum(form.sellingPrice),
      gst,
      stock: toNum(form.stock),
      minSellWeight: weighted ? toNum(form.minSellWeight) || 0.25 : null,
      supplier: form.supplier.trim() || null,
      expiryDate: form.expiryDate || null,
    }
    if (product) await updateProduct(product.id, payload, adminKey)
    else await addProduct(payload, adminKey)
    onClose()
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
            {error && (
              <div className="sm:col-span-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs font-semibold text-destructive">{error}</div>
            )}

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
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Tomatoes" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Produce" className="h-11 text-sm" />
            </div>

            {/* Barcode with camera scan */}
            <div className="space-y-1.5">
              <Label>{weighted ? 'Barcode (optional)' : 'Barcode (optional)'}</Label>
              <div className="flex gap-2">
                <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Scan or enter" className="h-11 text-sm flex-1" />
                {isCameraScanSupported() ? (
                  <button type="button" onClick={scan} disabled={scanning} aria-label="Scan barcode" className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60">
                    <Camera size={17} className={scanning ? 'animate-pulse' : ''} />
                  </button>
                ) : (
                  <button type="button" onClick={() => { const ts = Date.now().toString().slice(-6); set('barcode', `BR-${ts}`) }} aria-label="Generate barcode" className="h-11 w-11 shrink-0 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground/80 active:scale-95 transition-transform">
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{weighted ? 'Cost Price / KG' : 'Cost Price'}</Label>
              <NumberField value={form.costPrice} onValueChange={(v) => set('costPrice', v)} placeholder="0.00" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>{weighted ? 'Selling Price / KG' : 'Selling Price'}</Label>
              <NumberField value={form.sellingPrice} onValueChange={(v) => set('sellingPrice', v)} placeholder="0.00" className="h-11 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>{weighted ? 'Current Stock (KG)' : 'Current Stock (units)'}</Label>
              <NumberField value={form.stock} onValueChange={(v) => set('stock', v)} decimal={weighted} placeholder="0" className="h-11 text-sm" />
            </div>

            {weighted && (
              <div className="space-y-1.5">
                <Label>Minimum Sell Weight (KG)</Label>
                <NumberField value={form.minSellWeight} onValueChange={(v) => set('minSellWeight', v)} placeholder="0.25" className="h-11 text-sm" />
              </div>
            )}

            {/* Supplier searchable dropdown */}
            <div className="space-y-1.5 relative">
              <Label>Supplier (optional)</Label>
              <div className="relative">
                <Truck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={form.supplier}
                  onChange={(e) => { set('supplier', e.target.value); setSupplierOpen(true) }}
                  onFocus={() => setSupplierOpen(true)}
                  onBlur={() => setTimeout(() => setSupplierOpen(false), 150)}
                  placeholder="Search or add supplier"
                  className="h-11 text-sm pl-9"
                />
              </div>
              {supplierOpen && filteredSuppliers.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-44 overflow-y-auto custom-scrollbar">
                  {filteredSuppliers.map((s) => (
                    <button key={s.id} type="button" onMouseDown={() => { set('supplier', s.name); setSupplierOpen(false) }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent active:bg-accent flex items-center gap-2">
                      <Truck size={13} className="text-muted-foreground" /> {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} className="h-11 text-sm" />
            </div>

            {/* Tax override (only when TVA enabled globally) */}
            {taxEnabled && (
              <div className="sm:col-span-2 rounded-xl border border-border p-3 space-y-2.5">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Override TVA for this product</p>
                    <p className="text-[10px] text-muted-foreground">Otherwise the store default ({defaultRate}%) is used.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.taxOverride}
                    onClick={() => set('taxOverride', !form.taxOverride)}
                    className={cn('relative h-6 w-11 rounded-full transition-colors shrink-0', form.taxOverride ? 'bg-primary' : 'bg-secondary border border-border')}
                  >
                    <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', form.taxOverride ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                  </button>
                </label>
                {form.taxOverride && (
                  <div className="space-y-1.5">
                    <Label>TVA (%)</Label>
                    <NumberField value={form.gst} onValueChange={(v) => set('gst', v)} placeholder={String(defaultRate)} className="h-11 text-sm" />
                  </div>
                )}
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

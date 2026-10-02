import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput, ErrorNote, Field, SelectInput, TextInput } from '@/components/ui/field'
import { useStore, type Product, type ProductInput } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { formatNumber, includedTax, parseDecimal, roundMoney, TAX_RATES, UNIT_CODES, unitRule, type UnitCode } from '@/lib/domain'
import { cn, signTone } from '@/lib/utils'

interface ProductModalProps {
  product?: Product | null
  isOpen: boolean
  onClose: () => void
  adminKey?: string
}

const newCodes = () => {
  const stamp = Date.now().toString().slice(-6)
  return { sku: `SKU-${stamp}`, barcode: `200${stamp}` }
}

type Form = { name: string; sku: string; barcode: string; category: string; unit: UnitCode; size: string; color: string; supplier: string; cost: string; price: string; stock: string; taxRate: number }

const fromProduct = (p?: Product | null): Form =>
  p
    ? {
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        category: p.category,
        unit: (UNIT_CODES as readonly string[]).includes(p.unit) ? (p.unit as UnitCode) : 'piece',
        size: p.size ?? '',
        color: p.color ?? '',
        supplier: p.supplier ?? '',
        cost: formatNumber(p.costPrice, 2),
        price: formatNumber(p.sellingPrice, 2),
        stock: formatNumber(p.stock, 3),
        taxRate: p.taxRate,
      }
    : { name: '', ...newCodes(), category: '', unit: 'piece', size: '', color: '', supplier: '', cost: '', price: '', stock: '0', taxRate: 0 }

export default function ProductModal({ product, isOpen, onClose, adminKey }: ProductModalProps) {
  const { addProduct, updateProduct } = useStore()
  const i18n = useI18n()
  const { t, money, percent, unitName } = i18n
  const [form, setForm] = useState<Form>(fromProduct(product))
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm(fromProduct(product))
      setError(null)
    }
  }, [product, isOpen])

  if (!isOpen) return null

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const cost = parseDecimal(form.cost)
  const price = parseDecimal(form.price)
  const stock = parseDecimal(form.stock)
  const unitShort = t(`units.short.${form.unit}`)
  // Profit leaves out the TVA inside the price, which is owed to the state.
  const netPrice = Number.isFinite(price) ? roundMoney(price - includedTax(price, form.taxRate)) : NaN
  const margin = Number.isFinite(cost) && Number.isFinite(price) && price > 0 ? roundMoney(netPrice - cost) : null
  const stockValid = Number.isFinite(stock) && stock >= 0 && (unitRule(form.unit).decimals > 0 || Number.isInteger(stock))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number.isFinite(cost) || !Number.isFinite(price) || price <= 0 || !stockValid) {
      setError({ code: 'VALIDATION' })
      return
    }
    const data: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      category: form.category.trim(),
      unit: form.unit,
      size: form.size.trim() || null,
      color: form.color.trim() || null,
      supplier: form.supplier.trim() || null,
      costPrice: cost,
      sellingPrice: price,
      taxRate: form.taxRate,
      stock,
    }
    setSaving(true)
    const result = product ? await updateProduct(product.id, data, adminKey) : await addProduct(data, adminKey)
    setSaving(false)
    if (result.ok) onClose()
    else setError(result.error)
  }

  const rates: number[] = TAX_RATES.includes(form.taxRate as 0) ? [...TAX_RATES] : [...TAX_RATES, form.taxRate]

  return (
    <Modal
      title={product ? t('inventory.formEditTitle') : t('inventory.formAddTitle')}
      onClose={onClose}
      locked={saving}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="product-form" disabled={saving}>
            {saving ? t('common.saving') : product ? t('inventory.updateProduct') : t('inventory.saveProduct')}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('inventory.name')} className="md:col-span-2">
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder={t('inventory.namePlaceholder')} />
        </Field>

        <Field
          label={
            <span className="flex items-center justify-between">
              {t('inventory.sku')}
              {!product && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, ...newCodes() }))} className="text-xs text-link flex items-center gap-1">
                  <RefreshCw size={11} /> {t('inventory.regenerate')}
                </button>
              )}
            </span>
          }
        >
          <TextInput value={form.sku} onChange={(e) => set('sku', e.target.value)} required dir="ltr" className="text-start" />
        </Field>
        <Field label={t('inventory.barcode')}>
          <TextInput value={form.barcode} onChange={(e) => set('barcode', e.target.value)} required dir="ltr" className="text-start" inputMode="numeric" />
        </Field>

        <Field label={t('inventory.category')}>
          <TextInput value={form.category} onChange={(e) => set('category', e.target.value)} required placeholder={t('inventory.categoryPlaceholder')} />
        </Field>
        <Field label={t('inventory.unit')}>
          <SelectInput value={form.unit} onChange={(e) => set('unit', e.target.value as UnitCode)}>
            {UNIT_CODES.map((u) => (
              <option key={u} value={u}>
                {unitName(u)}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label={t('inventory.costPrice')} hint={t('inventory.costHint', { unit: unitShort })}>
          <DecimalInput value={form.cost} onChange={(e) => set('cost', e.target.value)} required placeholder="0" />
        </Field>
        <Field
          label={t('inventory.sellingPrice')}
          hint={t('inventory.sellingHint', { unit: unitShort })}
          error={Number.isFinite(cost) && Number.isFinite(price) && price > 0 && price < cost ? t('inventory.priceBelowCost') : undefined}
        >
          <DecimalInput value={form.price} onChange={(e) => set('price', e.target.value)} required placeholder="0" />
        </Field>

        <Field label={t('inventory.taxRateLabel')} hint={t('inventory.taxRateHint')}>
          <div className="flex gap-2" role="radiogroup" aria-label={t('inventory.taxRateLabel')}>
            {rates.map((rate) => (
              <button
                key={rate}
                type="button"
                role="radio"
                aria-checked={form.taxRate === rate}
                onClick={() => set('taxRate', rate)}
                className={`flex-1 h-10 rounded-md border text-sm font-semibold ${form.taxRate === rate ? 'border-primary bg-primary/10 text-link' : 'border-border hover:bg-accent'}`}
              >
                {TAX_RATES.includes(rate as 0) ? percent(rate) : t('inventory.taxOther', { rate })}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`${t('inventory.stockLevel')} (${unitShort})`} error={!stockValid ? t('inventory.invalidNumber') : undefined}>
          <DecimalInput value={form.stock} onChange={(e) => set('stock', e.target.value)} required />
        </Field>

        <Field label={`${t('inventory.size')} (${t('common.optional')})`}>
          <TextInput value={form.size} onChange={(e) => set('size', e.target.value)} placeholder={t('inventory.sizePlaceholder')} />
        </Field>
        <Field label={`${t('inventory.color')} (${t('common.optional')})`}>
          <TextInput value={form.color} onChange={(e) => set('color', e.target.value)} placeholder={t('inventory.colorPlaceholder')} />
        </Field>
        <Field label={`${t('inventory.supplier')} (${t('common.optional')})`} className="md:col-span-2">
          <TextInput value={form.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder={t('inventory.supplierPlaceholder')} />
        </Field>

        {margin !== null && (
          <p className={cn('md:col-span-2 text-sm', signTone(margin) ?? 'text-muted-foreground')}>
            {t('inventory.marginPreview', { unit: unitShort, amount: money(margin), percent: netPrice > 0 ? percent((margin / netPrice) * 100) : '' })}
          </p>
        )}
        {error != null && (
          <div className="md:col-span-2">
            <ErrorNote>{i18n.error(error)}</ErrorNote>
          </div>
        )}
      </form>
    </Modal>
  )
}

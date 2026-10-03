import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackagePlus, Plus, Search, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput, ErrorNote, Field, SelectInput, TextInput, LoadError } from '@/components/ui/field'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { formatNumber, isUnitCode, parseDecimal, roundMoney, SETTLING_METHOD_CODES, sumMoney } from '@/lib/domain'
import { useRequestId } from '@/hooks/useRequestId'
import { useStore, type Product } from '@/store/useStore'

interface Line {
  product: Product
  qty: string
  cost: string
}

function PurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: (p: any) => void }) {
  const i18n = useI18n()
  const { t, money, method, unitPrice } = i18n
  const fetchLowStockAlerts = useStore((s) => s.fetchLowStockAlerts)
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [paid, setPaid] = useState('')
  const [paidTouched, setPaidTouched] = useState(false)
  const [payMethod, setPayMethod] = useState('CASH')
  const [updateCost, setUpdateCost] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<{ suppliers: Array<{ id: string; name: string }> }>('/suppliers').then((d) => setSuppliers(d.suppliers)).catch(setError)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) return setResults([])
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api<{ products: Product[] }>('/products', { query: { search: query, limit: 8 }, signal: controller.signal })
        .then((d) => setResults(d.products))
        .catch(() => {})
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const total = useMemo(() => sumMoney(lines.map((l) => (parseDecimal(l.qty) || 0) * (parseDecimal(l.cost) || 0))), [lines])
  const paidValue = paidTouched ? parseDecimal(paid) || 0 : total
  const owed = roundMoney(Math.max(0, total - paidValue))

  const add = (product: Product) => {
    if (!lines.some((l) => l.product.id === product.id)) {
      setLines((ls) => [...ls, { product, qty: '1', cost: formatNumber(product.costPrice, 2) }])
    }
    setQuery('')
    setResults([])
  }

  const purchaseBody = {
    supplierId: supplierId || null,
    reference: reference || null,
    items: lines.map((l) => ({ productId: l.product.id, quantity: parseDecimal(l.qty), unitCost: parseDecimal(l.cost) })),
    amountPaid: paidValue,
    paymentMethod: payMethod,
    updateCostPrice: updateCost,
  }
  const requestId = useRequestId('purchase', purchaseBody)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const purchase = await api<any>('/purchases', {
        method: 'POST',
        body: { ...purchaseBody, requestId },
      })
      fetchLowStockAlerts()
      onSaved(purchase)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const valid = lines.length > 0 && lines.every((l) => parseDecimal(l.qty) > 0 && parseDecimal(l.cost) >= 0)

  return (
    <Modal
      title={t('purchases.formTitle')}
      onClose={onClose}
      locked={saving}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!valid || saving} onClick={submit}>{saving ? t('common.saving') : t('purchases.save')}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('purchases.supplier')}>
            <SelectInput value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{t('purchases.noSupplier')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          </Field>
          <Field label={`${t('purchases.reference')} (${t('common.optional')})`}>
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" className="text-start" />
          </Field>
        </div>

        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('purchases.productSearch')} aria-label={t('purchases.productSearch')} className="ps-9" />
          {results.length > 0 && (
            <ul className="absolute z-10 top-11 inset-x-0 rounded-md border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => add(p)} className="w-full flex justify-between gap-3 px-3 py-2 text-start hover:bg-accent text-sm">
                    <span className="truncate"><bdi>{p.name}</bdi></span>
                    <span className="text-muted-foreground shrink-0">{i18n.qty(p.stock, p.unit, true)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed border-border rounded-lg">{t('purchases.noItems')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 text-start font-semibold">{t('purchases.items')}</th>
                <th className="py-2 text-start font-semibold">{t('purchases.quantity')}</th>
                <th className="py-2 text-start font-semibold">{t('purchases.unitCost')}</th>
                <th className="py-2 text-end font-semibold">{t('purchases.lineTotal')}</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l, idx) => {
                const lineTotal = roundMoney((parseDecimal(l.qty) || 0) * (parseDecimal(l.cost) || 0))
                const update = (patch: Partial<Line>) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
                return (
                  <tr key={l.product.id}>
                    <td className="py-2 pe-2">
                      <p className="font-medium"><bdi>{l.product.name}</bdi></p>
                      <p className="text-xs text-muted-foreground">{unitPrice(l.product.sellingPrice, l.product.unit)}</p>
                    </td>
                    <td className="py-2 pe-2">
                      <div className="flex items-center gap-1.5">
                        <DecimalInput value={l.qty} onChange={(e) => update({ qty: e.target.value })} className="w-24 h-9" aria-label={t('purchases.quantity')} />
                        <span className="text-xs text-muted-foreground">{t(`units.short.${isUnitCode(l.product.unit) ? l.product.unit : 'piece'}`)}</span>
                      </div>
                    </td>
                    <td className="py-2 pe-2">
                      <DecimalInput value={l.cost} onChange={(e) => update({ cost: e.target.value })} className="w-28 h-9" aria-label={t('purchases.unitCost')} />
                    </td>
                    <td className="py-2 text-end tabular-nums font-semibold">{money(lineTotal)}</td>
                    <td className="py-2 ps-2">
                      <button type="button" aria-label={t('purchases.removeItem')} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} className="p-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <div className="flex items-baseline justify-between rounded-lg bg-secondary/60 px-4 py-3">
          <span className="font-semibold">{t('purchases.total')}</span>
          <span className="font-display text-2xl font-bold tabular-nums">{money(total)}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('purchases.amountPaid')}>
            <div className="flex gap-2">
              <DecimalInput
                aria-label={t('purchases.amountPaid')}
                value={paidTouched ? paid : formatNumber(total, 2)}
                onChange={(e) => {
                  setPaidTouched(true)
                  setPaid(e.target.value)
                }}
              />
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={() => { setPaidTouched(true); setPaid('0') }}>{t('purchases.payNothing')}</Button>
            </div>
          </Field>
          <Field label={t('purchases.paidBy')}>
            <SelectInput value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {SETTLING_METHOD_CODES.map((m) => <option key={m} value={m}>{method(m)}</option>)}
            </SelectInput>
          </Field>
        </div>
        {owed > 0 && <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{t('purchases.leftOwed', { amount: money(owed) })}</p>}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} className="h-4 w-4 accent-primary" />
          {t('purchases.updateCost')}
        </label>
        {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
      </div>
    </Modal>
  )
}

export default function PurchasesPage() {
  const i18n = useI18n()
  const { t, money } = i18n
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api<{ purchases: any[] }>('/purchases')
      setPurchases(data.purchases)
    } catch (error) {
      setLoadError(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border"><PackagePlus size={20} /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('purchases.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('purchases.subtitle')}</p>
          </div>
        </div>
        <Button className="gap-1.5" onClick={() => setCreating(true)}><Plus size={16} /> {t('purchases.newPurchase')}</Button>
      </div>
      {notice && <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">{notice}</p>}
      {loadError != null && <LoadError message={i18n.error(loadError)} retryLabel={t('common.retry')} onRetry={load} />}
      <div className="relative bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('purchases.number')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-sm:hidden">{t('purchases.date')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('purchases.supplier')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold max-lg:hidden">{t('purchases.reference')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-end font-semibold">{t('purchases.total')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-end font-semibold max-md:hidden">{t('purchases.paid')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-end font-semibold">{t('purchases.due')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {!loading && loadError == null && purchases.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('purchases.none')}</td></tr>}
            {purchases.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 max-sm:px-2.5 font-semibold whitespace-nowrap">
                  {i18n.code(p.purchaseNo)}
                  <span className="sm:hidden block text-xs font-normal text-muted-foreground">{i18n.date(p.date, 'medium')}</span>
                </td>
                <td className="px-4 py-3 max-sm:px-2.5 whitespace-nowrap max-sm:hidden">{i18n.date(p.date, 'medium')}</td>
                <td className="px-4 py-3">{p.supplier?.name ?? <span className="text-muted-foreground">{t('purchases.noSupplier')}</span>}</td>
                <td className="px-4 py-3 max-sm:px-2.5 text-muted-foreground max-lg:hidden">{p.reference ? i18n.code(p.reference) : '–'}</td>
                <td className="px-4 py-3 max-sm:px-2.5 text-end tabular-nums font-semibold whitespace-nowrap">{money(p.totalAmount)}</td>
                <td className="px-4 py-3 max-sm:px-2.5 text-end tabular-nums whitespace-nowrap max-md:hidden">{money(p.amountPaid)}</td>
                <td className={`px-4 py-3 max-sm:px-2.5 text-end tabular-nums whitespace-nowrap ${p.balanceDue > 0 ? 'font-semibold text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>{money(p.balanceDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && (
        <PurchaseForm
          onClose={() => setCreating(false)}
          onSaved={(p) => {
            setCreating(false)
            setNotice(t('purchases.saved', { number: i18n.code(p.purchaseNo) }))
            load()
          }}
        />
      )}
    </div>
  )
}

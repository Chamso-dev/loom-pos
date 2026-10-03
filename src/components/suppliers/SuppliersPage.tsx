import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Truck } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput, ErrorNote, Field, SelectInput, TextArea, TextInput } from '@/components/ui/field'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useRequestId } from '@/hooks/useRequestId'
import { formatNumber, parseDecimal, SETTLING_METHOD_CODES } from '@/lib/domain'

interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  balance: number
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = { name, phone: phone || null, address: address || null, notes: notes || null }
      await api(supplier ? `/suppliers/${supplier.id}` : '/suppliers', { method: supplier ? 'PUT' : 'POST', body })
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={supplier ? t('suppliers.formEdit') : t('suppliers.formAdd')}
      onClose={onClose}
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="supplier-form" disabled={saving || !name.trim()}>{saving ? t('common.saving') : t('common.save')}</Button>
        </div>
      }
    >
      <form id="supplier-form" onSubmit={submit} className="grid gap-4">
        <Field label={t('suppliers.name')}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={`${t('common.phone')} (${t('common.optional')})`}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('common.phonePlaceholder')} dir="ltr" inputMode="tel" className="text-start" />
        </Field>
        <Field label={`${t('common.address')} (${t('common.optional')})`}>
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={`${t('common.notes')} (${t('common.optional')})`}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
      </form>
    </Modal>
  )
}

function SupplierAccount({ id, onClose, onChanged, onEdit }: { id: string; onClose: () => void; onChanged: () => void; onEdit: (s: Supplier) => void }) {
  const i18n = useI18n()
  const { t, money, method } = i18n
  const [data, setData] = useState<{ supplier: Supplier; purchases: any[]; payments: any[] } | null>(null)
  const [amount, setAmount] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => api<any>(`/suppliers/${id}`).then(setData).catch(setError), [id])
  const [paymentsSaved, setPaymentsSaved] = useState(0)
  const requestId = useRequestId('supplier-pay', [id, payMethod, amount, reference], paymentsSaved)
  useEffect(() => {
    load()
  }, [load])

  if (!data) return <Modal title={t('common.loading')} onClose={onClose}>{error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}</Modal>
  const { supplier } = data

  const pay = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseDecimal(amount)
    if (!(value > 0)) return setError({ code: 'INVALID_AMOUNT' })
    setSaving(true)
    setError(null)
    try {
      const result = await api<{ supplier: Supplier }>(`/suppliers/${id}/payments`, { method: 'POST', body: { method: payMethod, amount: value, reference: reference || null, requestId } })
      setPaymentsSaved((n) => n + 1)
      setNotice(t('suppliers.paymentSaved', { amount: money(value), balance: money(result.supplier.balance) }))
      setAmount('')
      setReference('')
      await load()
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={supplier.name} subtitle={supplier.phone ? i18n.phone(supplier.phone) : t('common.noContact')} onClose={onClose} size="lg">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('suppliers.currentBalance')}</p>
            <p className="font-display text-4xl font-bold tabular-nums">{money(supplier.balance)}</p>
          </div>
          <Button variant="outline" onClick={() => onEdit(supplier)}>{t('suppliers.editDetails')}</Button>
        </div>
        {notice && <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">{notice}</p>}
        {supplier.balance > 0 && (
          <form onSubmit={pay} className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold">{t('suppliers.pay')}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('suppliers.payAmount')}>
                <div className="flex gap-2">
                  <DecimalInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label={t('suppliers.payAmount')} />
                  <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={() => setAmount(formatNumber(supplier.balance, 2))}>{t('suppliers.payAll')}</Button>
                </div>
              </Field>
              <Field label={t('suppliers.payMethod')}>
                <SelectInput value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {SETTLING_METHOD_CODES.map((m) => <option key={m} value={m}>{method(m)}</option>)}
                </SelectInput>
              </Field>
              <Field label={`${t('common.reference')} (${t('common.optional')})`}>
                <TextInput value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" className="text-start" />
              </Field>
            </div>
            {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
            <Button type="submit" disabled={saving || !(parseDecimal(amount) > 0)}>{t('suppliers.savePayment', { amount: money(parseDecimal(amount) || 0) })}</Button>
          </form>
        )}
        <section>
          <h3 className="font-semibold mb-2">{t('suppliers.purchases')}</h3>
          {data.purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('suppliers.noPurchases')}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.purchases.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{i18n.code(p.purchaseNo)}</span>
                  <span className="text-muted-foreground">{i18n.date(p.date, 'medium')}</span>
                  <span className="tabular-nums">{money(p.totalAmount)}</span>
                  <span className={`tabular-nums ${p.balanceDue > 0 ? 'font-semibold text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
                    {p.balanceDue > 0 ? money(p.balanceDue) : t('suppliers.settled')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="font-semibold mb-2">{t('suppliers.payments')}</h3>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('suppliers.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>{i18n.dateTime(p.createdAt)}, {method(p.method)}</span>
                  <span className="tabular-nums font-semibold">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}

export default function SuppliersPage() {
  const i18n = useI18n()
  const { t, money } = i18n
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [totalOwed, setTotalOwed] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ suppliers: Supplier[]; totalOwed: number }>('/suppliers', { query: { search } })
      setSuppliers(data.suppliers)
      setTotalOwed(data.totalOwed)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border"><Truck size={20} className="rtl:-scale-x-100" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('suppliers.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('suppliers.subtitle')}</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-sm text-muted-foreground">{t('suppliers.totalOwed')}</p>
          <p className="font-display text-3xl font-bold tabular-nums">{money(totalOwed)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[16rem] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('suppliers.searchPlaceholder')} aria-label={t('suppliers.searchPlaceholder')} className="w-full h-10 ps-9 pe-3 rounded-md border border-border bg-card text-sm" />
        </div>
        <Button className="ms-auto gap-1.5" onClick={() => setEditing(null)}><Plus size={16} /> {t('suppliers.addSupplier')}</Button>
      </div>
      <div className="relative bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('suppliers.name')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-start font-semibold">{t('suppliers.phone')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 text-end font-semibold">{t('suppliers.owed')}</th>
              <th className="px-4 py-3 max-sm:px-2.5 max-md:hidden"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {!loading && suppliers.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">{t('suppliers.none')}</td></tr>}
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => setOpenId(s.id)}>
                <td className="px-4 py-3 max-sm:px-2.5 font-semibold"><bdi>{s.name}</bdi></td>
                <td className="px-4 py-3 max-sm:px-2.5 text-muted-foreground whitespace-nowrap">{s.phone ? i18n.phone(s.phone) : '–'}</td>
                <td className={`px-4 py-3 max-sm:px-2.5 text-end tabular-nums font-semibold whitespace-nowrap ${s.balance > 0 ? '' : 'text-muted-foreground'}`}>{s.balance > 0 ? money(s.balance) : t('suppliers.settled')}</td>
                <td className="px-4 py-3 max-sm:px-2.5 text-end max-md:hidden"><Button variant="ghost" size="sm">{t('suppliers.open')}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing !== undefined && <SupplierForm supplier={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load() }} />}
      {openId && editing === undefined && <SupplierAccount id={openId} onClose={() => setOpenId(null)} onChanged={load} onEdit={(s) => setEditing(s)} />}
    </div>
  )
}

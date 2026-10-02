import { useState } from 'react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput, ErrorNote, Field, TextArea, TextInput } from '@/components/ui/field'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { formatNumber, parseDecimal } from '@/lib/domain'

export interface Customer {
  id: string
  name: string
  phone: string | null
  address: string | null
  creditLimit: number | null
  balance: number
  notes: string | null
}

export default function CustomerForm({ customer, onClose, onSaved }: { customer?: Customer | null; onClose: () => void; onSaved: (c: Customer) => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [limit, setLimit] = useState(customer?.creditLimit != null ? formatNumber(customer.creditLimit, 2) : '')
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const creditLimit = limit.trim() ? parseDecimal(limit) : null
    if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
      setError({ code: 'INVALID_AMOUNT' })
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = { name, phone: phone || null, address: address || null, creditLimit, notes: notes || null }
      const saved = customer
        ? await api<Customer>(`/customers/${customer.id}`, { method: 'PUT', body })
        : await api<Customer>('/customers', { method: 'POST', body })
      onSaved(saved)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={customer ? t('customers.formEdit') : t('customers.formAdd')}
      onClose={onClose}
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="customer-form" disabled={saving || !name.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      }
    >
      <form id="customer-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('customers.name')} className="sm:col-span-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={`${t('customers.phone')} (${t('common.optional')})`}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('common.phonePlaceholder')} dir="ltr" inputMode="tel" className="text-start" />
        </Field>
        <Field label={t('customers.creditLimitLabel')} hint={t('customers.creditLimitHint')}>
          <DecimalInput value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={t('customers.noLimit')} />
        </Field>
        <Field label={`${t('customers.address')} (${t('common.optional')})`} className="sm:col-span-2">
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={`${t('customers.notes')} (${t('common.optional')})`} className="sm:col-span-2">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error != null && (
          <div className="sm:col-span-2">
            <ErrorNote>{i18n.error(error)}</ErrorNote>
          </div>
        )}
      </form>
    </Modal>
  )
}

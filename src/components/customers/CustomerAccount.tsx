import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput, ErrorNote, Field, SelectInput, TextInput } from '@/components/ui/field'
import { StatusBadge } from '@/components/ui/badges'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { formatNumber, parseDecimal, SETTLING_METHOD_CODES } from '@/lib/domain'
import { useRequestId } from '@/hooks/useRequestId'
import type { Customer } from './CustomerForm'

interface Account {
  customer: Customer
  orders: Array<{ id: string; invoiceNo: string; date: string; totalAmount: number; balanceDue: number; status: string }>
  repayments: Array<{ id: string; method: string; amount: number; reference: string | null; createdAt: string }>
}

export default function CustomerAccount({ customerId, onClose, onChanged, onEdit }: { customerId: string; onClose: () => void; onChanged: () => void; onEdit: (c: Customer) => void }) {
  const i18n = useI18n()
  const { t, money, method } = i18n
  const [account, setAccount] = useState<Account | null>(null)
  const [amount, setAmount] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [paymentsSaved, setPaymentsSaved] = useState(0)
  // Same form sent again (e.g. after a lost connection) is recorded once; a new repayment after a success gets a new id.
  const requestId = useRequestId('repay', [customerId, payMethod, amount, reference], paymentsSaved)

  const load = useCallback(() => api<Account>(`/customers/${customerId}`).then(setAccount).catch(setError), [customerId])
  useEffect(() => {
    load()
  }, [load])

  const record = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseDecimal(amount)
    if (!Number.isFinite(value) || value <= 0) return setError({ code: 'INVALID_AMOUNT' })
    setSaving(true)
    setError(null)
    try {
      const result = await api<{ customer: Customer }>(`/customers/${customerId}/payments`, {
        method: 'POST',
        body: { method: payMethod, amount: value, reference: reference || null, requestId },
      })
      setPaymentsSaved((n) => n + 1)
      setNotice(t('customers.paymentSaved', { amount: money(value), balance: money(result.customer.balance) }))
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

  if (!account) {
    return (
      <Modal title={t('common.loading')} onClose={onClose}>
        {error != null ? <ErrorNote>{i18n.error(error)}</ErrorNote> : <p className="text-muted-foreground">{t('common.loading')}</p>}
      </Modal>
    )
  }

  const { customer } = account
  const unpaid = account.orders.filter((o) => o.balanceDue > 0)

  return (
    <Modal
      title={t('customers.accountTitle', { name: customer.name })}
      subtitle={customer.phone ? i18n.phone(customer.phone) : t('common.noContact')}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('customers.currentBalance')}</p>
            <p className={`font-display text-4xl font-bold tabular-nums ${customer.balance > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{money(customer.balance)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('customers.creditLimit')}: {customer.creditLimit != null ? money(customer.creditLimit) : t('customers.noLimit')}
            </p>
          </div>
          <Button variant="outline" onClick={() => onEdit(customer)}>{t('customers.editDetails')}</Button>
        </div>

        {notice && <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">{notice}</p>}

        {customer.balance > 0 && (
          <form onSubmit={record} className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-semibold">{t('customers.recordPayment')}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('customers.repaymentAmount')}>
                <div className="flex gap-2">
                  <DecimalInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus aria-label={t('customers.repaymentAmount')} />
                  <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={() => setAmount(formatNumber(customer.balance, 2))}>
                    {t('customers.payAll')}
                  </Button>
                </div>
              </Field>
              <Field label={t('customers.repaymentMethod')}>
                <SelectInput value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {SETTLING_METHOD_CODES.map((m) => (
                    <option key={m} value={m}>{method(m)}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={`${t('common.reference')} (${t('common.optional')})`}>
                <TextInput value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" className="text-start" />
              </Field>
            </div>
            {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
            <Button type="submit" disabled={saving || !(parseDecimal(amount) > 0)}>
              {saving ? t('common.saving') : t('customers.savePayment', { amount: money(parseDecimal(amount) || 0) })}
            </Button>
          </form>
        )}

        <section>
          <h3 className="font-semibold mb-2">{t('customers.unpaidSales')}</h3>
          {unpaid.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('customers.noUnpaid')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-start font-semibold">{t('customers.sale')}</th>
                  <th className="py-2 text-start font-semibold">{t('common.date')}</th>
                  <th className="py-2 text-end font-semibold">{t('customers.total')}</th>
                  <th className="py-2 text-end font-semibold">{t('customers.due')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unpaid.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2">
                      <Link to={`/orders?orderId=${o.id}`} className="font-semibold text-link hover:underline">{i18n.code(o.invoiceNo)}</Link>
                    </td>
                    <td className="py-2">{i18n.date(o.date, 'medium')}</td>
                    <td className="py-2 text-end tabular-nums">{money(o.totalAmount)}</td>
                    <td className="py-2 text-end tabular-nums font-semibold text-amber-800 dark:text-amber-300">{money(o.balanceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h3 className="font-semibold mb-2">{t('customers.repayments')}</h3>
          {account.repayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('customers.noRepayments')}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {account.repayments.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>
                    {i18n.dateTime(p.createdAt)}, {method(p.method)}
                    {p.reference && <span className="ms-2 text-xs text-muted-foreground">{i18n.code(p.reference)}</span>}
                  </span>
                  <span className="tabular-nums font-semibold">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {account.orders.length > unpaid.length && (
          <section>
            <h3 className="font-semibold mb-2">{t('nav.orders')}</h3>
            <ul className="divide-y divide-border text-sm">
              {account.orders.filter((o) => o.balanceDue <= 0).slice(0, 10).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/orders?orderId=${o.id}`} className="text-link hover:underline">{i18n.code(o.invoiceNo)}</Link>
                  <span className="text-muted-foreground">{i18n.date(o.date, 'medium')}</span>
                  <StatusBadge status={o.status} />
                  <span className="tabular-nums">{money(o.totalAmount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  )
}

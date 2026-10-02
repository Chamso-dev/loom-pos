import { useMemo, useState } from 'react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput, ErrorNote, Field, SelectInput, TextInput } from '@/components/ui/field'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { formatNumber, parseDecimal, refundValue, roundQuantity, SETTLING_METHOD_CODES, splitRefund, unitRule } from '@/lib/domain'
import { useStore } from '@/store/useStore'

interface Props {
  order: any
  onClose: () => void
  onDone: (order: any, refund: any) => void
}

export default function RefundModal({ order, onClose, onDone }: Props) {
  const i18n = useI18n()
  const { t, money, qty, method } = i18n
  const fetchLowStockAlerts = useStore((s) => s.fetchLowStockAlerts)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true)
  const [refundMethod, setRefundMethod] = useState<string>('CASH')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const request = Object.entries(quantities)
    .map(([orderItemId, text]) => ({ orderItemId, quantity: parseDecimal(text) || 0 }))
    .filter((r) => r.quantity > 0)

  const preview = useMemo(() => refundValue(order, order.items, request), [order, JSON.stringify(request)])
  const split = splitRefund(preview.amount, order.balanceDue)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await api<{ order: any; refund: any }>(`/orders/${order.id}/refunds`, {
        method: 'POST',
        body: { items: request, method: refundMethod, reason: reason || null, restock },
      })
      fetchLowStockAlerts()
      onDone(result.order, result.refund)
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('orders.refundTitle', { number: i18n.code(order.invoiceNo) })}
      subtitle={t('orders.refundHint')}
      onClose={onClose}
      locked={saving}
      size="lg"
      footer={
        <Button className="w-full h-11" disabled={saving || !!preview.error || preview.amount <= 0} onClick={submit}>
          {saving ? t('common.saving') : t('orders.confirmRefund', { amount: money(preview.amount) })}
        </Button>
      }
    >
      <div className="space-y-5">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {order.items.map((item: any) => {
            const left = roundQuantity(item.quantity - item.refundedQuantity, item.unit)
            return (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm"><bdi>{item.product.name}</bdi></p>
                  <p className="text-xs text-muted-foreground">
                    {qty(item.quantity, item.unit, true)} × {i18n.unitPrice(item.price, item.unit)}
                    {left < item.quantity && <span className="ms-2">{t('orders.refundedQty', { qty: qty(item.refundedQuantity, item.unit, true) })}</span>}
                  </p>
                </div>
                {left > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('orders.refundable', { qty: qty(left, item.unit, true) })}</span>
                    <DecimalInput
                      value={quantities[item.id] ?? ''}
                      onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                      placeholder="0"
                      aria-label={`${t('billing.quantity')}: ${item.product.name}`}
                      className="w-24 h-9"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantities((q) => ({ ...q, [item.id]: formatNumber(left, unitRule(item.unit).decimals) }))}
                      className="text-xs font-semibold text-link hover:underline"
                    >
                      {t('orders.refundAll')}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('payments.status.REFUNDED')}</span>
                )}
              </li>
            )
          })}
        </ul>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('orders.reason')}>
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('orders.reasonPlaceholder')} />
          </Field>
          <Field label={t('orders.refundMethod')}>
            <SelectInput value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
              {SETTLING_METHOD_CODES.map((m) => (
                <option key={m} value={m}>
                  {method(m)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
          <span>
            <span className="block text-sm font-medium">{t('orders.restock')}</span>
            <span className="block text-xs text-muted-foreground">{t('orders.restockHint')}</span>
          </span>
        </label>

        <dl className="space-y-1.5 rounded-lg bg-secondary/60 p-4 text-sm">
          <div className="flex justify-between font-semibold">
            <dt>{t('orders.refundTotal')}</dt>
            <dd className="tabular-nums">{money(preview.amount)}</dd>
          </div>
          {split.toCredit > 0 && (
            <div className="flex justify-between text-amber-800 dark:text-amber-300">
              <dt>{t('orders.refundCancelsCredit')}</dt>
              <dd className="tabular-nums">{money(split.toCredit)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>{t('orders.refundPaidOut')}</dt>
            <dd className="tabular-nums font-semibold">{money(split.paidOut)}</dd>
          </div>
        </dl>

        {preview.error === 'REFUND_EXCEEDS_SOLD' && <ErrorNote>{t('errors.REFUND_EXCEEDS_SOLD')}</ErrorNote>}
        {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
      </div>
    </Modal>
  )
}

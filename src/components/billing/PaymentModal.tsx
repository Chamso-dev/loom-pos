import { useMemo, useRef, useState } from 'react'
import { Banknote, CreditCard, Landmark, Smartphone, NotebookPen, Plus, Trash2, CheckCircle2, Printer, FileText } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput, ErrorNote, TextInput } from '@/components/ui/field'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { hardware } from '@/lib/hardware'
import { cn } from '@/lib/utils'
import {
  formatNumber,
  parseDecimal,
  paymentMethod,
  PAYMENT_METHODS,
  roundMoney,
  settlePayments,
  type PaymentKind,
  type PaymentMethodCode,
} from '@/lib/domain'
import CustomerPicker from '../customers/CustomerPicker'
import PrintReceiptPortal from './PrintReceiptPortal'

const ICONS: Record<PaymentKind, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  mobile: Smartphone,
  transfer: Landmark,
  credit: NotebookPen,
}

export const PaymentIcon = ({ method, size = 16, className }: { method: string; size?: number; className?: string }) => {
  const Icon = ICONS[paymentMethod(method)?.kind ?? 'cash']
  return <Icon size={size} className={className} />
}

interface Line {
  key: number
  method: PaymentMethodCode
  text: string
  reference: string
}

/** Banknotes in circulation: suggest the exact amount and the next notes up. */
function cashSuggestions(need: number) {
  if (need <= 0) return []
  const ups = [100, 500, 1000, 2000].map((step) => Math.ceil(need / step) * step)
  return [...new Set([roundMoney(need), ...ups])].filter((v) => v >= need).slice(0, 5)
}

export default function PaymentModal({ total, onClose }: { total: number; onClose: () => void }) {
  const store = useStore()
  const { cart, discount, cartCustomer, setCartCustomer, settings, clearCart, fetchProducts, fetchLowStockAlerts } = store
  const i18n = useI18n()
  const { t, money, method: methodLabel } = i18n
  const nextKey = useRef(1)

  const defaultMethod = (settings?.defaultPaymentMethod ?? 'CASH') as PaymentMethodCode
  const [lines, setLines] = useState<Line[]>([
    { key: 0, method: defaultMethod, text: formatNumber(total, 2), reference: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [order, setOrder] = useState<any>(null)
  const [printType, setPrintType] = useState<'Thermal' | 'A4' | null>(null)

  const payments = lines.map((l) => ({ method: l.method, amount: parseDecimal(l.text) || 0, reference: l.reference || null }))
  const settlement = useMemo(
    () => settlePayments(total, payments, Boolean(cartCustomer)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total, JSON.stringify(payments), cartCustomer]
  )
  const hasCredit = lines.some((l) => l.method === 'CREDIT')
  const needsCustomer = hasCredit && !cartCustomer
  const ready = settlement.errors.length === 0 && !saving

  const cashNeed = roundMoney(
    total - payments.filter((p) => p.method !== 'CASH').reduce((sum, p) => sum + p.amount, 0)
  )

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key))
  const add = (method: PaymentMethodCode, amount = settlement.remaining) =>
    setLines((ls) => [...ls, { key: nextKey.current++, method, text: amount > 0 ? formatNumber(amount, 2) : '', reference: '' }])

  const complete = async () => {
    if (!ready) return
    setSaving(true)
    setError(null)
    try {
      const created = await api<any>('/orders', {
        method: 'POST',
        body: {
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          discount,
          payments: payments.filter((p) => p.amount > 0),
          customerId: cartCustomer?.id ?? null,
        },
      })
      setOrder(created)
      if (created.payments?.some((p: any) => p.method === 'CASH')) hardware.kickCashDrawer()
      clearCart()
      fetchProducts()
      fetchLowStockAlerts()
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  if (order) {
    return (
      <>
        <Modal title={t('billing.saleComplete')} subtitle={t('billing.saleNumber', { number: i18n.code(order.invoiceNo) })} onClose={onClose} size="sm">
          <div className="text-center space-y-4 py-2">
            <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
            {order.changeGiven > 0 ? (
              <p className="text-2xl font-bold">{t('billing.giveChange', { amount: money(order.changeGiven) })}</p>
            ) : (
              <p className="text-base text-muted-foreground">{t('billing.noChange')}</p>
            )}
            {order.balanceDue > 0 && order.customer && (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {t('billing.creditRecorded', { amount: money(order.balanceDue), name: order.customer.name })}
              </p>
            )}
          </div>
          <div className="grid gap-2 mt-4">
            <Button className="gap-2" onClick={() => setPrintType('Thermal')} data-autofocus>
              <Printer size={16} /> {t('billing.printReceipt')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setPrintType('A4')}>
              <FileText size={16} /> {t('billing.printInvoice')}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t('billing.newSale')}
            </Button>
          </div>
        </Modal>
        {printType && <PrintReceiptPortal order={order} type={printType} onClose={() => setPrintType(null)} />}
      </>
    )
  }

  return (
    <Modal
      title={t('billing.payment')}
      onClose={onClose}
      locked={saving}
      size="lg"
      footer={
        <Button className="w-full h-12 text-base font-semibold" disabled={!ready} onClick={complete}>
          {saving ? t('billing.completing') : t('billing.completeSale')}
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          complete()
        }}
        className="space-y-5"
      >
        <div className="flex items-baseline justify-between rounded-lg bg-secondary/60 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">{t('billing.amountDue')}</span>
          <span className="text-3xl font-bold tabular-nums">{money(total)}</span>
        </div>

        <ul className="space-y-3">
          {lines.map((line) => {
            const info = paymentMethod(line.method)!
            const isCash = line.method === 'CASH'
            return (
              <li key={line.key} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`method-${line.key}`}>{t('common.method')}</label>
                  <div className="relative flex-1">
                    <PaymentIcon method={line.method} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <select
                      id={`method-${line.key}`}
                      value={line.method}
                      onChange={(e) => update(line.key, { method: e.target.value as PaymentMethodCode })}
                      className="w-full h-10 rounded-md border border-border bg-background ps-9 pe-8 text-sm font-semibold"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.code} value={m.code}>
                          {methodLabel(m.code)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <DecimalInput
                    value={line.text}
                    onChange={(e) => update(line.key, { text: e.target.value })}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={isCash ? t('billing.cashReceived') : t('billing.amountCharged')}
                    className="w-40 h-10 text-base font-semibold"
                  />
                  {lines.length > 1 && (
                    <button type="button" onClick={() => remove(line.key)} aria-label={t('billing.removePayment')} className="p-2 text-muted-foreground hover:text-destructive">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {isCash ? t('billing.cashReceived') : line.method === 'CREDIT' ? t('payments.hints.CREDIT') : t('billing.amountCharged')}
                  {line.method === 'BARIDIMOB' && settings?.ripAccount && <span className="ms-2">{t('billing.ripHint', { rip: i18n.code(settings.ripAccount) })}</span>}
                  {line.method === 'TRANSFER' && settings?.ribAccount && <span className="ms-2">{t('billing.ribHint', { rib: i18n.code(settings.ribAccount) })}</span>}
                </p>

                {isCash && cashNeed > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {cashSuggestions(cashNeed).map((v, i) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update(line.key, { text: formatNumber(v, 2) })}
                        aria-label={i === 0 ? `${t('billing.exact')}: ${money(v)}` : undefined}
                        title={i === 0 ? t('billing.exact') : undefined}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums',
                          parseDecimal(line.text) === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                        )}
                      >
                        {money(v)}
                      </button>
                    ))}
                  </div>
                )}

                {info.takesReference && (
                  <TextInput
                    value={line.reference}
                    onChange={(e) => update(line.key, { reference: e.target.value })}
                    placeholder={`${t('billing.referenceLabel')} (${t('billing.referencePlaceholder')})`}
                    aria-label={t('billing.referenceLabel')}
                    dir="ltr"
                    className="text-start"
                  />
                )}
              </li>
            )
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.filter((m) => !m.onAccount && !lines.some((l) => l.method === m.code)).map((m) => (
            <button
              key={m.code}
              type="button"
              onClick={() => add(m.code)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Plus size={12} /> {methodLabel(m.code)}
            </button>
          ))}
        </div>

        {needsCustomer && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
            <p className="text-sm font-medium">{t('billing.creditNeedsCustomer')}</p>
            <CustomerPicker onPick={(c) => setCartCustomer(c)} />
          </div>
        )}

        <dl className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('billing.paidNow')}</dt>
            <dd className="font-semibold tabular-nums">{money(settlement.amountPaid)}</dd>
          </div>
          {settlement.balanceDue > 0 && (
            <div className="flex justify-between text-amber-700 dark:text-amber-400">
              <dt>{t('billing.onCredit')}</dt>
              <dd className="font-semibold tabular-nums">{money(settlement.balanceDue)}</dd>
            </div>
          )}
          {settlement.change > 0 && (
            <div className="flex justify-between text-lg">
              <dt className="font-semibold">{t('billing.change')}</dt>
              <dd className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{money(settlement.change)}</dd>
            </div>
          )}
          {settlement.remaining > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-destructive">
              <dt className="font-semibold">{t('billing.remaining')}</dt>
              <dd className="font-bold tabular-nums">{money(settlement.remaining)}</dd>
            </div>
          )}
          {settlement.remaining > 0 && (
            <Button type="button" variant="outline" className="w-full mt-2 gap-2" onClick={() => add('CREDIT')}>
              <NotebookPen size={15} /> {t('billing.putOnCredit', { amount: money(settlement.remaining) })}
            </Button>
          )}
          {settlement.balanceDue > 0 && cartCustomer && (
            <p className="text-xs text-muted-foreground pt-1">
              {t('billing.creditBalanceAfter', { name: cartCustomer.name, amount: money(cartCustomer.balance + settlement.balanceDue) })}
            </p>
          )}
        </dl>

        {settlement.errors.includes('OVERPAID_NON_CASH') && <ErrorNote>{t('errors.OVERPAID_NON_CASH')}</ErrorNote>}
        {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

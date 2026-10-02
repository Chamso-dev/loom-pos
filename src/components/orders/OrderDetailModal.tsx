import { useState } from 'react'
import { Printer, RotateCcw, FileText } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badges'
import { useI18n } from '@/i18n'
import { roundMoney } from '@/lib/domain'
import PrintReceiptPortal from '../billing/PrintReceiptPortal'
import { PaymentIcon } from '../billing/PaymentModal'
import RefundModal from './RefundModal'

export default function OrderDetailModal({ order: initial, onClose, onChange }: { order: any; onClose: () => void; onChange?: (order: any) => void }) {
  const i18n = useI18n()
  const { t, money, qty, method } = i18n
  const [order, setOrder] = useState(initial)
  const [printType, setPrintType] = useState<'Thermal' | 'A4' | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [notice, setNotice] = useState('')

  const canRefund = order.items.some((i: any) => i.quantity - i.refundedQuantity > 1e-9)
  const salePayments = (order.payments ?? []).filter((p: any) => p.kind === 'SALE')

  return (
    <>
      <Modal
        title={t('orders.detailTitle', { number: i18n.code(order.invoiceNo) })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {i18n.date(order.date, 'long')} {i18n.time(order.date)} <StatusBadge status={order.status} />
          </span>
        }
        onClose={onClose}
        size="lg"
        footer={
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" className="gap-2" onClick={() => setPrintType('A4')}>
              <FileText size={15} /> {t('orders.reprintA4')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setPrintType('Thermal')}>
              <Printer size={15} /> {t('orders.reprintReceipt')}
            </Button>
            <Button className="gap-2" disabled={!canRefund} onClick={() => setRefunding(true)}>
              <RotateCcw size={15} className="rtl:-scale-x-100" /> {t('orders.refund')}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 text-sm">
          {notice && <p className="rounded-md bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-3 py-2 font-medium">{notice}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">{t('orders.customer')}</p>
              <p className="font-semibold">{order.customer?.name ?? order.customerName ?? t('common.walkIn')}</p>
              {(order.customer?.phone ?? order.customerMobile) && <p className="text-muted-foreground">{i18n.phone(order.customer?.phone ?? order.customerMobile)}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('orders.cashier')}</p>
              <p className="font-semibold">{order.processedBy?.name ?? t('common.unknown')}</p>
            </div>
          </div>

          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">{t('orders.items')}</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {order.items.map((item: any) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium"><bdi>{item.product.name}</bdi></p>
                    <p className="text-xs text-muted-foreground">
                      {qty(item.quantity, item.unit, true)} × {i18n.unitPrice(item.price, item.unit)}
                      {item.refundedQuantity > 0 && (
                        <span className="ms-2 text-sky-700 dark:text-sky-300">{t('orders.refundedQty', { qty: qty(item.refundedQuantity, item.unit, true) })}</span>
                      )}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{money(roundMoney(item.price * item.quantity))}</span>
                </li>
              ))}
            </ul>
          </section>

          <dl className="space-y-1.5 rounded-lg bg-secondary/50 p-4">
            {order.discountAmount > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground"><dt>{t('common.subtotal')}</dt><dd className="tabular-nums">{money(order.subtotal)}</dd></div>
                <div className="flex justify-between text-muted-foreground"><dt>{t('orders.discount')}</dt><dd className="tabular-nums">−{money(order.discountAmount)}</dd></div>
              </>
            )}
            <div className="flex justify-between font-semibold text-base"><dt>{t('orders.total')}</dt><dd className="tabular-nums">{money(order.totalAmount)}</dd></div>
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground"><dt>{t('orders.taxIncluded')}</dt><dd className="tabular-nums">{money(order.taxAmount)}</dd></div>
            )}
            <div className="flex justify-between"><dt>{t('orders.paid')}</dt><dd className="tabular-nums">{money(order.amountPaid)}</dd></div>
            {order.changeGiven > 0 && <div className="flex justify-between"><dt>{t('orders.change')}</dt><dd className="tabular-nums">{money(order.changeGiven)}</dd></div>}
            {order.balanceDue > 0 && (
              <div className="flex justify-between font-semibold text-amber-800 dark:text-amber-300"><dt>{t('orders.stillOwed')}</dt><dd className="tabular-nums">{money(order.balanceDue)}</dd></div>
            )}
          </dl>

          {salePayments.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">{t('orders.payments')}</h3>
              <ul className="space-y-1.5">
                {salePayments.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <PaymentIcon method={p.method} size={14} className="text-muted-foreground" />
                      {method(p.method)}
                      {p.reference && <span className="text-xs text-muted-foreground">{i18n.code(p.reference)}</span>}
                      {p.tendered && <span className="text-xs text-muted-foreground">{t('orders.tendered', { amount: money(p.tendered) })}</span>}
                    </span>
                    <span className="tabular-nums font-medium">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {order.refunds?.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">{t('orders.refunds')}</h3>
              <ul className="space-y-1.5">
                {order.refunds.map((r: any) => (
                  <li key={r.id}>
                    <p>{t('orders.refundLine', { number: i18n.code(r.refundNo), date: i18n.dateTime(r.createdAt), amount: money(r.amount) })}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.paidOut > 0 && `${method(r.method)}: ${money(r.paidOut)}`}
                      {r.toCredit > 0 && <span className="ms-2">{t('orders.refundToCredit', { amount: money(r.toCredit) })}</span>}
                      {r.reason && <span className="ms-2">{r.reason}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!canRefund && <p className="text-xs text-muted-foreground">{t('orders.fullyRefunded')}</p>}
        </div>
      </Modal>

      {refunding && (
        <RefundModal
          order={order}
          onClose={() => setRefunding(false)}
          onDone={(updated, refund) => {
            setOrder(updated)
            onChange?.(updated)
            setRefunding(false)
            setNotice(t('orders.refundDone', { number: i18n.code(refund.refundNo) }))
          }}
        />
      )}
      {printType && <PrintReceiptPortal order={order} type={printType} onClose={() => setPrintType(null)} />}
    </>
  )
}

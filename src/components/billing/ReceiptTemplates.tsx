import { useStore } from '@/store/useStore'
import { useI18n, type I18n } from '@/i18n'
import { priceSale, sumMoney } from '@/lib/domain'
import { cn } from '@/lib/utils'

/** The order as returned by the API, with items, payments, customer and refunds. */
export interface ReceiptOrder {
  invoiceNo: string
  date: string
  subtotal: number
  discountAmount: number
  totalAmount: number
  taxAmount: number
  amountPaid: number
  changeGiven: number
  balanceDue: number
  refundedAmount: number
  customerName?: string | null
  customerMobile?: string | null
  customer?: { name: string; phone?: string | null; balance: number } | null
  processedBy?: { name: string } | null
  items: Array<{ quantity: number; unit: string; price: number; taxRate: number; product: { name: string; sku: string } }>
  payments?: Array<{ method: string; amount: number; tendered?: number | null; kind?: string }>
}

const fixed = (i18n: I18n, n: number, symbol = true) => i18n.money(n, { decimals: 'fixed', symbol })

/** TVA included in the sale, per rate, after the discount. */
function taxLines(order: ReceiptOrder) {
  return priceSale(
    order.items.map((i) => ({ unitPrice: i.price, quantity: i.quantity, unit: i.unit, taxRate: i.taxRate })),
    order.discountAmount > 0 ? { type: 'amount', value: order.discountAmount } : null
  ).taxLines.filter((l) => l.tax > 0)
}

function StoreIds({ i18n, className }: { i18n: I18n; className?: string }) {
  const settings = useStore((s) => s.settings)
  const ids = (['rc', 'nif', 'nis', 'articleNo'] as const).filter((k) => settings?.[k])
  if (!ids.length) return null
  return (
    <p className={cn('flex flex-wrap justify-center gap-x-3', className)}>
      {ids.map((k) => (
        <span key={k}>
          {i18n.t(`receipt.labels.${k}`)}: {i18n.code(settings![k])}
        </span>
      ))}
    </p>
  )
}

const Row = ({ label, value, strong, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; className?: string }) => (
  <div className={cn('flex justify-between gap-2', strong && 'font-bold', className)}>
    <span>{label}</span>
    <span className="tabular-nums text-end whitespace-nowrap">{value}</span>
  </div>
)

/** Ticket for 58 mm and 80 mm thermal printers. */
export function ThermalReceipt({ order }: { order: ReceiptOrder }) {
  const i18n = useI18n()
  const { t, qty, unitPrice, method } = i18n
  const settings = useStore((s) => s.settings)
  const width = settings?.receiptWidth ?? 80
  const salePayments = (order.payments ?? []).filter((p) => (p.kind ?? 'SALE') === 'SALE')
  const customerName = order.customer?.name ?? order.customerName

  return (
    <div
      dir={i18n.dir}
      lang={i18n.lang}
      className={cn('bg-white text-black mx-auto font-sans leading-snug', width === 58 ? 'text-[11px] px-2 py-3' : 'text-[12px] px-3 py-4')}
      style={{ width: `${width}mm` }}
    >
      <header className="text-center space-y-0.5 mb-2">
        <h2 className="text-[15px] font-bold" dir="auto">{settings?.name || t('common.appName')}</h2>
        {settings?.address && <p className="whitespace-pre-wrap" dir="auto">{settings.address}</p>}
        {settings?.phone && (
          <p>
            {t('receipt.labels.phone')}: {i18n.phone(settings.phone)}
          </p>
        )}
        <StoreIds i18n={i18n} />
      </header>

      <div className="border-y border-dashed border-black py-1.5 space-y-0.5">
        <Row label={t('receipt.ticketTitle')} value={i18n.code(order.invoiceNo)} strong />
        <Row label={t('receipt.date')} value={`${i18n.date(order.date, 'short')} ${i18n.time(order.date)}`} />
        {order.processedBy?.name && <Row label={t('receipt.cashier')} value={order.processedBy.name} />}
        {customerName && <Row label={t('receipt.customer')} value={customerName} />}
      </div>

      <ul className="py-1.5 space-y-1.5">
        {order.items.map((item, idx) => (
          <li key={idx}>
            <p className="font-semibold"><bdi>{item.product.name}</bdi></p>
            <Row
              label={
                <span className="opacity-80">
                  {qty(item.quantity, item.unit, true)} × {unitPrice(item.price, item.unit)}
                </span>
              }
              value={fixed(i18n, item.price * item.quantity, false)}
            />
          </li>
        ))}
      </ul>

      <div className="border-t border-dashed border-black pt-1.5 space-y-0.5">
        {order.discountAmount > 0 && (
          <>
            <Row label={t('receipt.subtotal')} value={fixed(i18n, order.subtotal)} />
            <Row label={t('receipt.discount')} value={`−${fixed(i18n, order.discountAmount)}`} />
          </>
        )}
        <Row label={t('receipt.total')} value={fixed(i18n, order.totalAmount)} strong className="text-[14px]" />
        {settings?.receiptShowTax !== false &&
          taxLines(order).map((l) => <Row key={l.rate} label={t('receipt.taxIncluded', { rate: l.rate })} value={fixed(i18n, l.tax)} className="opacity-80" />)}
      </div>

      <div className="border-t border-dashed border-black mt-1.5 pt-1.5 space-y-0.5">
        {salePayments.map((p, i) =>
          p.method === 'CASH' ? (
            <Row key={i} label={t('receipt.tendered')} value={fixed(i18n, p.tendered ?? p.amount)} />
          ) : (
            <Row key={i} label={method(p.method)} value={fixed(i18n, p.amount)} />
          )
        )}
        {order.changeGiven > 0 && <Row label={t('receipt.change')} value={fixed(i18n, order.changeGiven)} strong />}
        {order.totalAmount - order.amountPaid > 0.004 && (
          <Row label={t('receipt.remainingCredit')} value={fixed(i18n, order.totalAmount - order.amountPaid)} strong />
        )}
        {order.customer && order.customer.balance > 0 && <Row label={t('receipt.customerBalance')} value={fixed(i18n, order.customer.balance)} />}
        {order.refundedAmount > 0 && <Row label={t('receipt.refunded')} value={`−${fixed(i18n, order.refundedAmount)}`} />}
      </div>

      <footer className="mt-3 pt-2 border-t border-dashed border-black text-center space-y-1">
        {settings?.receiptFooter && <p className="whitespace-pre-wrap font-semibold" dir="auto">{settings.receiptFooter}</p>}
        <p className="font-semibold">{t('receipt.thanks')}</p>
        <p className="text-[10px] opacity-75">{t('receipt.pricesInDzd')}</p>
      </footer>
    </div>
  )
}

/** A4 invoice with the shop's Algerian identifiers and the TVA breakdown. */
export function A4Invoice({ order }: { order: ReceiptOrder }) {
  const i18n = useI18n()
  const { t, qty, method } = i18n
  const settings = useStore((s) => s.settings)
  const salePayments = (order.payments ?? []).filter((p) => (p.kind ?? 'SALE') === 'SALE')
  const taxes = taxLines(order)
  const customerName = order.customer?.name ?? order.customerName
  const customerPhone = order.customer?.phone ?? order.customerMobile

  return (
    <div dir={i18n.dir} lang={i18n.lang} className="bg-white text-black p-12 w-[210mm] min-h-[297mm] mx-auto flex flex-col font-sans text-sm">
      <header className="flex justify-between items-start gap-8 mb-10 border-b-2 border-black pb-6">
        <div className="space-y-1">
          <p className="text-xl font-bold">{settings?.name || t('common.appName')}</p>
          {settings?.address && <p className="whitespace-pre-wrap"><bdi>{settings.address}</bdi></p>}
          {settings?.phone && (
            <p>
              {t('receipt.labels.phone')}: {i18n.phone(settings.phone)}
            </p>
          )}
          <StoreIds i18n={i18n} className="!justify-start text-xs" />
        </div>
        <div className="text-end">
          <h1 className="text-3xl font-black mb-3">{t('receipt.invoiceTitle')}</h1>
          <p>
            <span className="opacity-60">{t('receipt.number')} </span>
            <span className="font-bold">{i18n.code(order.invoiceNo)}</span>
          </p>
          <p>
            <span className="opacity-60">{t('receipt.date')} </span>
            {i18n.date(order.date, 'medium')} {i18n.time(order.date)}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs opacity-60 mb-1">{t('receipt.billTo')}</p>
          <p className="font-bold"><bdi>{customerName || t('common.walkIn')}</bdi></p>
          {customerPhone && <p className="opacity-70">{i18n.phone(customerPhone)}</p>}
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs opacity-60 mb-1">{t('receipt.paymentDetails')}</p>
          {salePayments.map((p, i) => (
            <p key={i}>
              {method(p.method)}: {fixed(i18n, p.amount)}
            </p>
          ))}
          {order.totalAmount - order.amountPaid > 0.004 && (
            <p className="font-semibold">
              {t('receipt.remainingCredit')}: {fixed(i18n, order.totalAmount - order.amountPaid)}
            </p>
          )}
        </div>
      </section>

      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-black text-xs">
            <th className="py-3 text-start">{t('receipt.item')}</th>
            <th className="py-3 text-center">{t('receipt.qty')}</th>
            <th className="py-3 text-end">{t('receipt.unitPrice')}</th>
            <th className="py-3 text-center">{t('receipt.tva')}</th>
            <th className="py-3 text-end">{t('receipt.lineTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-200">
              <td className="py-3">
                <p className="font-semibold"><bdi>{item.product.name}</bdi></p>
                <p className="text-xs opacity-60">{i18n.code(item.product.sku)}</p>
              </td>
              <td className="py-3 text-center">{qty(item.quantity, item.unit, true)}</td>
              <td className="py-3 text-end tabular-nums">{fixed(i18n, item.price)}</td>
              <td className="py-3 text-center">{i18n.percent(item.taxRate)}</td>
              <td className="py-3 text-end font-semibold tabular-nums">{fixed(i18n, item.price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex-1" />
      <section className="mt-8 flex justify-end">
        <div className="w-72 space-y-2">
          {order.discountAmount > 0 && (
            <>
              <Row label={t('receipt.subtotal')} value={fixed(i18n, order.subtotal)} />
              <Row label={t('receipt.discount')} value={`−${fixed(i18n, order.discountAmount)}`} />
            </>
          )}
          {taxes.length > 0 && <Row label={t('receipt.taxBase')} value={fixed(i18n, order.totalAmount - sumMoney(taxes.map((l) => l.tax)))} />}
          {taxes.map((l) => (
            <Row key={l.rate} label={t('receipt.taxIncluded', { rate: l.rate })} value={fixed(i18n, l.tax)} />
          ))}
          <Row label={t('receipt.total')} value={fixed(i18n, order.totalAmount)} strong className="text-lg border-t-2 border-black pt-2" />
          {order.refundedAmount > 0 && <Row label={t('receipt.refunded')} value={`−${fixed(i18n, order.refundedAmount)}`} />}
        </div>
      </section>

      <footer className="mt-16 flex justify-between items-end gap-8 text-xs">
        <div className="space-y-1 opacity-70 max-w-sm">
          <p>{t('receipt.pricesInDzd')}</p>
          <p>{t('receipt.terms')}</p>
          {settings?.receiptFooter && <p dir="auto">{settings.receiptFooter}</p>}
        </div>
        <div className="text-center border-t border-black w-48 pt-2">
          <p className="font-semibold">{t('receipt.signature')}</p>
        </div>
      </footer>
    </div>
  )
}

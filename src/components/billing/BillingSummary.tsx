import { useMemo, useState } from 'react'
import { Receipt, X, Percent, BadgePercent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/field'
import Modal from '@/components/ui/modal'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { CURRENCY, parseDecimal, priceSale } from '@/lib/domain'
import { cn } from '@/lib/utils'
import CustomerPicker from '../customers/CustomerPicker'
import PaymentModal from './PaymentModal'

export default function BillingSummary() {
  const { cart, discount, setDiscount, cartCustomer, setCartCustomer } = useStore()
  const { t, money, phone, lang } = useI18n()
  const [pickingCustomer, setPickingCustomer] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [discountText, setDiscountText] = useState(discount ? String(discount.value) : '')
  const [discountOpen, setDiscountOpen] = useState(Boolean(discount))
  // Kept apart from the discount so choosing % before typing a value is remembered.
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(discount?.type ?? 'amount')

  const totals = useMemo(
    () =>
      priceSale(
        cart.map((i) => ({ unitPrice: i.price, quantity: i.quantity, unit: i.unit, taxRate: i.taxRate, costPrice: i.costPrice })),
        discount
      ),
    [cart, discount]
  )

  const updateDiscount = (text: string, type = discountType) => {
    setDiscountText(text)
    setDiscountType(type)
    const value = parseDecimal(text)
    setDiscount(Number.isFinite(value) && value > 0 ? { type, value } : null)
  }

  return (
    <>
      <section className="lg:h-full flex flex-col border border-border bg-card rounded-md lg:overflow-hidden font-sans">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
          <Receipt size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('billing.summary')}</h2>
        </header>

        <div className="flex-1 lg:overflow-y-auto p-4 space-y-5 custom-scrollbar">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">{t('billing.customer')}</span>
            {cartCustomer ? (
              <div className="flex items-start justify-between gap-2 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate"><bdi>{cartCustomer.name}</bdi></p>
                  <p className="text-xs text-muted-foreground">{cartCustomer.phone ? phone(cartCustomer.phone) : t('common.noContact')}</p>
                  {cartCustomer.balance > 0 && (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1">{t('billing.owes', { amount: money(cartCustomer.balance) })}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => setPickingCustomer(true)} className="text-xs font-medium text-link hover:underline px-1">
                    {t('billing.changeCustomer')}
                  </button>
                  <button type="button" aria-label={t('billing.removeCustomer')} onClick={() => setCartCustomer(null)} className="p-1 text-muted-foreground hover:text-destructive">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickingCustomer(true)}
                className="w-full rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 text-start"
              >
                {t('billing.chooseCustomer')}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {discountOpen ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">{t('billing.discount')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountOpen(false)
                      updateDiscount('')
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {t('billing.removeDiscount')}
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex rounded-md border border-border p-0.5 bg-secondary/50" role="group">
                    {(['amount', 'percent'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={discountType === type}
                        onClick={() => updateDiscount(discountText, type)}
                        className={cn(
                          'px-2.5 rounded text-xs font-semibold',
                          discountType === type ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                        )}
                        title={type === 'amount' ? t('billing.discountAmount') : t('billing.discountPercent')}
                      >
                        {type === 'amount' ? CURRENCY.symbol[lang] : '%'}
                      </button>
                    ))}
                  </div>
                  <DecimalInput
                    autoFocus
                    value={discountText}
                    onChange={(e) => updateDiscount(e.target.value)}
                    aria-label={discountType === 'amount' ? t('billing.discountAmount') : t('billing.discountPercent')}
                    placeholder="0"
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setDiscountOpen(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-link hover:underline disabled:opacity-40 disabled:no-underline"
              >
                <BadgePercent size={15} /> {t('billing.addDiscount')}
              </button>
            )}
          </div>

          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>{t('billing.subtotal')}</dt>
              <dd className="tabular-nums text-foreground">{money(totals.subtotal)}</dd>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <dt className="flex items-center gap-1">
                  <Percent size={12} /> {t('billing.discount')}
                </dt>
                <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">−{money(totals.discountAmount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-3 border-t border-border">
              <dt className="text-base font-semibold">{t('billing.total')}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums tracking-tight">{money(totals.total)}</dd>
            </div>
            {totals.taxLines.filter((l) => l.tax > 0).map((l) => (
              <div key={l.rate} className="flex justify-between text-xs text-muted-foreground">
                <dt>{t('billing.taxIncluded', { rate: l.rate })}</dt>
                <dd className="tabular-nums">{money(l.tax)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="p-3 sm:p-4 border-t border-border shrink-0 bg-card max-lg:sticky max-lg:bottom-0 max-lg:rounded-b-md max-lg:shadow-[0_-6px_16px_-10px_rgb(0_0_0/0.35)] max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button size="lg" disabled={cart.length === 0} onClick={() => setShowPayment(true)} className="w-full h-12 text-base font-semibold gap-3">
            {t('billing.takePayment')}
            {cart.length > 0 && <span className="lg:hidden tabular-nums">{money(totals.total)}</span>}
          </Button>
        </footer>
      </section>

      {pickingCustomer && (
        <Modal title={t('billing.chooseCustomer')} onClose={() => setPickingCustomer(false)} size="sm">
          <CustomerPicker
            autoFocus
            onPick={(c) => {
              setCartCustomer(c)
              setPickingCustomer(false)
            }}
          />
        </Modal>
      )}

      {showPayment && <PaymentModal total={totals.total} onClose={() => setShowPayment(false)} />}
    </>
  )
}

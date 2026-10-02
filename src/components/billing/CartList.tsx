import { useEffect, useState } from 'react'
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useStore, type CartItem } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { allowsDecimal, expiryStatus, formatNumber, parseDecimal, roundMoney, unitRule } from '@/lib/domain'
import { cn } from '@/lib/utils'
import ExpiryBadge from '@/components/inventory/ExpiryBadge'

/** Quantity field: typed for weights (1,5 kg), +/- buttons for counted items. */
function QuantityControl({ item }: { item: CartItem }) {
  const { updateQuantity } = useStore()
  const { t, unitName } = useI18n()
  const decimal = allowsDecimal(item.unit)
  const [text, setText] = useState(formatNumber(item.quantity, unitRule(item.unit).decimals))

  useEffect(() => setText(formatNumber(item.quantity, unitRule(item.unit).decimals)), [item.quantity, item.unit])

  const commit = () => {
    const value = parseDecimal(text)
    if (Number.isFinite(value) && value > 0) updateQuantity(item.productId, value)
    else setText(formatNumber(item.quantity, unitRule(item.unit).decimals))
  }
  const step = unitRule(item.unit).step

  return (
    <div className="flex items-center gap-1 p-0.5 bg-secondary/80 rounded-md border border-border shrink-0">
      <button
        type="button"
        aria-label={t('billing.decrease')}
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30"
        disabled={item.quantity <= step}
        onClick={() => updateQuantity(item.productId, item.quantity - step)}
      >
        <Minus size={14} />
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        inputMode={decimal ? 'decimal' : 'numeric'}
        dir="ltr"
        aria-label={`${item.unit === 'kg' || item.unit === 'g' ? t('billing.weight') : t('billing.quantity')} (${unitName(item.unit)})`}
        title={decimal ? t('units.weightHint') : undefined}
        className={cn('h-8 text-center text-sm font-bold tabular-nums bg-card rounded border border-border focus:outline-none focus:ring-2 focus:ring-ring/40', decimal ? 'w-20' : 'w-12')}
      />
      <button
        type="button"
        aria-label={t('billing.increase')}
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30"
        disabled={item.quantity + step > item.stock + 1e-9}
        onClick={() => updateQuantity(item.productId, item.quantity + step)}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

export default function CartList() {
  const { cart, removeFromCart } = useStore()
  const { t, money, unitPrice, qty, code } = useI18n()

  if (cart.length === 0) {
    return (
      <div className="lg:h-full flex flex-col items-center justify-center text-center text-muted-foreground bg-accent/10 rounded-xl border-2 border-dashed border-border/60 p-8 sm:p-12">
        <ShoppingBag size={56} className="mb-4 opacity-20" />
        <h3 className="text-lg font-semibold text-foreground/70">{t('billing.emptyTitle')}</h3>
        <p className="text-sm mt-1">{t('billing.emptyHint')}</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2 lg:overflow-y-auto pe-1 custom-scrollbar font-sans">
      {cart.map((item) => (
        <li
          key={item.id}
          className={cn(
            'group flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 bg-card border rounded-md',
            // An expired product stays sellable, but the cashier should see it before taking payment.
            expiryStatus(item.expiryDate)?.state === 'expired' ? 'border-loss/50' : 'border-border'
          )}
        >
          <div className="flex-1 min-w-[10rem]">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className="text-sm font-semibold text-foreground"><bdi>{item.name}</bdi></span>
              <span className="text-[11px] bg-secondary px-1.5 py-0.5 rounded border border-border text-muted-foreground">{code(item.sku)}</span>
              {item.taxRate > 0 && (
                <span className="text-[11px] bg-primary/10 text-link px-1.5 py-0.5 rounded font-semibold">{t('billing.taxRate', { rate: item.taxRate })}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-muted-foreground">{unitPrice(item.price, item.unit)}</span>
              <span className={cn(item.stock - item.quantity <= unitRule(item.unit).lowStockAt ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                {t('billing.inStock', { stock: qty(item.stock, item.unit, true) })}
              </span>
              <ExpiryBadge value={item.expiryDate} onlyWarnings />
            </div>
          </div>

          <QuantityControl item={item} />

          <div className="flex items-center gap-2 shrink-0 min-w-[110px] justify-end">
            <span className="text-base font-bold tabular-nums text-foreground">{money(roundMoney(item.price * item.quantity))}</span>
            <button
              type="button"
              aria-label={t('billing.removeItem', { name: item.name })}
              className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => removeFromCart(item.productId)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

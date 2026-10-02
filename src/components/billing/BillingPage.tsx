import { useEffect, useState } from 'react'
import ConfirmDialog from '@/components/ui/confirm'
import { ShoppingCart, User, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import ScannerInput from './ScannerInput'
import CartList from './CartList'
import BillingSummary from './BillingSummary'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export default function BillingPage() {
  const { fetchProducts, user, cart, clearCart } = useStore()
  const { t, time, date } = useI18n()
  const now = useClock()
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col gap-5 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center text-foreground border border-border">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t('billing.title')}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
              <User size={13} className="opacity-70" /> {t('billing.cashier', { name: user?.name ?? '' })}
            </p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-lg font-semibold tabular-nums">{time(now)}</p>
          <p className="text-xs text-muted-foreground">{date(now, 'dayMonth')}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="shrink-0">
            <ScannerInput />
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t('billing.basket')}
                {cart.length > 0 && <span className="ms-2 font-normal">{t('billing.basketCount', { count: cart.length })}</span>}
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={13} /> {t('billing.clearBasket')}
                </button>
              )}
            </div>
            <CartList />
          </div>
        </div>
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <BillingSummary />
        </div>
      </div>
      {confirmClear && (
        <ConfirmDialog
          title={t('billing.clearBasket')}
          message={t('billing.clearConfirm')}
          confirmLabel={t('billing.clearBasket')}
          danger
          onConfirm={clearCart}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}

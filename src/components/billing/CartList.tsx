import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { formatCurrency, cn } from '@/lib/utils'

export default function CartList() {
  const { cart, removeFromCart, updateQuantity } = useStore()

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground bg-accent/10 rounded-2xl border-2 border-dashed border-border/60 py-14 px-6 text-center">
        <ShoppingBag size={48} className="mb-3 opacity-15" />
        <h3 className="text-base font-bold tracking-tight opacity-50">Your cart is empty</h3>
        <p className="text-xs opacity-40 mt-1">Scan a product to start billing</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 font-sans">
      {cart.map((item) => {
        const isWeighted = item.productType === 'WEIGHTED'
        const step = item.step ?? 1
        return (
          <div key={item.id} className="bg-card border border-border rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate tracking-tight">{item.name}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded border border-border font-mono text-muted-foreground">{item.sku}</span>
                  {isWeighted && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Weighed</span>}
                  <span className="text-[10px] text-muted-foreground">
                    {formatCurrency(item.price)}{isWeighted ? ' / kg' : ' each'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeFromCart(item.productId)}
                aria-label="Remove item"
                className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center text-red-500 shrink-0 active:scale-95 transition-transform"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="flex items-center justify-between mt-3 gap-2">
              <div className="flex items-center gap-1 p-1 bg-secondary rounded-xl border border-border">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - step)}
                  aria-label="Decrease"
                  className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-foreground active:scale-95 transition-transform"
                >
                  <Minus size={14} />
                </button>

                {isWeighted ? (
                  <div className="flex items-center gap-1 px-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      step={step}
                      min={step}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.productId, parseFloat(e.target.value) || step)}
                      className="w-14 text-center text-sm font-bold tabular-nums bg-transparent focus:outline-none text-foreground"
                    />
                    <span className="text-[10px] font-bold text-muted-foreground">kg</span>
                  </div>
                ) : (
                  <span className="w-9 text-center text-sm font-bold tabular-nums text-foreground">{item.quantity}</span>
                )}

                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + step)}
                  disabled={item.quantity >= item.stock}
                  aria-label="Increase"
                  className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-foreground active:scale-95 transition-transform disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="text-right">
                <p className="text-base font-bold tracking-tight tabular-nums text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                <p className={cn(
                  'text-[9px] font-bold uppercase tracking-wider',
                  item.stock < (isWeighted ? step * 4 : 10) ? 'text-destructive' : 'text-muted-foreground',
                )}>
                  {isWeighted ? `${item.stock} kg left` : `${item.stock} in stock`}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

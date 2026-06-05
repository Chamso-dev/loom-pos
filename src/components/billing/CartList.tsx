import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store/useStore'
import { formatCurrency, cn } from '@/lib/utils'

export default function CartList() {
  const { cart, removeFromCart, updateQuantity } = useStore()

  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-accent/10 rounded-3xl border-2 border-dashed border-border/60 p-12">
        <ShoppingBag size={64} className="mb-4 opacity-10" />
        <h3 className="text-xl font-bold tracking-tight opacity-40">Your cart is empty</h3>
        <p className="text-sm opacity-30 mt-2">Scan a product to start billing!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar font-sans">
      {cart.map((item) => (
        <div 
          key={item.id} 
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-md hover:border-border hover:bg-accent/15 transition-all shadow-none"
        >
          {/* Item Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm font-semibold text-foreground truncate tracking-tight uppercase">
                {item.name}
              </span>
              <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded border border-border font-mono text-muted-foreground">
                {item.sku}
              </span>
              {item.size && (
                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                  {item.size}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="font-semibold text-muted-foreground">{formatCurrency(item.price)} each</span>
              <span className="text-muted-foreground/60">GST: {item.gst}%</span>
              <span className={cn(
                "font-bold uppercase tracking-wider text-[8px]",
                item.stock < 10 ? "text-destructive" : "text-primary opacity-65"
              )}>
                {item.stock} in stock
              </span>
            </div>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center gap-1 p-0.5 bg-secondary/80 rounded border border-border shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 hover:bg-card rounded text-muted-foreground hover:text-foreground"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
            >
              <Minus size={12} />
            </Button>
            <span className="w-6 text-center text-xs font-bold tabular-nums text-foreground">{item.quantity}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 hover:bg-card rounded text-muted-foreground hover:text-foreground"
              disabled={item.quantity >= item.stock}
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
            >
              <Plus size={12} />
            </Button>
          </div>

          {/* Subtotal & Action */}
          <div className="flex flex-col items-end gap-1 shrink-0 min-w-[90px]">
            <span className="text-sm font-bold tracking-tight tabular-nums text-foreground">
              {formatCurrency(item.price * item.quantity)}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-destructive hover:bg-destructive/10 rounded"
              onClick={() => removeFromCart(item.productId)}
            >
              <Trash2 size={12} className="opacity-70" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

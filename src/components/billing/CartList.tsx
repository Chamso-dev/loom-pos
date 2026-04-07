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
    <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
      {cart.map((item) => (
        <div 
          key={item.id} 
          className="group flex items-center gap-4 p-4 bg-card/40 border border-border/40 rounded-2xl hover:border-primary/40 hover:bg-card/60 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5 group"
        >
          {/* Item Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-bold text-foreground truncate tracking-tight uppercase">
                {item.name}
              </span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border/40 font-mono opacity-60">
                {item.sku}
              </span>
              {item.size && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black">
                  {item.size}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="font-bold text-muted-foreground opacity-80">{formatCurrency(item.price)} each</span>
              <span className="text-muted-foreground/60">GST: {item.gst}%</span>
              <span className={cn(
                "font-black uppercase tracking-widest text-[9px]",
                item.stock < 10 ? "text-destructive" : "text-primary opacity-60"
              )}>
                {item.stock} in stock
              </span>
            </div>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center gap-1.5 p-1 bg-accent/30 rounded-xl border border-border/40 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-background rounded-lg text-muted-foreground"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
            >
              <Minus size={14} />
            </Button>
            <span className="w-8 text-center text-sm font-black tabular-nums">{item.quantity}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-background rounded-lg text-muted-foreground"
              disabled={item.quantity >= item.stock}
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
            >
              <Plus size={14} />
            </Button>
          </div>

          {/* Subtotal & Action */}
          <div className="flex flex-col items-end gap-2 shrink-0 min-w-[100px]">
            <span className="text-lg font-black tracking-tight tabular-nums">
              {formatCurrency(item.price * item.quantity)}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10 rounded-lg"
              onClick={() => removeFromCart(item.productId)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

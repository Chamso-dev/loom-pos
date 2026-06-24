import { useState, useRef, useEffect } from 'react'
import { Bell, Search, User, Package, Receipt, Loader2, X, Sun, Moon, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { useGlobalSearch } from '@/hooks/useGlobalSearch'
import { cn } from '@/lib/utils'

type Panel = 'search' | 'notifications' | 'profile' | null

/**
 * Compact mobile top app bar. Brand on the left; search / notifications /
 * profile actions on the right, each opening a full-width mobile panel.
 * All behaviour (global search, low-stock alerts, theme, logout) is unchanged
 * from the previous desktop header — only the layout is mobile-first.
 */
export default function Header() {
  const [panel, setPanel] = useState<Panel>(null)
  const { lowStockProducts, user, settings, logout, setTheme, theme } = useStore()
  const { query, setQuery, results, isLoading } = useGlobalSearch()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (panel === 'search') setTimeout(() => inputRef.current?.focus(), 50)
  }, [panel])

  // Lock body scroll while a panel is open.
  useEffect(() => {
    document.body.style.overflow = panel ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [panel])

  const close = () => { setPanel(null); setQuery('') }

  const handleSelect = (item: any) => {
    close()
    if (item.type === 'product') navigate(`/inventory?search=${item.data.sku}`)
    else navigate(`/orders?orderId=${item.id}`)
  }

  const renderBrand = () => {
    const name = settings?.name || 'LOOMPOS'
    const splitIdx = name.indexOf(' ') !== -1
      ? name.indexOf(' ')
      : (name.toLowerCase().startsWith('loom') ? 4 : Math.min(4, Math.ceil(name.length / 2)))
    return (
      <>
        <span className="text-primary">{name.slice(0, splitIdx)}</span>
        <span className="text-foreground">{name.slice(splitIdx)}</span>
      </>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-40 pt-safe glass-nav border-b border-border/60 font-sans">
        <div className="h-14 flex items-center justify-between px-4">
          <button onClick={() => navigate('/')} className="font-bold text-lg tracking-tight active:scale-95 transition-transform">
            {renderBrand()}
          </button>

          <div className="flex items-center gap-1">
            <IconButton onClick={() => setPanel('search')} aria-label="Search">
              <Search size={19} />
            </IconButton>
            <IconButton onClick={() => setPanel('notifications')} aria-label="Notifications">
              <Bell size={19} />
              {lowStockProducts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-card animate-pulse" />
              )}
            </IconButton>
            <button
              onClick={() => setPanel('profile')}
              aria-label="Profile"
              className="ml-0.5 w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground font-semibold text-xs uppercase active:scale-95 transition-transform"
            >
              {user?.name?.charAt(0) || <User size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Search overlay */}
      {panel === 'search' && (
        <Overlay onClose={close} align="top">
          <div className="bg-card border-b border-border pt-safe" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, orders..."
                  className="w-full bg-accent/20 border border-border h-11 pl-10 pr-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
              <button onClick={close} className="px-3 h-11 text-sm font-semibold text-muted-foreground active:scale-95">Cancel</button>
            </div>
            {(query.length >= 2 || isLoading) && (
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar px-3 pb-4">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <p className="text-[9px] uppercase font-bold tracking-widest opacity-40">Searching...</p>
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent active:bg-accent transition-all text-left"
                      >
                        <div className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center border shrink-0',
                          item.type === 'product' ? 'bg-secondary text-foreground border-border' : 'bg-secondary text-emerald-500 border-border',
                        )}>
                          {item.type === 'product' ? <Package size={15} /> : <Receipt size={15} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm tracking-tight text-foreground truncate">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">{item.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Search size={24} className="text-muted-foreground opacity-20 mb-2" />
                    <p className="text-xs font-semibold opacity-40">No records found for "{query}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Overlay>
      )}

      {/* Notifications sheet */}
      {panel === 'notifications' && (
        <Sheet onClose={close} title="Restock Alerts" badge={lowStockProducts.length > 0 ? `${lowStockProducts.length} items` : undefined}>
          {lowStockProducts.length > 0 ? (
            <div className="space-y-1">
              {lowStockProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => { close(); navigate(`/inventory?search=${product.sku}`) }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent active:bg-accent transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10 shrink-0">
                    <Package size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase">{product.sku}</p>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                      <p className="text-[10px] font-bold text-orange-500">Stock: {product.stock}</p>
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { close(); navigate('/inventory') }}
                className="w-full mt-2 p-3 text-[10px] uppercase font-black tracking-widest text-primary bg-accent/40 rounded-xl active:scale-[0.99]"
              >
                View All Inventory
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
                <Bell size={20} />
              </div>
              <p className="text-xs font-bold opacity-50 uppercase tracking-wider">Stock Levels Normal</p>
            </div>
          )}
        </Sheet>
      )}

      {/* Profile sheet */}
      {panel === 'profile' && (
        <Sheet onClose={close} title="Account">
          <div className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-accent/30 border border-border/60">
            <div className="w-11 h-11 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground font-semibold uppercase">
              {user?.name?.charAt(0) || '?'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{user?.role}</p>
            </div>
          </div>
          <div className="space-y-1">
            {user?.role === 'ADMIN' && (
              <SheetRow icon={<SettingsIcon size={17} />} label="Settings" onClick={() => { close(); navigate('/settings') }} />
            )}
            <SheetRow
              icon={theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />
            <SheetRow icon={<LogOut size={17} />} label="Log Out" destructive onClick={() => { close(); logout(); navigate('/login') }} />
          </div>
        </Sheet>
      )}
    </>
  )
}

function IconButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="relative w-10 h-10 rounded-full flex items-center justify-center text-foreground/80 active:bg-accent active:scale-95 transition-all"
    >
      {children}
    </button>
  )
}

function Overlay({ children, onClose, align = 'center' }: { children: React.ReactNode; onClose: () => void; align?: 'center' | 'top' }) {
  return (
    <div
      onClick={onClose}
      className={cn(
        'fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 flex',
        align === 'top' ? 'items-start' : 'items-center justify-center p-4',
      )}
    >
      {align === 'top' ? <div className="w-full">{children}</div> : children}
    </div>
  )
}

function Sheet({ children, onClose, title, badge }: { children: React.ReactNode; onClose: () => void; title: string; badge?: string }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 flex items-end">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-card border-t border-border rounded-t-2xl pb-safe animate-in slide-in-from-bottom duration-200 max-h-[80vh] flex flex-col"
      >
        <div className="flex justify-center pt-2.5"><div className="w-9 h-1 rounded-full bg-muted-foreground/25" /></div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
            {badge && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">{badge}</span>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent">
            <X size={16} />
          </button>
        </div>
        <div className="px-3 pb-4 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  )
}

function SheetRow({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left text-sm font-medium active:scale-[0.99]',
        destructive ? 'text-red-500 active:bg-red-500/10' : 'text-foreground/90 active:bg-accent',
      )}
    >
      <span className={destructive ? 'text-red-500' : 'text-muted-foreground'}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Bell, Search, User, Package, Receipt, Loader2, X, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { useGlobalSearch } from '@/hooks/useGlobalSearch'
import { cn } from '@/lib/utils'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const { lowStockProducts, user, logout, setTheme, theme } = useStore()
  
  const { query, setQuery, results, isLoading } = useGlobalSearch()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setShowNotifications(false)
        setShowProfileMenu(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Search dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
      }
      // Profile menu
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const handleSelect = (item: any) => {
    setIsOpen(false)
    setQuery('')
    if (item.type === 'product') {
      navigate(`/inventory?search=${item.data.sku}`)
    } else {
      navigate(`/orders?orderId=${item.id}`)
    }
  }

  return (
    <header className="h-20 flex items-center justify-between px-8 bg-background/40 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 transition-all duration-300">
      <div className="flex-1 flex items-center max-w-xl relative">
        <div className="relative w-full group">
          <Search className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-all duration-300",
            isOpen ? "text-primary scale-110" : "group-focus-within:text-primary"
          )} />
          <input 
            ref={inputRef}
            type="text" 
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search products, orders... (Press /)"
            className="w-full bg-accent/30 border border-border/50 h-12 pl-12 pr-12 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/60 font-medium"
          />
          {query && (
            <button 
              onClick={() => { setQuery(''); setIsOpen(false); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Global Search Results Dropdown */}
        {isOpen && (query.length >= 2 || isLoading) && (
          <div 
            ref={dropdownRef}
            className="absolute top-16 left-0 w-full bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-[2rem] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="max-h-[min(70vh,500px)] overflow-y-auto p-4 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-40">Searching Archives...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-6">
                  {/* Products Section */}
                  {results.filter(r => r.type === 'product').length > 0 && (
                    <div className="space-y-2">
                       <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em] pl-3 mb-3">Products</h3>
                       <div className="space-y-1">
                         {results.filter(r => r.type === 'product').map(item => (
                           <button
                             key={item.id}
                             onClick={() => handleSelect(item)}
                             className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-primary/10 transition-all group text-left"
                           >
                             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                               <Package size={18} />
                             </div>
                             <div>
                               <p className="font-bold text-sm tracking-tight">{item.title}</p>
                               <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.subtitle}</p>
                             </div>
                           </button>
                         ))}
                       </div>
                    </div>
                  )}

                  {/* Orders Section */}
                  {results.filter(r => r.type === 'order').length > 0 && (
                    <div className="space-y-2">
                       <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em] pl-3 mb-3">Orders</h3>
                       <div className="space-y-1">
                         {results.filter(r => r.type === 'order').map(item => (
                           <button
                             key={item.id}
                             onClick={() => handleSelect(item)}
                             className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-emerald-500/10 transition-all group text-left"
                           >
                             <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                               <Receipt size={18} />
                             </div>
                             <div>
                               <p className="font-bold text-sm tracking-tight">{item.title}</p>
                               <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.subtitle}</p>
                             </div>
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search size={32} className="text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm font-bold opacity-40">No records found for "{query}"</p>
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-20 mt-1">Try another keyword</p>
                </div>
              )}
            </div>
            {results.length > 0 && (
              <div className="p-3 bg-accent/50 border-t border-border/40 text-center">
                <p className="text-[9px] uppercase font-black text-muted-foreground/60 tracking-widest">
                  Found {results.length} total results
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              "p-2.5 rounded-xl text-muted-foreground transition-all border border-transparent hover:border-border",
              showNotifications ? "bg-accent text-foreground border-border" : "hover:bg-accent hover:text-foreground"
            )}
          >
            <Bell size={20} />
            {lowStockProducts.length > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background shadow-lg shadow-primary/30 animate-pulse"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-14 right-0 w-80 bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-[2rem] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
               <div className="p-5 border-b border-border/40 bg-accent/10 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest italic">Restock Alerts</h3>
                  {lowStockProducts.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black">{lowStockProducts.length} Items</span>
                  )}
               </div>
               
               <div className="max-h-[min(70vh,400px)] overflow-y-auto p-2 custom-scrollbar">
                  {lowStockProducts.length > 0 ? (
                    <div className="space-y-1">
                       {lowStockProducts.map(product => (
                         <button
                           key={product.id}
                           onClick={() => {
                             setShowNotifications(false)
                             navigate(`/inventory?search=${product.sku}`)
                           }}
                           className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/5 transition-all group text-left border border-transparent hover:border-primary/20"
                         >
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10 group-hover:bg-orange-500 group-hover:text-white transition-all">
                               <Package size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="font-bold text-sm tracking-tight truncate">{product.name}</p>
                               <div className="flex items-center gap-1.5">
                                  <p className="text-[10px] text-muted-foreground font-medium uppercase">{product.sku}</p>
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                                  <p className="text-[10px] font-black text-orange-500">Stock: {product.stock}</p>
                               </div>
                            </div>
                         </button>
                       ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                       <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
                          <Bell size={24} />
                       </div>
                       <p className="text-sm font-bold opacity-40 italic uppercase tracking-tighter">Inventory Levels Normal</p>
                       <p className="text-[9px] uppercase font-bold text-muted-foreground mt-1 tracking-widest">All products are well stocked</p>
                    </div>
                  )}
               </div>

               {lowStockProducts.length > 0 && (
                 <button 
                  onClick={() => { setShowNotifications(false); navigate('/inventory'); }}
                  className="w-full p-4 text-[10px] uppercase font-black tracking-widest text-primary hover:bg-primary/5 transition-colors border-t border-border/40"
                 >
                    View All Inventory
                 </button>
               )}
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={cn(
              "flex items-center gap-2 pl-1 pr-1 py-1 rounded-xl transition-all border border-transparent text-muted-foreground hover:text-foreground group text-left",
              showProfileMenu ? "bg-accent border-border" : "hover:bg-accent hover:border-border"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
              <User size={20} />
            </div>
            {user && (
              <div className="hidden lg:block">
                 <p className="text-xs font-black uppercase tracking-tighter truncate leading-none">{user.name}</p>
                 <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{user.role}</p>
              </div>
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute top-14 right-0 w-56 bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-[2rem] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
               <div className="p-5 border-b border-border/40 bg-accent/10">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Account</p>
                  <p className="font-bold text-sm tracking-tight truncate">{user?.name}</p>
               </div>

               <div className="p-2 space-y-1">
                  <button 
                    onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/5 transition-all group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                       <Package size={16} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">Settings</span>
                  </button>

                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/5 transition-all group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                       {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">
                       {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </button>

                  <div className="h-px bg-border/40 mx-2 my-1"></div>

                  <button 
                    onClick={() => { logout(); navigate('/login'); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-red-500/10 transition-all group text-left"
                  >

                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                       <X size={16} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-red-500">Log Out</span>
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}




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
    <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border sticky top-0 z-40 font-sans">
      <div className="flex-1 flex items-center max-w-xl relative">
        <div className="relative w-full group">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-all",
            isOpen ? "text-primary scale-105" : "group-focus-within:text-primary"
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
            className="w-full bg-accent/20 border border-border h-10 pl-10 pr-10 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/60 font-medium"
          />
          {query && (
            <button 
              onClick={() => { setQuery(''); setIsOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Global Search Results Dropdown */}
        {isOpen && (query.length >= 2 || isLoading) && (
          <div 
            ref={dropdownRef}
            className="absolute top-12 left-0 w-full bg-card border border-border shadow-lg rounded-md overflow-hidden z-50 animate-in fade-in duration-100"
          >
            <div className="max-h-[min(70vh,500px)] overflow-y-auto p-2 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <p className="text-[9px] uppercase font-bold tracking-widest opacity-40">Searching Archives...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-4">
                  {/* Products Section */}
                  {results.filter(r => r.type === 'product').length > 0 && (
                    <div className="space-y-1">
                       <h3 className="text-[9px] uppercase font-black text-muted-foreground tracking-wider pl-2 mb-2">Products</h3>
                       <div className="space-y-0.5">
                         {results.filter(r => r.type === 'product').map(item => (
                           <button
                             key={item.id}
                             onClick={() => handleSelect(item)}
                             className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-all group text-left"
                           >
                             <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-foreground border border-border group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                               <Package size={14} />
                             </div>
                             <div>
                               <p className="font-semibold text-xs tracking-tight text-foreground">{item.title}</p>
                               <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{item.subtitle}</p>
                             </div>
                           </button>
                         ))}
                       </div>
                    </div>
                  )}

                  {/* Orders Section */}
                  {results.filter(r => r.type === 'order').length > 0 && (
                    <div className="space-y-1">
                       <h3 className="text-[9px] uppercase font-black text-muted-foreground tracking-wider pl-2 mb-2">Orders</h3>
                       <div className="space-y-0.5">
                         {results.filter(r => r.type === 'order').map(item => (
                           <button
                             key={item.id}
                             onClick={() => handleSelect(item)}
                             className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-all group text-left"
                           >
                             <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-emerald-500 border border-border group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all">
                               <Receipt size={14} />
                             </div>
                             <div>
                               <p className="font-semibold text-xs tracking-tight text-foreground">{item.title}</p>
                               <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{item.subtitle}</p>
                             </div>
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Search size={24} className="text-muted-foreground opacity-20 mb-2" />
                  <p className="text-xs font-semibold opacity-40">No records found for "{query}"</p>
                </div>
              )}
            </div>
            {results.length > 0 && (
              <div className="p-2 bg-accent/40 border-t border-border text-center">
                <p className="text-[8px] uppercase font-bold text-muted-foreground/60 tracking-wider">
                  Found {results.length} total results
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              "p-2 rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
              showNotifications && "bg-accent text-foreground"
            )}
          >
            <Bell size={18} />
            {lowStockProducts.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border border-background shadow animate-pulse"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-12 right-0 w-80 bg-card border border-border shadow-lg rounded-md overflow-hidden z-50 animate-in fade-in duration-100">
               <div className="p-3 border-b border-border bg-accent/15 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-wider">Restock Alerts</h3>
                  {lowStockProducts.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold">{lowStockProducts.length} Items</span>
                  )}
               </div>
               
               <div className="max-h-[min(70vh,400px)] overflow-y-auto p-1.5 custom-scrollbar">
                  {lowStockProducts.length > 0 ? (
                    <div className="space-y-0.5">
                       {lowStockProducts.map(product => (
                          <button
                            key={product.id}
                            onClick={() => {
                              setShowNotifications(false)
                              navigate(`/inventory?search=${product.sku}`)
                            }}
                            className="w-full flex items-center gap-3 p-2.5 rounded hover:bg-accent transition-all group text-left"
                          >
                             <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                <Package size={14} />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs text-foreground truncate">{product.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                   <p className="text-[9px] text-muted-foreground uppercase">{product.sku}</p>
                                   <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                                   <p className="text-[9px] font-bold text-orange-500">Stock: {product.stock}</p>
                                </div>
                             </div>
                          </button>
                       ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                       <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
                          <Bell size={18} />
                       </div>
                       <p className="text-xs font-bold opacity-40 uppercase tracking-wider">Stock Levels Normal</p>
                       <p className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5 tracking-wider">All products are well stocked</p>
                    </div>
                  )}
               </div>

               {lowStockProducts.length > 0 && (
                 <button 
                  onClick={() => { setShowNotifications(false); navigate('/inventory'); }}
                  className="w-full p-3 text-[9px] uppercase font-black tracking-widest text-primary hover:bg-accent transition-colors border-t border-border"
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
              "flex items-center gap-2 p-1.5 rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-accent group text-left",
              showProfileMenu && "bg-accent border-border"
            )}
          >
            <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center text-foreground border border-border group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
              <User size={14} />
            </div>
            {user && (
              <div className="hidden lg:block text-left leading-none">
                 <p className="text-xs font-bold text-foreground">{user.name}</p>
                 <p className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">{user.role}</p>
              </div>
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute top-12 right-0 w-48 bg-card border border-border shadow-lg rounded-md overflow-hidden z-50 animate-in fade-in duration-100">
               <div className="p-3.5 border-b border-border bg-accent/10">
                  <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-wider mb-0.5">Account</p>
                  <p className="font-semibold text-xs truncate text-foreground">{user?.name}</p>
               </div>

               <div className="p-1 space-y-0.5">
                  <button 
                    onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-accent transition-all group text-left text-xs font-medium text-foreground/80 hover:text-foreground"
                  >
                     <Package size={14} className="text-muted-foreground" />
                     <span>Settings</span>
                  </button>

                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-accent transition-all group text-left text-xs font-medium text-foreground/80 hover:text-foreground"
                  >
                     {theme === 'dark' ? <Sun size={14} className="text-muted-foreground" /> : <Moon size={14} className="text-muted-foreground" />}
                     <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>

                  <div className="h-px bg-border my-1"></div>

                  <button 
                    onClick={() => { logout(); navigate('/login'); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-red-500/5 text-red-500 transition-all group text-left text-xs font-medium"
                  >
                     <X size={14} />
                     <span>Log Out</span>
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}




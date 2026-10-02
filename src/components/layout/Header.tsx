import { useState, useRef, useEffect } from 'react'
import { Bell, Search, User, Package, Receipt, Loader2, X, Sun, Moon, Settings, Menu, CalendarClock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import LanguageSwitcher from './LanguageSwitcher'
import ExpiryBadge from '@/components/inventory/ExpiryBadge'
import { expiryStatus } from '@/lib/domain'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const { lowStockProducts, expiringProducts, user, logout, setTheme, theme, setMobileNavOpen } = useStore()
  const hasExpiryProblem = expiringProducts.some((p) => expiryStatus(p.expiryDate)?.state === 'expired')
  const { t, qty, money, code } = useI18n()

  const { query, setQuery, results, isLoading } = useGlobalSearch()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName ?? '').toUpperCase())
      if (e.key === '/' && !typing) {
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target) && !inputRef.current?.contains(target)) setIsOpen(false)
      if (profileRef.current && !profileRef.current.contains(target)) setShowProfileMenu(false)
      if (notificationsRef.current && !notificationsRef.current.contains(target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false)
    setQuery('')
    if (item.type === 'product') navigate(`/inventory?search=${encodeURIComponent(item.data.sku)}`)
    else navigate(`/orders?orderId=${item.id}`)
  }

  const productHits = results.filter((r): r is Extract<SearchResult, { type: 'product' }> => r.type === 'product')
  const orderHits = results.filter((r): r is Extract<SearchResult, { type: 'order' }> => r.type === 'order')

  return (
    <header className="h-16 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 bg-card border-b border-border sticky top-0 z-30 font-sans print:hidden">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label={t('nav.expand')}
        className="md:hidden shrink-0 p-2 -ms-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 min-w-0 flex items-center max-w-xl relative">
        <div className="relative w-full group">
          <Search
            className={cn(
              'absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-all',
              isOpen ? 'text-link' : 'group-focus-within:text-link'
            )}
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={t('layout.searchPlaceholder')}
            aria-label={t('common.search')}
            className="w-full bg-accent/20 border border-border h-10 ps-10 pe-10 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/70 font-medium"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                setIsOpen(false)
              }}
              aria-label={t('common.clearFilters')}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {isOpen && (query.length >= 2 || isLoading) && (
          <div ref={dropdownRef} className="absolute top-12 start-0 w-full bg-card border border-border shadow-lg rounded-md overflow-hidden z-50">
            <div className="max-h-[min(70vh,500px)] overflow-y-auto p-2 custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-xs">{t('layout.searching')}</p>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-4">
                  {productHits.length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-muted-foreground ps-2 mb-1">{t('layout.resultsProducts')}</h3>
                      {productHits.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-all text-start"
                        >
                          <div className="w-8 h-8 shrink-0 rounded bg-secondary flex items-center justify-center text-foreground border border-border">
                            <Package size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate"><bdi>{item.data.name}</bdi></p>
                            <p className="text-xs text-muted-foreground">
                              {t('layout.productSubtitle', { sku: code(item.data.sku), stock: qty(item.data.stock, item.data.unit) })}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {orderHits.length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-muted-foreground ps-2 mb-1">{t('layout.resultsOrders')}</h3>
                      {orderHits.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-all text-start"
                        >
                          <div className="w-8 h-8 shrink-0 rounded bg-secondary flex items-center justify-center text-emerald-600 border border-border">
                            <Receipt size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground">{code(item.data.invoiceNo)}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('layout.orderSubtitle', {
                                customer: item.data.customerName || t('common.walkIn'),
                                amount: money(item.data.totalAmount),
                              })}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('layout.noResults', { query })}</p>
              )}
            </div>
            {results.length > 0 && (
              <p className="p-2 bg-accent/40 border-t border-border text-center text-xs text-muted-foreground">
                {t('layout.resultCount', { count: results.length })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <LanguageSwitcher compact />

        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={t('layout.notifications')}
            aria-expanded={showNotifications}
            className={cn(
              'relative p-2 rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground',
              showNotifications && 'bg-accent text-foreground'
            )}
          >
            <Bell size={18} />
            {(lowStockProducts.length > 0 || expiringProducts.length > 0) && (
              <span className={cn('absolute top-2 end-2 w-2 h-2 rounded-full border border-background', hasExpiryProblem ? 'bg-loss' : 'bg-amber-500')} />
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-12 end-0 w-[min(20rem,calc(100vw-1.5rem))] bg-card border border-border shadow-lg rounded-md overflow-hidden z-50">
              <div className="p-3 border-b border-border bg-accent/15 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('layout.notifications')}</h3>
              </div>
              <div className="max-h-[min(70vh,400px)] overflow-y-auto p-1.5 custom-scrollbar">
                {expiringProducts.length > 0 && (
                  <section aria-label={t('layout.expiryTitle')} className="mb-1.5 border-b border-border pb-1.5">
                    <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
                      <h4 className="text-xs font-semibold text-muted-foreground">{t('layout.expiryTitle')}</h4>
                      <span className="text-xs font-semibold text-muted-foreground">{t('layout.expiryCount', { count: expiringProducts.length })}</span>
                    </div>
                    {expiringProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setShowNotifications(false)
                          navigate('/inventory?expiring=1')
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded hover:bg-accent transition-all text-start"
                      >
                        <div className="w-8 h-8 shrink-0 rounded bg-secondary flex items-center justify-center text-muted-foreground">
                          <CalendarClock size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate"><bdi>{product.name}</bdi></p>
                          <ExpiryBadge value={product.expiryDate} onlyWarnings className="mt-0.5" />
                        </div>
                      </button>
                    ))}
                  </section>
                )}
                {lowStockProducts.length > 0 && (
                  <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
                    <h4 className="text-xs font-semibold text-muted-foreground">{t('layout.restockTitle')}</h4>
                    <span className="text-xs font-semibold text-muted-foreground">{t('layout.restockCount', { count: lowStockProducts.length })}</span>
                  </div>
                )}
                {lowStockProducts.length > 0 ? (
                  lowStockProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setShowNotifications(false)
                        navigate(`/inventory?search=${encodeURIComponent(product.sku)}`)
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded hover:bg-accent transition-all text-start"
                    >
                      <div className="w-8 h-8 shrink-0 rounded bg-amber-500/10 flex items-center justify-center text-amber-600">
                        <Package size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate"><bdi>{product.name}</bdi></p>
                        <p className="text-xs text-muted-foreground">
                          {code(product.sku)}{' '}
                          <span className={cn('font-semibold', product.stock <= 0 ? 'text-red-600' : 'text-amber-700 dark:text-amber-400')}>
                            {t('layout.stockLeft', { stock: qty(product.stock, product.unit, true) })}
                          </span>
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm font-semibold">{t('layout.stockFine')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('layout.stockFineHint')}</p>
                  </div>
                )}
              </div>
              {lowStockProducts.length > 0 && (
                <button
                  onClick={() => {
                    setShowNotifications(false)
                    navigate('/inventory')
                  }}
                  className="w-full p-3 text-sm font-semibold text-link hover:bg-accent transition-colors border-t border-border"
                >
                  {t('layout.openInventory')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
            className={cn(
              'flex items-center gap-2 p-1.5 rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-accent text-start',
              showProfileMenu && 'bg-accent'
            )}
          >
            <div className="hidden sm:flex w-7 h-7 rounded bg-secondary items-center justify-center text-foreground border border-border">
              <User size={14} />
            </div>
            {user && (
              <div className="hidden lg:block leading-tight">
                <p className="text-xs font-bold text-foreground">{user.name}</p>
                <p className="text-[11px] text-muted-foreground">{t(`nav.roles.${user.role}`)}</p>
              </div>
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute top-12 end-0 w-52 bg-card border border-border shadow-lg rounded-md overflow-hidden z-50">
              <div className="p-3.5 border-b border-border bg-accent/10">
                <p className="text-xs text-muted-foreground mb-0.5">{t('layout.account')}</p>
                <p className="font-semibold text-sm truncate text-foreground">{user?.name}</p>
              </div>
              <div className="p-1 space-y-0.5">
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      navigate('/settings')
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-accent transition-all text-start text-sm text-foreground/80 hover:text-foreground"
                  >
                    <Settings size={14} className="text-muted-foreground" />
                    <span>{t('nav.settings')}</span>
                  </button>
                )}
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-accent transition-all text-start text-sm text-foreground/80 hover:text-foreground"
                >
                  {theme === 'dark' ? <Sun size={14} className="text-muted-foreground" /> : <Moon size={14} className="text-muted-foreground" />}
                  <span>{theme === 'dark' ? t('layout.lightMode') : t('layout.darkMode')}</span>
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded hover:bg-red-500/5 text-red-600 transition-all text-start text-sm"
                >
                  <X size={14} />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

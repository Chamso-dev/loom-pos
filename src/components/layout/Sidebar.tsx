import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  History,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Contact,
  Truck,
  PackagePlus,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { useI18n, type TKey } from '@/i18n'
import ThemeToggle from './ThemeToggle'
import { useIsPhone } from '@/hooks/useMediaQuery'
import Logo from '../ui/logo'

const NAV_ITEMS: Array<{ icon: typeof Package; label: TKey; href: string; adminOnly?: boolean }> = [
  { icon: LayoutDashboard, label: 'nav.dashboard', href: '/', adminOnly: true },
  { icon: ShoppingCart, label: 'nav.billing', href: '/billing' },
  { icon: History, label: 'nav.orders', href: '/orders' },
  { icon: Contact, label: 'nav.customers', href: '/customers' },
  { icon: Package, label: 'nav.inventory', href: '/inventory' },
  { icon: PackagePlus, label: 'nav.purchases', href: '/purchases', adminOnly: true },
  { icon: Truck, label: 'nav.suppliers', href: '/suppliers', adminOnly: true },
  { icon: BarChart3, label: 'nav.reports', href: '/reports', adminOnly: true },
  { icon: Users, label: 'nav.staff', href: '/staff', adminOnly: true },
  { icon: Settings, label: 'nav.settings', href: '/settings', adminOnly: true },
]

export default function Sidebar() {
  const location = useLocation()
  const { isSidebarOpen: desktopOpen, toggleSidebar, settings, user, logout, isMobileNavOpen, setMobileNavOpen } = useStore()
  const navigate = useNavigate()
  const { t } = useI18n()
  const isPhone = useIsPhone()
  // On a phone the menu is always shown in full; it slides in and out instead of collapsing.
  const isSidebarOpen = isPhone || desktopOpen

  const items = NAV_ITEMS.filter((item) => user && (user.role === 'ADMIN' || !item.adminOnly))
  const storeName = settings?.name || t('common.appName')
  // In a right-to-left layout the sidebar sits on the right, so the arrows swap.
  const CollapseIcon = isSidebarOpen ? ChevronLeft : ChevronRight

  return (
    <>
    {isPhone && isMobileNavOpen && (
      <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
    )}
    <aside
      aria-hidden={isPhone && !isMobileNavOpen ? true : undefined}
      // A closed phone menu cannot be reached by keyboard (React 18 needs inert as a string).
      {...(isPhone && !isMobileNavOpen ? ({ inert: '' } as Record<string, string>) : {})}
      className={cn(
        'fixed start-0 top-0 h-[100dvh] bg-card border-e border-border transition-all duration-200 z-50 print:hidden',
        isSidebarOpen ? 'w-64' : 'w-20',
        isPhone && !isMobileNavOpen && 'ltr:-translate-x-full rtl:translate-x-full'
      )}
    >
      <div className="flex flex-col h-full font-sans">
        <div className={cn('h-16 flex items-center justify-between border-b border-border px-6 gap-2', !isSidebarOpen && 'px-4')}>
          {isSidebarOpen ? (
            <span className="font-bold text-lg tracking-tight truncate">{storeName}</span>
          ) : (
            <Logo title={t('common.appName')} className="w-6 h-6 rounded shrink-0" />
          )}
          <button
            onClick={() => (isPhone ? setMobileNavOpen(false) : toggleSidebar())}
            aria-label={isSidebarOpen ? t('nav.collapse') : t('nav.expand')}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
          >
            <CollapseIcon size={16} className="rtl:rotate-180" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {items.map((item) => {
            const isActive = location.pathname === item.href
            const label = t(item.label)
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                title={isSidebarOpen ? undefined : label}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group relative text-sm font-medium',
                  isActive ? 'bg-secondary text-foreground' : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon size={18} className={cn('shrink-0', isActive ? 'text-primary' : 'group-hover:text-foreground')} />
                {isSidebarOpen && <span className="truncate">{label}</span>}
                {!isSidebarOpen && (
                  <span className="absolute start-14 bg-popover text-popover-foreground px-2.5 py-1 rounded border border-border text-xs z-50 shadow-md hidden group-hover:block whitespace-nowrap">
                    {label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-3">
          {isSidebarOpen && <ThemeToggle />}
          <div className={cn('flex items-center gap-3 bg-accent/20 p-2 rounded-lg border border-border/50', !isSidebarOpen && 'justify-center')}>
            <div className="w-8 h-8 shrink-0 rounded-full bg-secondary flex items-center justify-center text-foreground font-semibold text-xs border border-border uppercase">
              {user?.name?.charAt(0) || '?'}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-semibold truncate text-foreground">{user?.name}</span>
                <span className="text-[11px] text-muted-foreground truncate">{user ? t(`nav.roles.${user.role}`) : ''}</span>
              </div>
            )}
            {isSidebarOpen && (
              <button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="ms-auto p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md transition-all"
                title={t('nav.logout')}
                aria-label={t('nav.logout')}
              >
                <LogOut size={14} className="rtl:-scale-x-100" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}

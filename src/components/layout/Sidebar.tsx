import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { useT } from '@/lib/i18n'
import { NAV_ITEMS } from './navItems'

/**
 * Persistent left navigation rail for tablet / desktop widths (md+). Lives in
 * the global Shell and is always mounted, so it never depends on the current
 * route. On phones it is hidden (display:none) and the BottomNav takes over.
 * Same destinations and role-based visibility as the bottom nav.
 */
export default function Sidebar() {
  const location = useLocation()
  const { user } = useStore()
  const t = useT()

  const items = NAV_ITEMS.filter((item) => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return (item.roles as readonly string[]).includes(user.role)
  })

  const name = user?.name || 'Administrator'

  return (
    <aside className="hidden md:flex shrink-0 w-60 flex-col border-r border-border bg-card pt-safe pb-safe">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b border-border/70">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
          L
        </div>
        <span className="text-base font-bold tracking-tight text-foreground">
          Loom<span className="text-muted-foreground">POS</span>
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-1 px-3 py-4">
        {items.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 select-none active:scale-[0.98] transition-transform"
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarActive"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/15"
                />
              )}
              <item.icon
                size={19}
                strokeWidth={isActive ? 2.4 : 1.9}
                className={cn('relative z-10 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}
              />
              <span
                className={cn(
                  'relative z-10 text-sm font-semibold tracking-tight transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {t(item.key)}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-border/70 px-4 py-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground uppercase">
          {name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{user?.role === 'ADMIN' ? 'Administrator' : 'Cashier'}</p>
        </div>
      </div>
    </aside>
  )
}

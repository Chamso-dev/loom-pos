import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { useT } from '@/lib/i18n'
import { NAV_ITEMS } from './navItems'

/**
 * Bottom navigation bar — primary navigation on PHONES (hidden on md+, where
 * the persistent Sidebar takes over). Same destinations and role-based
 * visibility as the sidebar. Glass styling with an animated active pill and
 * bottom safe-area padding for gesture-nav / notched devices.
 */
export default function BottomNav() {
  const location = useLocation()
  const { user } = useStore()
  const t = useT()

  const items = NAV_ITEMS.filter((item) => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return (item.roles as readonly string[]).includes(user.role)
  })

  return (
    <nav className="md:hidden shrink-0 z-40 pb-safe glass-nav border-t border-border/70 shadow-[0_-8px_24px_-14px_rgba(0,0,0,0.35)]">
      <div className="flex items-stretch justify-around px-1.5 pt-1.5 pb-1">
        {items.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-label={t(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 min-h-[52px] select-none touch-manipulation active:scale-95 transition-transform"
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavActive"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/15"
                />
              )}
              <span className="relative z-10 flex flex-col items-center gap-0.5">
                <item.icon
                  size={21}
                  strokeWidth={isActive ? 2.4 : 1.9}
                  className={cn(
                    'transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    'text-[9.5px] font-semibold tracking-tight leading-none transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {t(item.key)}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

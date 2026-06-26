import { LayoutDashboard, Package, ShoppingCart, History, Settings, Contact } from 'lucide-react'

/** Single source of truth for primary navigation — shared by the bottom nav
 *  (phones) and the side rail (tablet / desktop) so they never drift. */
export const NAV_ITEMS = [
  { icon: LayoutDashboard, key: 'nav.home', href: '/', roles: ['ADMIN'] },
  { icon: Package, key: 'nav.stock', href: '/inventory', roles: ['ADMIN', 'CASHIER'] },
  { icon: ShoppingCart, key: 'nav.billing', href: '/billing', roles: ['ADMIN', 'CASHIER'] },
  { icon: History, key: 'nav.orders', href: '/orders', roles: ['ADMIN', 'CASHIER'] },
  { icon: Contact, key: 'nav.manage', href: '/management', roles: ['ADMIN'] },
  { icon: Settings, key: 'nav.settings', href: '/settings', roles: ['ADMIN'] },
] as const

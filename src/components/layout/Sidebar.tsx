import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: Package, label: 'Inventory', href: '/inventory' },
  { icon: ShoppingCart, label: 'Billing', href: '/billing' },
  { icon: History, label: 'Orders', href: '/orders' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

export default function Sidebar() {
  const location = useLocation()
  const { isSidebarOpen, toggleSidebar, settings } = useStore()
  const storeName = settings?.name || 'LOOMPOS'

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border transition-all duration-300 z-50",
        isSidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          {isSidebarOpen && (
            <span className="font-bold text-xl tracking-tight text-primary">
              {storeName.slice(0, 4)}<span className="text-foreground">{storeName.slice(4)}</span>
            </span>
          )}
          <button 
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors border border-transparent hover:border-border"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-4 px-3 py-3 rounded-xl transition-all group relative",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon size={22} className={cn(isActive ? "text-inherit" : "group-hover:text-primary")} />
                {isSidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
                {!isSidebarOpen && (
                  <div className="absolute left-14 bg-popover text-popover-foreground px-2 py-1 rounded md:hidden group-hover:block whitespace-nowrap shadow-xl border border-border text-xs z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-border space-y-4">
          {isSidebarOpen && <ThemeToggle />}
          
          <div className={cn(
            "flex items-center gap-3 bg-accent/40 p-2 rounded-xl border border-border/40",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden border border-primary/30">
              M
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate">The Merlin</span>
                <span className="text-[10px] text-muted-foreground truncate uppercase tracking-widest">Admin</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

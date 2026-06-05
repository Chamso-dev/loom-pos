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
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import ThemeToggle from './ThemeToggle'


export default function Sidebar() {
  const location = useLocation()
  const { isSidebarOpen, toggleSidebar, settings, user, logout } = useStore()
  const navigate = useNavigate()

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/', roles: ['ADMIN'] },
    { icon: Package, label: 'Inventory', href: '/inventory', roles: ['ADMIN', 'CASHIER'] },
    { icon: ShoppingCart, label: 'Billing', href: '/billing', roles: ['ADMIN', 'CASHIER'] },
    { icon: History, label: 'Orders', href: '/orders', roles: ['ADMIN', 'CASHIER'] },
    { icon: Users, label: 'Staff', href: '/staff', roles: ['ADMIN'] },
    { icon: Settings, label: 'Settings', href: '/settings', roles: ['ADMIN'] },
  ].filter(item => {
    if (!user) return false;
    // Admins see everything, Cashiers only see their allowed routes
    if (user.role === 'ADMIN') return true;
    return item.roles.includes(user.role);
  });

  const renderBrandName = () => {
    const name = settings?.name || 'LOOMPOS'
    const firstSpace = name.indexOf(' ')
    if (firstSpace !== -1) {
      return (
        <>
          <span className="text-primary">{name.slice(0, firstSpace)}</span>
          <span className="text-foreground">{name.slice(firstSpace)}</span>
        </>
      )
    }
    const splitIdx = name.toLowerCase().startsWith('loom') ? 4 : Math.min(4, Math.ceil(name.length / 2))
    return (
      <>
        <span className="text-primary">{name.slice(0, splitIdx)}</span>
        <span className="text-foreground">{name.slice(splitIdx)}</span>
      </>
    )
  }

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border transition-all duration-200 z-50",
        isSidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className="flex flex-col h-full font-sans">
        {/* Logo Section */}
        <div className={cn("h-16 flex items-center justify-between border-b border-border px-6", !isSidebarOpen && "px-4")}>
          {isSidebarOpen ? (
            <span className="font-bold text-lg tracking-tight">
              {renderBrandName()}
            </span>
          ) : (
            <img src="/favicon.svg" alt="LoomPOS Logo" className="w-6 h-6 rounded shrink-0 border border-border/40" />
          )}
          <button 
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-accent rounded-md transition-colors border border-transparent"
          >
            {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group relative text-sm font-medium",
                  isActive 
                    ? "bg-secondary text-foreground" 
                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon size={18} className={cn(isActive ? "text-primary" : "group-hover:text-foreground")} />
                {isSidebarOpen && (
                  <span>{item.label}</span>
                )}
                {!isSidebarOpen && (
                  <div className="absolute left-14 bg-popover text-popover-foreground px-2.5 py-1 rounded border border-border text-xs z-50 shadow-md hidden group-hover:block whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-border space-y-3">
          {isSidebarOpen && <ThemeToggle />}
          
          <div className={cn(
            "flex items-center gap-3 bg-accent/20 p-2 rounded-lg border border-border/50",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground font-semibold text-xs border border-border uppercase">
              {user?.name?.charAt(0) || '?'}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-semibold truncate text-foreground">{user?.name}</span>
                <span className="text-[9px] text-muted-foreground truncate uppercase tracking-wider">{user?.role}</span>
              </div>
            )}
            {isSidebarOpen && (
               <button 
                onClick={() => { logout(); navigate('/login'); }}
                className="ml-auto p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md transition-all"
                title="Logout"
               >
                  <LogOut size={14} />
               </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

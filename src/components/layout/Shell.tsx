import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'
import { useStore } from '@/store/useStore'
import { useEffect } from 'react'

interface ShellProps {
  children: React.ReactNode
}

export default function Shell({ children }: ShellProps) {
  const location = useLocation()
  const { isSidebarOpen, setSidebarOpen, theme } = useStore()
  
  const isBillingScreen = location.pathname === '/billing'

  // Apply theme
  useEffect(() => {
    const applyTheme = (t: 'dark' | 'light' | 'system') => {
      let resolvedTheme = t;
      if (t === 'system') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      if (resolvedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(theme);

    // Listener for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme])

  // Auto-hide sidebar on billing screen
  useEffect(() => {
    if (isBillingScreen) {
      setSidebarOpen(false)
    }
  }, [isBillingScreen, setSidebarOpen])

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary">
      {/* Sidebar - Always rendered so cashiers can switch tabs */}
      <Sidebar />

      {/* Main Content Area */}
      <div 
        className={cn(
          "transition-all duration-300 min-h-screen",
          isSidebarOpen ? "pl-64" : "pl-20"
        )}
      >
        <Header />
        <main className="relative z-10">
          <div className="max-w-[1600px] mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

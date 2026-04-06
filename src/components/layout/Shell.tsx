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
  const { isSidebarOpen, setSidebarOpen } = useStore()
  
  const isBillingScreen = location.pathname === '/billing'

  // Auto-hide sidebar on billing screen
  useEffect(() => {
    if (isBillingScreen) {
      setSidebarOpen(false)
    }
  }, [isBillingScreen, setSidebarOpen])

  return (
    <div className="min-h-screen bg-background font-outfit selection:bg-primary/20 selection:text-primary">
      {/* Sidebar - Hidden on billing screen per user requirement */}
      {!isBillingScreen && <Sidebar />}

      {/* Main Content Area */}
      <div 
        className={cn(
          "transition-all duration-300 min-h-screen",
          !isBillingScreen && (isSidebarOpen ? "pl-64" : "pl-20")
        )}
      >
        <Header />
        <main className="relative z-10">
          <div className="max-w-[1600px] mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
        
        {/* Subtle background decoration */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[150px] -z-10 rounded-full pointer-events-none"></div>
        <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 blur-[120px] -z-10 rounded-full pointer-events-none"></div>
      </div>
    </div>
  )
}

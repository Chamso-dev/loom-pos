import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'
import { useStore } from '@/store/useStore'

interface ShellProps {
  children: React.ReactNode
}

export default function Shell({ children }: ShellProps) {
  const location = useLocation()
  const { isSidebarOpen, setSidebarOpen } = useStore()
  const isBillingScreen = location.pathname === '/billing'

  // The till gets the full width.
  useEffect(() => {
    if (isBillingScreen) setSidebarOpen(false)
  }, [isBillingScreen, setSidebarOpen])

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Sidebar />
      <div className={cn('transition-all duration-300 min-h-screen print:ps-0', isSidebarOpen ? 'ps-64' : 'ps-20')}>
        <Header />
        <main className="relative z-10">
          <div className="max-w-[1600px] mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'
import { useStore } from '@/store/useStore'
import { useIsPhone, useMediaQuery } from '@/hooks/useMediaQuery'

interface ShellProps {
  children: React.ReactNode
}

export default function Shell({ children }: ShellProps) {
  const location = useLocation()
  const { isSidebarOpen, setSidebarOpen, setMobileNavOpen } = useStore()
  const isPhone = useIsPhone()
  const isBillingScreen = location.pathname === '/billing'
  // The dashboard sits on a gray canvas so its white cards stand out.
  const isDashboard = location.pathname === '/'

  // On a desktop the till gets the full width.
  useEffect(() => {
    if (isBillingScreen && !isPhone) setSidebarOpen(false)
  }, [isBillingScreen, isPhone, setSidebarOpen])

  // On a tablet the sidebar starts as the narrow icon rail, so lists and tables have room.
  // It can still be opened with its button.
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  useEffect(() => {
    if (isTablet) setSidebarOpen(false)
  }, [isTablet, setSidebarOpen])

  // On a phone the menu closes after choosing a page.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Sidebar />
      <div className={cn('transition-all duration-300 min-h-screen print:ps-0', isSidebarOpen ? 'md:ps-64' : 'md:ps-20')}>
        <Header />
        <main className={cn('relative z-10', isDashboard && 'sp-canvas')}>
          <div className="max-w-[1600px] mx-auto px-3 py-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'
import { useStore } from '@/store/useStore'
import { useIsPhone } from '@/hooks/useMediaQuery'

interface ShellProps {
  children: React.ReactNode
}

export default function Shell({ children }: ShellProps) {
  const location = useLocation()
  const { isSidebarOpen, setSidebarOpen, setMobileNavOpen } = useStore()
  const isPhone = useIsPhone()
  const isBillingScreen = location.pathname === '/billing'

  // On a desktop the till gets the full width.
  useEffect(() => {
    if (isBillingScreen && !isPhone) setSidebarOpen(false)
  }, [isBillingScreen, isPhone, setSidebarOpen])

  // On a phone the menu closes after choosing a page.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      <Sidebar />
      <div className={cn('transition-all duration-300 min-h-screen print:ps-0', isSidebarOpen ? 'md:ps-64' : 'md:ps-20')}>
        <Header />
        <main className="relative z-10">
          <div className="max-w-[1600px] mx-auto px-3 py-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import Header from './Header'
import BottomNav from './BottomNav'
import { useStore } from '@/store/useStore'

interface ShellProps {
  children: React.ReactNode
}

export default function Shell({ children }: ShellProps) {
  const { theme } = useStore()

  // Apply theme (dark / light / system).
  useEffect(() => {
    const applyTheme = (t: 'dark' | 'light' | 'system') => {
      const resolved = t === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t
      document.documentElement.classList.toggle('dark', resolved === 'dark')
    }

    applyTheme(theme)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => { if (theme === 'system') applyTheme('system') }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary">
      <Header />
      <main className="relative z-10 pb-nav">
        <div className="px-4 pt-4">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

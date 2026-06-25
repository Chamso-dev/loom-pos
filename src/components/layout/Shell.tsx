import { useEffect } from 'react'
import Header from './Header'
import BottomNav from './BottomNav'
import { useStore } from '@/store/useStore'

interface ShellProps {
  children: React.ReactNode
}

/**
 * Mobile app shell. A fixed full-height (100dvh) flex column with exactly one
 * bounded scroll region (`main`) sandwiched between the top app bar and the
 * bottom tab bar. Because the nav bars are flex siblings — not `fixed` overlays
 * over the document — content can never scroll underneath them, and the scroll
 * region always reaches its true end. This is the standard native-app shell
 * pattern (Square / Shopify POS, Linear, Revolut).
 */
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
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background font-sans selection:bg-primary/20 selection:text-primary">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar">
        <div className="px-4 pt-4 pb-8">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

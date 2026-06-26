import { useEffect } from 'react'
import Header from './Header'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { useStore } from '@/store/useStore'
import { applyLanguageDir } from '@/lib/i18n'

interface ShellProps {
  children: React.ReactNode
}

/**
 * Global app shell. Full-height (100dvh) flex ROW: a persistent left Sidebar
 * (tablet/desktop, md+) sits beside a content column. The content column is a
 * flex stack of the top app bar, exactly one bounded scroll region (`main`),
 * and the BottomNav (phones only, md:hidden). Both nav surfaces are flex
 * siblings — not overlays — so content never scrolls underneath them and the
 * scroll region always reaches its true end. Sidebar and BottomNav live here,
 * outside the routed pages, so navigation is persistent on every route and
 * never unmounts (Square / Shopify POS, Linear pattern).
 */
export default function Shell({ children }: ShellProps) {
  const { theme, language } = useStore()

  // Apply text direction (RTL for Arabic) on mount and language change.
  useEffect(() => { applyLanguageDir(language) }, [language])

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
    <div className="app-shell h-[100dvh] flex overflow-hidden bg-background font-sans selection:bg-primary/20 selection:text-primary">
      {/* Persistent side rail on tablet/desktop; hidden on phones. */}
      <Sidebar />
      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="app-main flex-1 min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar">
          <div className="px-4 pt-4 pb-8">
            {children}
          </div>
        </main>
        {/* Bottom tab bar on phones; replaced by the side rail on md+. */}
        <BottomNav />
      </div>
    </div>
  )
}

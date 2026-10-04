import { Suspense, useEffect } from 'react'
import { BrowserRouter, MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Shell from './components/layout/Shell'
import PageWrapper from './components/layout/PageWrapper'

import InventoryPage from './components/inventory/InventoryPage'
import BillingPage from './components/billing/BillingPage'
import OrderHistoryPage from './components/orders/OrderHistoryPage'
import SettingsPage from './components/settings/SettingsPage'
import StaffPage from './components/settings/StaffPage'
import CustomersPage from './components/customers/CustomersPage'
import SuppliersPage from './components/suppliers/SuppliersPage'
import PurchasesPage from './components/suppliers/PurchasesPage'
import ReportsPage from './components/reports/ReportsPage'
import LoginPage from './components/auth/LoginPage'
import AuthGuard from './components/auth/AuthGuard'
import ErrorBoundary from './components/ErrorBoundary'
import { useStore } from './store/useStore'
import { applyDocumentLanguage } from './i18n'
import { Dashboard } from './components/dashboard/lazyDashboard'

/** Keeps <html lang dir> and the dark class in step with the store. */
function useDocumentPreferences() {
  const language = useStore((s) => s.language)
  const theme = useStore((s) => s.theme)

  useEffect(() => applyDocumentLanguage(language), [language])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

const page = (element: React.ReactNode, requiredRole?: 'ADMIN') => (
  <AuthGuard requiredRole={requiredRole}>
    <Shell>
      <PageWrapper>{element}</PageWrapper>
    </Shell>
  </AuthGuard>
)

function AppContent() {
  const location = useLocation()
  const { fetchSettings, fetchLowStockAlerts, user } = useStore()
  useDocumentPreferences()

  useEffect(() => {
    fetchSettings()
    if (user) fetchLowStockAlerts()
  }, [user, fetchSettings, fetchLowStockAlerts])

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={page(
            <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
              <Dashboard />
            </Suspense>,
            'ADMIN'
          )}
        />
        <Route path="/billing" element={page(<BillingPage />)} />
        <Route path="/orders" element={page(<OrderHistoryPage />)} />
        <Route path="/customers" element={page(<CustomersPage />)} />
        <Route path="/inventory" element={page(<InventoryPage />)} />
        <Route path="/purchases" element={page(<PurchasesPage />, 'ADMIN')} />
        <Route path="/suppliers" element={page(<SuppliersPage />, 'ADMIN')} />
        <Route path="/reports" element={page(<ReportsPage />, 'ADMIN')} />
        <Route path="/settings" element={page(<SettingsPage />, 'ADMIN')} />
        <Route path="/staff" element={page(<StaffPage />, 'ADMIN')} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  // The single-file demo build keeps routes in memory: it runs inside a frame at a fixed URL.
  if (import.meta.env.VITE_ROUTER === 'memory') {
    return (
      <ErrorBoundary>
        <MemoryRouter initialEntries={['/login']}>
          <AppContent />
        </MemoryRouter>
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

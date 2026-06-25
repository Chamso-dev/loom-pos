import { BrowserRouter, Routes, Route, Navigate, useLocation, useOutlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Shell from './components/layout/Shell'

import InventoryPage from './components/inventory/InventoryPage'
import BillingPage from './components/billing/BillingPage'
import Dashboard from './components/dashboard/Dashboard'
import OrderHistoryPage from './components/orders/OrderHistoryPage'
import SettingsPage from './components/settings/SettingsPage'
import ManagementPage from './components/settings/ManagementPage'
import LoginPage from './components/auth/LoginPage'
import SignUpPage from './components/auth/SignUpPage'
import AuthGuard from './components/auth/AuthGuard'

import { useEffect } from 'react'
import { useStore } from './store/useStore'

/**
 * Animates only the routed content — a quick fade-in keyed on pathname. There
 * is no exit wait, so tab switches are instant (the new screen simply fades in
 * over ~140ms). The surrounding Shell (top bar + bottom nav) lives OUTSIDE this
 * and never remounts, which is what makes navigation feel native instead of a
 * full page reload.
 */
function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
    >
      {outlet}
    </motion.div>
  )
}

/**
 * Persistent app shell for all authenticated routes. Mounted once; child route
 * changes only swap the <Outlet/> content, so the header and bottom navigation
 * stay put across navigation.
 */
function ProtectedLayout() {
  const { user, token } = useStore()
  const location = useLocation()

  if (!user || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <Shell>
      <AnimatedOutlet />
    </Shell>
  )
}

function AppContent() {
  const { fetchSettings, fetchLowStockAlerts, user } = useStore()

  useEffect(() => {
    fetchSettings()
    if (user) fetchLowStockAlerts()
  }, [user])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<AuthGuard requiredRole="ADMIN"><Dashboard /></AuthGuard>} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/orders" element={<OrderHistoryPage />} />
        <Route path="/settings" element={<AuthGuard requiredRole="ADMIN"><SettingsPage /></AuthGuard>} />
        <Route path="/management" element={<AuthGuard requiredRole="ADMIN"><ManagementPage /></AuthGuard>} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App

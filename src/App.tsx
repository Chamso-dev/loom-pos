import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Shell from './components/layout/Shell'
import PageWrapper from './components/layout/PageWrapper'

import InventoryPage from './components/inventory/InventoryPage'
import BillingPage from './components/billing/BillingPage'
import Dashboard from './components/dashboard/Dashboard'
import OrderHistoryPage from './components/orders/OrderHistoryPage'
import SettingsPage from './components/settings/SettingsPage'
import StaffPage from './components/settings/StaffPage'
import LoginPage from './components/auth/LoginPage'
import AuthGuard from './components/auth/AuthGuard'

import { useEffect } from 'react'
import { useStore } from './store/useStore'

function AppContent() {
  const location = useLocation()
  const { fetchSettings, fetchLowStockAlerts, user } = useStore()

  useEffect(() => {
    fetchSettings()
    if (user) fetchLowStockAlerts()
  }, [user])

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/" element={
          <AuthGuard requiredRole="ADMIN">
            <Shell>
              <PageWrapper><Dashboard /></PageWrapper>
            </Shell>
          </AuthGuard>
        } />
        
        <Route path="/inventory" element={
          <AuthGuard>
            <Shell>
              <PageWrapper><InventoryPage /></PageWrapper>
            </Shell>
          </AuthGuard>
        } />
        
        <Route path="/billing" element={
          <AuthGuard>
            <Shell>
              <PageWrapper><BillingPage /></PageWrapper>
            </Shell>
          </AuthGuard>
        } />
        
        <Route path="/orders" element={
          <AuthGuard>
            <Shell>
              <PageWrapper><OrderHistoryPage /></PageWrapper>
            </Shell>
          </AuthGuard>
        } />
        
        <Route path="/settings" element={
          <AuthGuard requiredRole="ADMIN">
            <Shell>
              <PageWrapper><SettingsPage /></PageWrapper>
            </Shell>
          </AuthGuard>
        } />

        <Route path="/staff" element={
          <AuthGuard requiredRole="ADMIN">
            <Shell>
              <PageWrapper><StaffPage /></PageWrapper>
            </Shell>
          </AuthGuard>
        } />
      </Routes>
    </AnimatePresence>
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

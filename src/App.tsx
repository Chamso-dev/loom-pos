import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Shell from './components/layout/Shell'
import PageWrapper from './components/layout/PageWrapper'

import InventoryPage from './components/inventory/InventoryPage'
import BillingPage from './components/billing/BillingPage'
import Dashboard from './components/dashboard/Dashboard'
import OrderHistoryPage from './components/orders/OrderHistoryPage'

function AppContent() {
  const location = useLocation()

  return (
    <Shell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
          <Route path="/inventory" element={<PageWrapper><InventoryPage /></PageWrapper>} />
          <Route path="/billing" element={<PageWrapper><BillingPage /></PageWrapper>} />
          <Route path="/orders" element={<PageWrapper><OrderHistoryPage /></PageWrapper>} />
          <Route path="/settings" element={<PageWrapper><div className="p-8">Settings</div></PageWrapper>} />
        </Routes>
      </AnimatePresence>
    </Shell>
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

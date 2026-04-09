import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'

import InventoryPage from './components/inventory/InventoryPage'
import BillingPage from './components/billing/BillingPage'
import Dashboard from './components/dashboard/Dashboard'
import OrderHistoryPage from './components/orders/OrderHistoryPage'

function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/settings" element={<div className="p-8">Settings</div>} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}

export default App

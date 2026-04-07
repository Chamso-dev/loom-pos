import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'

import InventoryPage from './components/inventory/InventoryPage'
import BillingPage from './components/billing/BillingPage'

function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<div className="p-8 font-primary">Dashboard Overview</div>} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/orders" element={<div className="p-8">Order History</div>} />
          <Route path="/settings" element={<div className="p-8">Settings</div>} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}

export default App

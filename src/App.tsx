import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Shell from './components/layout/Shell'

function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<div className="p-8">Dashboard Overview</div>} />
          <Route path="/inventory" element={<div className="p-8">Inventory Management</div>} />
          <Route path="/billing" element={<div className="p-8 font-primary">Billing (POS) Screen</div>} />
          <Route path="/orders" element={<div className="p-8">Order History</div>} />
          <Route path="/settings" element={<div className="p-8">Settings</div>} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}

export default App

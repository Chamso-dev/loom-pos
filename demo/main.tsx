import React from 'react'
import ReactDOM from 'react-dom/client'
import { installMockApi } from './mockApi'
import { installFormShim } from './formShim'
import App from '../src/App'
import { useStore } from '../src/store/useStore'
import '../src/index.css'

// The demo runs the real LoomPOS interface against an in-browser API with sample data.
installMockApi()
installFormShim()

// When the page is viewed inside a host that sets data-theme on <html>, follow it.
const followHostTheme = () => {
  const theme = document.documentElement.dataset.theme
  if (theme === 'dark' || theme === 'light') useStore.getState().setTheme(theme)
}
followHostTheme()
new MutationObserver(followHostTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

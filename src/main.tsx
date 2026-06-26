import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installOfflineApi } from './native/offlineApi'
import { initLiveUpdates } from './native/liveUpdate'

// On the native Android build this wires up the on-device SQLite API before the
// app renders; on the web it resolves immediately and the real backend is used.
installOfflineApi().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  // Silent background OTA update check (native only; never blocks or interrupts).
  void initLiveUpdates()
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './global.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ConfirmProvider } from './components/ui.jsx'
import { initPostHog } from './posthog'

initPostHog()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

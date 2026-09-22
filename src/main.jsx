import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './global.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ConfirmProvider, ToastProvider } from './components/ui.jsx'
import { initPostHog } from './posthog'

initPostHog()

// Browser extensions and Chrome's translate feature rewrite text nodes that
// React owns (wrapping them in <font>, moving them). React's next commit
// then calls removeChild / insertBefore against a parent the node is no
// longer under, the DOM throws NotFoundError, and the error boundary
// replaces the whole app with "Something went wrong" — seen live on
// 22 Sep 2026 for a user on every refresh, in one browser only. This is
// the standard mitigation: if the node isn't where React thinks it is,
// skip the operation instead of throwing. React's own tree stays
// consistent; only the orphaned foreign wrapper is left behind.
if (typeof Node === 'function' && Node.prototype) {
  const origRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (child.parentNode) child.parentNode.removeChild(child)
      return child
    }
    return origRemoveChild.apply(this, arguments)
  }
  const origInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return origInsertBefore.call(this, newNode, null)
    }
    return origInsertBefore.apply(this, arguments)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ConfirmProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ConfirmProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

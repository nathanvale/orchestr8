import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { IS_DEVELOPMENT } from './env'
import './index.css'

// Start MSW in development
async function prepare(): Promise<void> {
  if (IS_DEVELOPMENT) {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
  }
}

// Initialize app with MSW
await prepare()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

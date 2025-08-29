import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Start MSW in development
async function prepare(): Promise<void> {
  if (import.meta.env.DEV === 'true') {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
    return
  }
  return Promise.resolve()
}

// Use promise-based initialization to avoid top-level await
void prepare().then(() => {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found')
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})

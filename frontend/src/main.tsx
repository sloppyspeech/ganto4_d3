import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

console.log('[OptiFlow] main.tsx starting...')

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('[OptiFlow] Root element not found!')
} else {
  console.log('[OptiFlow] Root element found, loading App...')

  import('./App')
    .then(({ default: App }) => {
      console.log('[OptiFlow] App module loaded, rendering...')
      const root = createRoot(rootElement)
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      )
      console.log('[OptiFlow] Render complete!')
    })
    .catch((error) => {
      console.error('[OptiFlow] Failed to load App:', error)
      rootElement.innerHTML = `
        <div style="padding: 40px; font-family: monospace; color: #ef4444; background: #1e1e1e;">
          <h1 style="color: #f97316;">⚠️ Module Loading Error</h1>
          <pre style="background: #2d2d2d; padding: 20px; border-radius: 8px; overflow: auto;">${error.stack || error.message || error}</pre>
          <p style="color: #9ca3af; margin-top: 20px;">Check the browser console for details.</p>
        </div>
      `
    })
}

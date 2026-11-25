import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/pirata-one/latin-400.css'
import './fonts.css'
import './styles.css'
import './integration.css'
import App from './App'
import { primePage } from './lib/pageModules'
import { ToastProvider } from './context/ToastContext'
import { primeAwards, VotesProvider } from './context/VotesContext'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

if (window.location.pathname === '/') {
  const nomination = window.location.hash.match(/^#nomination\/(\d+)$/)
  if (nomination) window.history.replaceState(null, '', `/nominations/${nomination[1]}`)
}

primeAwards(window.location.pathname)
primePage(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <VotesProvider>
          <App />
        </VotesProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)

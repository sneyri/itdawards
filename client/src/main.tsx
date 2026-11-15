import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/pirata-one/400.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './styles.css'
import './integration.css'
import App from './App'
import { ScrollToTop } from './components/ScrollToTop'
import { ToastProvider } from './context/ToastContext'
import { VotesProvider } from './context/VotesContext'

if (window.location.pathname === '/') {
  const nomination = window.location.hash.match(/^#nomination\/(\d+)$/)
  if (nomination) window.history.replaceState(null, '', `/nominations/${nomination[1]}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <VotesProvider>
          <ScrollToTop />
          <App />
        </VotesProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)

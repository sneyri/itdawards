import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'
import { ScrollToTop } from './ScrollToTop'

export function Layout() {
  return (
    <div className="site" id="top">
      <ScrollToTop />
      <a className="skip-link" href="#main">
        Перейти к содержанию
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="container section" role="status">Загружаем страницу…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

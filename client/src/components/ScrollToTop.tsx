import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const previousPath = useRef(pathname)

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        previousPath.current = pathname
        return
      }
    }

    if (previousPath.current === pathname) return
    previousPath.current = pathname

    window.scrollTo(0, 0)
    const main = document.getElementById('main')
    main?.focus({ preventScroll: true })
  }, [pathname, hash])

  return null
}

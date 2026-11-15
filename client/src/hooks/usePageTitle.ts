import { useEffect } from 'react'

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title === 'ITD AWARDS 2026' ? title : `${title} — ITD AWARDS 2026`
  }, [title])
}

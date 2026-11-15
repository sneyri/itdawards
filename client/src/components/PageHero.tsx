import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Crumb = {
  label: string
  to?: string
}

type PageHeroProps = {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  aside?: ReactNode
  ghost?: string
  crumbs?: Crumb[]
}

export function PageHero({ eyebrow, title, description, aside, ghost, crumbs }: PageHeroProps) {
  return (
    <section className="page-hero">
      {ghost && (
        <span className="page-hero__ghost" aria-hidden="true">
          {ghost}
        </span>
      )}
      <div className="container page-hero__inner">
        {crumbs && crumbs.length > 0 && (
          <nav className="crumbs" aria-label="Хлебные крошки">
            {crumbs.map((crumb, index) => (
              <span className="crumbs__item" key={`${crumb.label}-${index}`}>
                {index > 0 && (
                  <span className="crumbs__separator" aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="page-hero__grid">
          <div className="page-hero__content">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="page-title">{title}</h1>
            {description && <p className="page-lede">{description}</p>}
          </div>
          {aside && <div className="page-hero__aside">{aside}</div>}
        </div>
      </div>
    </section>
  )
}

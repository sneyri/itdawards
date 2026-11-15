import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

export function NotFound() {
  usePageTitle('Страница не найдена')

  return (
    <div className="not-found">
      <span className="not-found__ghost" aria-hidden="true">
        404
      </span>
      <div className="container not-found__inner">
        <span className="not-found__icon" aria-hidden="true">
          <Compass size={28} />
        </span>
        <p className="eyebrow">Ошибка 404</p>
        <h1>
          Потерялись <em>в эфире.</em>
        </h1>
        <p>
          Такой страницы нет или она уже сменила номинацию. Давайте вернёмся туда, где
          всё точно на месте.
        </p>
        <div className="not-found__actions">
          <Link to="/" className="button button--gold">
            <ArrowLeft size={17} aria-hidden="true" />
            На главную
          </Link>
          <Link to="/nominations" className="button button--ghost">
            К номинациям
          </Link>
        </div>
      </div>
    </div>
  )
}

import { ArrowUpRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Category } from '../data/categories'
import { groupLabels, statusLabels } from '../data/categories'
import { useVotes } from '../context/VotesContext'
import { cardTilt } from '../lib/cardTilt'
import { CategoryIcon } from './CategoryIcon'

export function CategoryRow({ category }: { category: Category }) {
  const { votes } = useVotes()
  const isVoted = votes[category.id] !== undefined
  const status = isVoted ? 'Голос учтён' : statusLabels[category.status]

  return (
    <Link
      to={`/nominations/${category.id}`}
      className={`category-row ${isVoted ? 'is-voted' : ''}`}
      aria-label={`${category.title}. ${groupLabels[category.group]}. ${status}.`}
      {...cardTilt}
    >
      <span className="category-row__icon" aria-hidden="true">
        <CategoryIcon id={category.id} size={26} />
      </span>
      <span className="category-row__body">
        <span className="category-row__title">{category.title}</span>
        <span className="category-row__meta">
          <span>{groupLabels[category.group]}</span>
          <span className="category-row__dot" aria-hidden="true" />
          <span>{status}</span>
        </span>
      </span>
      <span className="category-row__status" aria-hidden="true">
        {isVoted ? (
          <span className="category-row__check">
            <Check size={19} strokeWidth={3} />
          </span>
        ) : (
          <span className="category-row__action">
            <ArrowUpRight size={18} strokeWidth={2} />
          </span>
        )}
      </span>
    </Link>
  )
}

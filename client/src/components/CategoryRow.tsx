import { memo } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Category } from '../data/categories'
import { groupLabels } from '../data/categories'
import { CategoryImage } from './CategoryImage'

export const CategoryRow = memo(function CategoryRow({ category, isVoted, selectedName }: {
  category: Category
  isVoted: boolean
  selectedName?: string
}) {
  const choice = selectedName ? `Ваш выбор: ${selectedName}` : 'Голос учтён'

  return (
    <Link
      to={`/nominations/${category.id}`}
      className={`category-row ${isVoted ? 'is-voted' : ''}`}
      aria-label={`${category.title}. ${groupLabels[category.group]}. ${
        isVoted ? `${choice}.` : 'Голос пока не отдан.'
      }`}
    >
      <span className="category-row__icon" aria-hidden="true">
        <CategoryImage category={category} size={26} />
      </span>
      <span className="category-row__body">
        <span className="category-row__title">{category.title}</span>
        <span className="category-row__meta">
          <span>{groupLabels[category.group]}</span>
          <span className="category-row__dot" aria-hidden="true" />
          {isVoted ? (
            <span className="category-row__pick">{choice}</span>
          ) : (
            <span>Один голос</span>
          )}
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
})

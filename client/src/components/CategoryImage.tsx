import { useState } from 'react'
import type { Category } from '../data/categories'
import { CategoryIcon } from './CategoryIcon'

export function CategoryImage({ category, size }: { category: Category; size: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return category.imageUrl && category.imageUrl !== failedUrl
    ? <img className="category-image" src={category.imageUrl} alt="" width={size} height={size} loading="lazy"
        referrerPolicy="no-referrer" onError={() => setFailedUrl(category.imageUrl)} />
    : <CategoryIcon id={category.id} size={size} />
}

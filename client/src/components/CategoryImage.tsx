import { useState } from 'react'
import type { Category } from '../data/categories'
import { webpSource } from '../lib/imageSource'
import { CategoryIcon } from './CategoryIcon'

export function CategoryImage({ category, size }: { category: Category; size: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!category.imageUrl || category.imageUrl === failedUrl) return <CategoryIcon id={category.id} size={size} />
  const webp = webpSource(category.imageUrl)
  return (
    <picture className="category-image-picture">
      {webp && <source srcSet={webp} type="image/webp" />}
      <img className="category-image" src={category.imageUrl} alt="" width={size} height={size} loading="lazy"
        referrerPolicy="no-referrer" onError={() => setFailedUrl(category.imageUrl)} />
    </picture>
  )
}

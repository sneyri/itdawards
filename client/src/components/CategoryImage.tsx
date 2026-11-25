import type { Category } from '../data/categories'
import { useImageSource } from '../lib/imageSource'
import { CategoryIcon } from './CategoryIcon'

export function CategoryImage({ category, size, eager = false }: { category: Category; size: number; eager?: boolean }) {
  const { source, fail } = useImageSource(category.imageUrl, category.thumbnailUrl)
  if (!source) return <CategoryIcon id={category.id} size={size} />
  return (
    <picture className="category-image-picture">
      <img className="category-image" src={source} alt="" width={size} height={size} loading={eager ? 'eager' : 'lazy'}
        decoding="async" referrerPolicy="no-referrer" onError={fail} />
    </picture>
  )
}

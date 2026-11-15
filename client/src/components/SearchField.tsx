import { useId } from 'react'
import { Search, X } from 'lucide-react'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
}

export function SearchField({
  value,
  onChange,
  label = 'Поиск',
  placeholder = 'Номинация или имя номинанта',
}: SearchFieldProps) {
  const inputId = useId()

  return (
    <div className="search-field">
      <label className="search-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="search-field__control">
        <Search size={17} aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
        />
        {value.length > 0 && (
          <button
            type="button"
            className="search-field__clear"
            onClick={() => onChange('')}
            aria-label="Очистить поиск"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

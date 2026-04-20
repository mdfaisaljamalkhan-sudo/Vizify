import { X } from 'lucide-react'
import { useFilterStore } from '@/store/filterStore'

export function ActiveFiltersBar() {
  const { activeFilters, clearFilter, clearAllFilters } = useFilterStore()
  const entries = Object.entries(activeFilters)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filters:</span>
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded-full"
        >
          {key}: {String(value)}
          <button onClick={() => clearFilter(key)} className="hover:text-blue-600">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        onClick={clearAllFilters}
        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
      >
        Clear all
      </button>
    </div>
  )
}

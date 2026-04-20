import { BarChart2, TrendingUp, Layers, Target, Globe, LayoutGrid } from 'lucide-react'

export const TEMPLATES = [
  { id: 'general', label: 'Auto-Detect', icon: LayoutGrid, description: 'AI picks the best framework', color: 'blue' },
  { id: 'kpi_summary', label: 'KPI Summary', icon: TrendingUp, description: 'Key metrics & performance', color: 'green' },
  { id: 'pl_statement', label: 'P&L Statement', icon: BarChart2, description: 'Revenue, costs, profit waterfall', color: 'purple' },
  { id: 'bcg_matrix', label: 'BCG Matrix', icon: Target, description: 'Portfolio growth-share matrix', color: 'orange' },
  { id: 'swot', label: 'SWOT Analysis', icon: Layers, description: 'Strengths, weaknesses, opportunities, threats', color: 'red' },
  { id: 'market_analysis', label: 'Market Analysis', icon: Globe, description: 'Market size, segments, trends', color: 'teal' },
]

const colorMap: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400',
  green: 'border-green-200 bg-green-50 text-green-700 hover:border-green-400',
  purple: 'border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-400',
  orange: 'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-400',
  red: 'border-red-200 bg-red-50 text-red-700 hover:border-red-400',
  teal: 'border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-400',
}

interface TemplatePickerProps {
  selected: string
  onChange: (id: string) => void
}

export function TemplatePicker({ selected, onChange }: TemplatePickerProps) {
  return (
    <div className="w-full max-w-md mx-auto mb-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dashboard Template</p>
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map(t => {
          const Icon = t.icon
          const isSelected = selected === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                isSelected
                  ? `${colorMap[t.color]} border-opacity-100 shadow-sm`
                  : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-600 hover:border-gray-300 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium leading-tight">{t.label}</span>
            </button>
          )
        })}
      </div>
      {selected !== 'general' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
          {TEMPLATES.find(t => t.id === selected)?.description}
        </p>
      )}
    </div>
  )
}

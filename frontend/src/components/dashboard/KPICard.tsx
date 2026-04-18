import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  trend: 'up' | 'down' | 'flat'
  delta: string
  narrative?: string
}

export function KPICard({ label, value, trend, delta, narrative }: KPICardProps) {
  const trendColor = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    flat: 'text-gray-600 dark:text-gray-400',
  }

  const trendBg = {
    up: 'bg-green-50 dark:bg-green-900/30',
    down: 'bg-red-50 dark:bg-red-900/30',
    flat: 'bg-gray-50 dark:bg-gray-700',
  }

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    flat: Minus,
  }[trend]

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md dark:hover:shadow-gray-900/30 transition-shadow">
      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{value}</p>
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${trendBg[trend]} mb-2`}>
        <TrendIcon className={`w-4 h-4 ${trendColor[trend]}`} />
        <span className={`text-sm font-semibold ${trendColor[trend]}`}>{delta}</span>
      </div>
      {narrative && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">{narrative}</p>
      )}
    </div>
  )
}

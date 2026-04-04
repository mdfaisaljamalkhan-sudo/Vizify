import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  trend: 'up' | 'down' | 'flat'
  delta: string
}

export function KPICard({ label, value, trend, delta }: KPICardProps) {
  const trendColor = {
    up: 'text-green-600',
    down: 'text-red-600',
    flat: 'text-gray-600',
  }

  const trendBg = {
    up: 'bg-green-50',
    down: 'bg-red-50',
    flat: 'bg-gray-50',
  }

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    flat: Minus,
  }[trend]

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <p className="text-gray-500 text-sm font-medium mb-2">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-3">{value}</p>
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${trendBg[trend]}`}>
        <TrendIcon className={`w-4 h-4 ${trendColor[trend]}`} />
        <span className={`text-sm font-semibold ${trendColor[trend]}`}>{delta}</span>
      </div>
    </div>
  )
}

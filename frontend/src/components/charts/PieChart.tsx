import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useFilterStore } from '@/store/filterStore'

interface PieChartProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

const COLORS = ['#1e3a5f', '#16a34a', '#dc2626', '#64748b', '#2563eb', '#f59e0b']

export function PieChart({ data, x_key, y_keys }: PieChartProps) {
  const { setFilter, clearFilter, activeFilters } = useFilterStore()
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  // For pie chart, use first y_key as the value
  const valueKey = y_keys?.[0]
  const chartData = data.map((item) => ({
    name: item[x_key],
    value: valueKey ? (parseFloat(item[valueKey] as string) || 0) : 0,
  }))

  const handleClick = (entry: any) => {
    const val = entry?.name
    if (!val) return
    if (activeFilters[x_key] === val) clearFilter(x_key)
    else setFilter(x_key, val)
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsPie data={chartData}>
        <Tooltip formatter={(value) => {
          if (typeof value === 'number') return value.toFixed(2)
          return String(value)
        }} />
        <Legend />
        <Pie
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          {chartData.map((entry, i) => (
            <Cell
              key={`cell-${i}`}
              fill={COLORS[i % COLORS.length]}
              opacity={activeFilters[x_key] && activeFilters[x_key] !== entry.name ? 0.4 : 1}
            />
          ))}
        </Pie>
      </RechartsPie>
    </ResponsiveContainer>
  )
}

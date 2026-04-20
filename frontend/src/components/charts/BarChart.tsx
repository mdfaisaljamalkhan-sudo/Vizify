import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useFilterStore } from '@/store/filterStore'

interface BarChartProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

const COLORS = ['#1e3a5f', '#16a34a', '#dc2626', '#64748b', '#2563eb', '#f59e0b']

export function BarChart({ data, x_key, y_keys }: BarChartProps) {
  const { activeFilters, setFilter } = useFilterStore()

  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  // Apply cross-filters from other charts
  const filtered = Object.entries(activeFilters).reduce((d, [k, v]) => {
    if (k === x_key) return d
    return d.filter((row) => String(row[k]) === String(v))
  }, data)

  const handleClick = (payload: any) => {
    if (payload?.activePayload?.[0]) {
      const xVal = payload.activePayload[0].payload[x_key]
      if (activeFilters[x_key] === xVal) {
        useFilterStore.getState().clearFilter(x_key)
      } else {
        setFilter(x_key, xVal)
      }
    }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsBar
        data={filtered}
        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={x_key} />
        <YAxis />
        <Tooltip />
        <Legend />
        {y_keys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={COLORS[i % COLORS.length]}
            radius={[8, 8, 0, 0]}
            opacity={activeFilters[x_key] !== undefined ? 0.7 : 1}
          />
        ))}
      </RechartsBar>
    </ResponsiveContainer>
  )
}

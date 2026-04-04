import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface PieChartProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

const COLORS = ['#1e3a5f', '#16a34a', '#dc2626', '#64748b', '#2563eb', '#f59e0b']

export function PieChart({ data, x_key, y_keys }: PieChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  // For pie chart, use first y_key as the value
  const valueKey = y_keys?.[0]
  const chartData = data.map((item) => ({
    name: item[x_key],
    value: valueKey ? (parseFloat(item[valueKey] as string) || 0) : 0,
  }))

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
        >
          {chartData.map((_, i) => (
            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </RechartsPie>
    </ResponsiveContainer>
  )
}

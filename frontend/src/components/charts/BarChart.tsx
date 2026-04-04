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

interface BarChartProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

const COLORS = ['#1e3a5f', '#16a34a', '#dc2626', '#64748b', '#2563eb', '#f59e0b']

export function BarChart({ data, x_key, y_keys }: BarChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsBar
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
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
          />
        ))}
      </RechartsBar>
    </ResponsiveContainer>
  )
}

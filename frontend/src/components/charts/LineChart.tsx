import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface LineChartProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

const COLORS = ['#1e3a5f', '#16a34a', '#dc2626', '#64748b', '#2563eb', '#f59e0b']

export function LineChart({ data, x_key, y_keys }: LineChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLine
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={x_key} />
        <YAxis />
        <Tooltip />
        <Legend />
        {y_keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ fill: COLORS[i % COLORS.length], r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsLine>
    </ResponsiveContainer>
  )
}

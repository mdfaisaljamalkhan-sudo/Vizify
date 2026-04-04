import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface PLWaterfallProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

export function PLWaterfall({ data, x_key, y_keys }: PLWaterfallProps) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  // Transform data for waterfall view
  let cumulative = 0
  const waterfallData = data.map((item) => {
    const value = parseFloat(item[y_keys?.[0]] as string) || 0
    const start = cumulative
    cumulative += value

    return {
      name: item[x_key],
      value: Math.abs(value),
      start: start,
      end: cumulative,
      fill: value >= 0 ? '#16a34a' : '#dc2626', // Green for positive, red for negative
      type: value >= 0 ? 'income' : 'expense',
    }
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBar
          data={waterfallData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip
            formatter={(value) => {
              if (typeof value === 'number') return `$${value.toFixed(2)}M`
              return String(value)
            }}
          />
          <Legend />
          <Bar dataKey="value" stackId="stack" radius={[8, 8, 0, 0]}>
            {waterfallData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </RechartsBar>
      </ResponsiveContainer>

      {/* Summary */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-900">Net Result:</span>
          <span
            className={`text-2xl font-bold ${
              cumulative >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ${Math.abs(cumulative).toFixed(2)}M
          </span>
        </div>
      </div>
    </div>
  )
}

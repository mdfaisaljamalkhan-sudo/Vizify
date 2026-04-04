import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

interface BCGMatrixProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

export function BCGMatrix({ data, x_key, y_keys }: BCGMatrixProps) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  const transformedData = data.map((item) => ({
    name: item[x_key],
    market_growth: parseFloat(item[y_keys?.[0]] as string) || 0,
    market_share: parseFloat(item[y_keys?.[1]] as string) || 0,
  }))

  const getColor = (growth: number, share: number) => {
    if (growth > 10 && share > 15) return '#16a34a' // Green for Stars
    if (growth > 10 && share <= 15) return '#f59e0b' // Amber for Question Marks
    if (growth <= 10 && share > 15) return '#2563eb' // Blue for Cash Cows
    return '#dc2626' // Red for Dogs
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart
          margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
          data={transformedData}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="market_share"
            label={{ value: 'Market Share (%)', position: 'insideBottomRight', offset: -5 }}
          />
          <YAxis
            dataKey="market_growth"
            label={{ value: 'Market Growth (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value) => {
              if (typeof value === 'number') return value.toFixed(2)
              return String(value)
            }}
          />
          <Scatter name="Products" data={transformedData} fill="#8884d8">
            {transformedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry.market_growth, entry.market_share)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600"></div>
          <span>Stars (High growth, High share)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-500"></div>
          <span>Question Marks (High growth, Low share)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600"></div>
          <span>Cash Cows (Low growth, High share)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-600"></div>
          <span>Dogs (Low growth, Low share)</span>
        </div>
      </div>
    </div>
  )
}

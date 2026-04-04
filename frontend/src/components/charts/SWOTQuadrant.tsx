interface SWOTQuadrantProps {
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

interface SwotItem {
  strength?: string[]
  weakness?: string[]
  opportunity?: string[]
  threat?: string[]
}

export function SWOTQuadrant({ data, x_key, y_keys }: SWOTQuadrantProps) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data available</div>
  }

  const swot: SwotItem = {
    strength: [],
    weakness: [],
    opportunity: [],
    threat: [],
  }

  // Parse data into SWOT categories
  data.forEach((item) => {
    const category = item[x_key]?.toLowerCase()
    const value = item[y_keys?.[0]]

    if (category?.includes('strength')) swot.strength?.push(value)
    if (category?.includes('weakness')) swot.weakness?.push(value)
    if (category?.includes('opportunity')) swot.opportunity?.push(value)
    if (category?.includes('threat')) swot.threat?.push(value)
  })

  const quadrants = [
    {
      label: 'Strengths',
      items: swot.strength || [],
      color: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
      icon: '💪',
    },
    {
      label: 'Weaknesses',
      items: swot.weakness || [],
      color: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-900',
      icon: '⚠️',
    },
    {
      label: 'Opportunities',
      items: swot.opportunity || [],
      color: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      icon: '🎯',
    },
    {
      label: 'Threats',
      items: swot.threat || [],
      color: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-900',
      icon: '⚡',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {quadrants.map((quad, i) => (
        <div
          key={i}
          className={`${quad.color} border-2 ${quad.borderColor} rounded-lg p-4`}
        >
          <h3 className={`${quad.textColor} font-semibold flex items-center gap-2 mb-3`}>
            <span>{quad.icon}</span>
            {quad.label}
          </h3>
          <ul className={`${quad.textColor} space-y-2 text-sm`}>
            {quad.items.length > 0 ? (
              quad.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span>•</span>
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-gray-500 italic">No items</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}

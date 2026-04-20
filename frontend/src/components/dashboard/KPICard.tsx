import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Code2, ChevronDown, ChevronUp } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useThemeStore } from '@/store/themeStore'

interface KPICardProps {
  label: string
  value: string
  trend: 'up' | 'down' | 'flat'
  delta: string
  narrative?: string
  source_code?: string
}

export function KPICard({ label, value, trend, delta, narrative, source_code }: KPICardProps) {
  const [showCode, setShowCode] = useState(false)
  const { isDark } = useThemeStore()

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

  const TrendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus }[trend]

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
      {source_code && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-2">
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Code2 className="w-3 h-3" />
            {showCode ? 'Hide formula' : 'Show formula'}
            {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showCode && (
            <div className="mt-2 rounded overflow-hidden text-xs">
              <SyntaxHighlighter language="python" style={isDark ? oneDark : oneLight} customStyle={{ margin: 0, fontSize: '11px', borderRadius: '6px' }}>
                {source_code}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Code2, ChevronDown, ChevronUp } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useThemeStore } from '@/store/themeStore'

interface ChartCardProps {
  title: string
  children: React.ReactNode
  source_code?: string
}

export function ChartCard({ title, children, source_code }: ChartCardProps) {
  const [showCode, setShowCode] = useState(false)
  const { isDark } = useThemeStore()

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md dark:hover:shadow-gray-900/30 transition-shadow">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
      {source_code && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-2">
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Code2 className="w-3 h-3" />
            {showCode ? 'Hide code' : 'Show code'}
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

import { Lightbulb, Target, FileText } from 'lucide-react'

interface InsightsPanelProps {
  executive_summary?: string
  insights?: string[]
  recommendations?: string[]
}

export function InsightsPanel({ executive_summary, insights = [], recommendations = [] }: InsightsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      {executive_summary && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">Executive Summary</h3>
          </div>
          <p className="text-blue-800 dark:text-blue-300 leading-relaxed">{executive_summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Key Insights */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Insights</h3>
          </div>
          {insights.length > 0 ? (
            <ol className="space-y-3">
              {insights.map((insight, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{insight}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm italic">No insights available.</p>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recommendations</h3>
          </div>
          {recommendations.length > 0 ? (
            <ol className="space-y-3">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{rec}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm italic">No recommendations available.</p>
          )}
        </div>
      </div>
    </div>
  )
}

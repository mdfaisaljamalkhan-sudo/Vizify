import { Lightbulb, Target } from 'lucide-react'

interface InsightsPanelProps {
  executive_summary: string
  insights: string[]
  recommendations: string[]
}

export function InsightsPanel({
  executive_summary,
  insights,
  recommendations,
}: InsightsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">Executive Summary</h3>
        <p className="text-blue-800 dark:text-blue-300 leading-relaxed">{executive_summary}</p>
      </div>

      {/* Key Insights */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Insights</h3>
        </div>
        {insights.length > 0 ? (
          <ul className="space-y-3">
            {insights.map((insight, i) => (
              <li key={i} className="flex gap-3 text-gray-700 dark:text-gray-300">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold min-w-fit">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic">No insights generated — try re-analyzing with different data.</p>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recommendations</h3>
        </div>
        {recommendations.length > 0 ? (
          <ul className="space-y-3">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-gray-700 dark:text-gray-300">
                <span className="text-green-600 dark:text-green-400 font-bold min-w-fit">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic">No recommendations generated — try re-analyzing with different data.</p>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { FileText, X, Loader2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import { useThemeStore } from '@/store/themeStore'

interface BriefButtonProps {
  dashboardId: string
}

export function BriefButton({ dashboardId }: BriefButtonProps) {
  const [loading, setLoading] = useState(false)
  const [brief, setBrief] = useState<any>(null)
  const { isDark } = useThemeStore()

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await apiClient.post(`/api/dashboards/${dashboardId}/brief`)
      setBrief(res.data)
    } catch (e) {
      console.error('Brief generation failed', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Brief
      </button>

      {brief && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setBrief(null)}>
          <div
            className={`max-w-2xl w-full rounded-xl shadow-2xl p-8 relative max-h-[85vh] overflow-y-auto ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setBrief(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold mb-1">Executive Brief</h2>
            <p className="text-lg text-blue-600 dark:text-blue-400 font-medium mb-4">{brief.headline}</p>

            {brief.situation && (
              <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">{brief.situation}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {brief.top_insights?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-600 dark:text-green-400 mb-2 text-sm uppercase tracking-wide">Key Insights</h3>
                  <ul className="space-y-1">
                    {brief.top_insights.map((ins: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>{ins}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {brief.top_risks?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-2 text-sm uppercase tracking-wide">Risks</h3>
                  <ul className="space-y-1">
                    {brief.top_risks.map((risk: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                        <span className="text-red-500 mt-0.5">⚠</span>{risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {brief.actions?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2 text-sm uppercase tracking-wide">Recommended Actions</h3>
                <ol className="space-y-1">
                  {brief.actions.map((a: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                      <span className="font-bold text-blue-500 min-w-[16px]">{i + 1}.</span>{a}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {brief.bottom_line && (
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 italic">"{brief.bottom_line}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

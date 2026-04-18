import { useState, useEffect } from 'react'
import { ChevronLeft, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStore } from '@/store/dashboardStore'
import { apiClient } from '@/api/client'

interface QualityFinding {
  nulls: Array<{ column: string; count: number; percentage: number; suggestion: string }>
  duplicates: { count: number; percentage: number; suggestion: string }
  outliers: Array<{
    column: string
    count: number
    percentage: number
    suggestion: string
  }>
  type_issues: Array<{
    column: string
    issue: string
    suggestion: string
  }>
  suspicious_values: Array<{
    column: string
    issue: string
    suggestion: string
  }>
}

export function DataQuality() {
  const navigate = useNavigate()
  const { extractedText, setExtractedText } = useDashboardStore()
  const [findings, setFindings] = useState<QualityFinding | null>(null)
  const [loading, setLoading] = useState(true)
  const [fixes, setFixes] = useState({
    fill_nulls: false,
    drop_duplicates: false,
    coerce_types: false,
  })
  const [applying, setApplying] = useState(false)

  // Load quality analysis
  useEffect(() => {
    if (!extractedText) {
      navigate('/')
      return
    }

    const analyze = async () => {
      try {
        const response = await apiClient.post('/api/quality/analyze', {
          extracted_text: extractedText,
        })
        setFindings(response.data)
      } catch (err) {
        console.error('Quality analysis failed:', err)
      } finally {
        setLoading(false)
      }
    }

    analyze()
  }, [extractedText, navigate])

  const handleApplyFixes = async () => {
    if (!extractedText) return

    setApplying(true)
    try {
      const response = await apiClient.post('/api/quality/fix', {
        extracted_text: extractedText,
        fixes,
      })

      setExtractedText(response.data.extracted_text)
      setFindings(response.data.findings)
    } catch (err) {
      console.error('Failed to apply fixes:', err)
    } finally {
      setApplying(false)
    }
  }

  const handleSkip = () => {
    navigate('/upload', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Analyzing data quality...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center gap-4">
          <button
            onClick={handleSkip}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Skip
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-1">Data Quality Check</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {findings && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Summary</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Rows</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{findings.duplicates.percentage}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Duplicate Rows</p>
                  <p className="text-2xl font-bold text-orange-600">{findings.duplicates.count}</p>
                </div>
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-4">
              {/* Nulls */}
              {findings.nulls.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                    <AlertCircle className="w-5 h-5" />
                    Missing Values
                  </h3>
                  <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-300">
                    {findings.nulls.map((item) => (
                      <li key={item.column}>
                        <strong>{item.column}:</strong> {item.count} nulls ({item.percentage}%)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Type Issues */}
              {findings.type_issues.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200 mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    Type Issues
                  </h3>
                  <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                    {findings.type_issues.map((item, i) => (
                      <li key={i}>
                        <strong>{item.column}:</strong> {item.issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Outliers */}
              {findings.outliers.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-red-900 dark:text-red-200 mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    Outliers Detected
                  </h3>
                  <ul className="space-y-2 text-sm text-red-800 dark:text-red-300">
                    {findings.outliers.map((item) => (
                      <li key={item.column}>
                        <strong>{item.column}:</strong> {item.count} outliers ({item.percentage}%)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suspicious Values */}
              {findings.suspicious_values.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-purple-900 dark:text-purple-200 mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    Suspicious Values
                  </h3>
                  <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-300">
                    {findings.suspicious_values.map((item, i) => (
                      <li key={i}>
                        <strong>{item.column}:</strong> {item.issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No Issues */}
              {findings.nulls.length === 0 &&
                findings.type_issues.length === 0 &&
                findings.outliers.length === 0 &&
                findings.suspicious_values.length === 0 && (
                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-green-900 dark:text-green-200">
                      <CheckCircle2 className="w-5 h-5" />
                      Data looks clean!
                    </h3>
                  </div>
                )}
            </div>

            {/* Fix Options */}
            {(findings.nulls.length > 0 || findings.duplicates.count > 0 || findings.type_issues.length > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Apply Fixes</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fixes.fill_nulls}
                      onChange={(e) => setFixes({ ...fixes, fill_nulls: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Fill missing values with median/mode</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fixes.drop_duplicates}
                      onChange={(e) => setFixes({ ...fixes, drop_duplicates: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Remove duplicate rows</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fixes.coerce_types}
                      onChange={(e) => setFixes({ ...fixes, coerce_types: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Auto-correct data types</span>
                  </label>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Skip & Continue
              </button>
              <button
                onClick={handleApplyFixes}
                disabled={applying || !Object.values(fixes).some((v) => v)}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {applying ? 'Applying...' : 'Apply Fixes & Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { GitMerge, Check, ChevronDown } from 'lucide-react'
import { apiClient } from '@/api/client'

interface Proposal {
  left_index: number
  right_index: number
  left_col: string
  right_col: string
  confidence: number
  left_columns: string[]
  right_columns: string[]
  left_rows: number
  right_rows: number
}

interface JoinProposerProps {
  fileNames: string[]
  extractedTexts: string[]
  onJoinComplete: (mergedText: string) => void
  onSkip: () => void
}

export function JoinProposer({ fileNames, extractedTexts, onJoinComplete, onSkip }: JoinProposerProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [how, setHow] = useState('inner')

  const handlePropose = async () => {
    setLoading(true)
    try {
      const res = await apiClient.post('/api/joins/propose', { extracted_texts: extractedTexts })
      setProposals(res.data.proposals)
      if (res.data.proposals.length > 0) setSelected(res.data.proposals[0])
    } catch (e) {
      console.error('Join proposal failed', e)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!selected) return
    setApplying(true)
    try {
      const res = await apiClient.post('/api/joins/apply', {
        extracted_texts: extractedTexts,
        left_index: selected.left_index,
        right_index: selected.right_index,
        left_col: selected.left_col,
        right_col: selected.right_col,
        how,
      })
      onJoinComplete(res.data.extracted_text)
    } catch (e) {
      console.error('Join failed', e)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <GitMerge className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Join Files</h3>
        <span className="ml-auto text-sm text-gray-500">{fileNames.join(' + ')}</span>
      </div>

      {proposals.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Multiple files detected. Want to join them before analysis?
          </p>
          <div className="flex gap-2">
            <button onClick={handlePropose} disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {loading ? 'Detecting join keys...' : 'Auto-detect join keys'}
            </button>
            <button onClick={onSkip}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {proposals.map((p, i) => (
              <button key={i} onClick={() => setSelected(p)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-sm ${
                  selected === p
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {fileNames[p.left_index]} <span className="text-blue-600">({p.left_col})</span>
                    {' '} ← → {' '}
                    {fileNames[p.right_index]} <span className="text-blue-600">({p.right_col})</span>
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.confidence > 0.7 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {Math.round(p.confidence * 100)}% match
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{p.left_rows} rows × {p.right_rows} rows</p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Join type:</span>
              <div className="relative">
                <select value={how} onChange={e => setHow(e.target.value)}
                  className="pl-3 pr-8 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none">
                  <option value="inner">Inner (matching rows only)</option>
                  <option value="left">Left (keep all from first file)</option>
                  <option value="outer">Outer (keep all rows)</option>
                </select>
                <ChevronDown className="absolute right-2 top-2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleApply} disabled={!selected || applying}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              {applying ? 'Joining...' : 'Apply Join & Analyze'}
            </button>
            <button onClick={onSkip}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

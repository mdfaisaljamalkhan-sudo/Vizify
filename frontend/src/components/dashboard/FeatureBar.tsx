import { useState } from 'react'
import { X, MessageSquare, Edit3, FileText, Share2, BarChart2, Code2, GitMerge, TrendingUp, Filter, ChevronDown, ChevronUp } from 'lucide-react'

const FEATURES = [
  {
    icon: Edit3,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
    label: 'AI Editor',
    desc: 'Purple button ↘ — edit anything in plain English',
  },
  {
    icon: TrendingUp,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    label: 'What-If',
    desc: 'In Editor, type "what if revenue grew 20%" to model scenarios',
  },
  {
    icon: Filter,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    label: 'Cross-filter',
    desc: 'Click any bar or pie slice to filter all charts simultaneously',
  },
  {
    icon: Code2,
    color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
    label: 'Show Formula',
    desc: 'Click "Show formula" under any KPI card to see the calculation',
  },
  {
    icon: FileText,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30',
    label: 'Brief',
    desc: 'Purple Brief button top-right — one-page executive summary',
  },
  {
    icon: MessageSquare,
    color: 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30',
    label: 'Comments',
    desc: 'Click Share → open the link → team can comment live',
  },
  {
    icon: Share2,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    label: 'Live Share',
    desc: 'Green Share button — colleagues see your edits in real time',
  },
  {
    icon: GitMerge,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
    label: 'Join Files',
    desc: 'Drop multiple files at once to auto-join related datasets',
  },
  {
    icon: BarChart2,
    color: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30',
    label: 'Templates',
    desc: 'Upload page — pick P&L, BCG, SWOT, Market or KPI layout',
  },
]

export function FeatureBar() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('vizify-features-dismissed') === 'true'
  )
  const [expanded, setExpanded] = useState(false)

  if (dismissed) return null

  const visible = expanded ? FEATURES : FEATURES.slice(0, 4)

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
          ✦ Features available on this dashboard
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Less</> : <><ChevronDown className="w-3 h-3" /> All {FEATURES.length}</>}
          </button>
          <button
            onClick={() => {
              setDismissed(true)
              localStorage.setItem('vizify-features-dismissed', 'true')
            }}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {visible.map((f, i) => {
          const Icon = f.icon
          return (
            <div key={i} className="flex items-start gap-2 bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
              <div className={`p-1.5 rounded-md flex-shrink-0 ${f.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{f.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Globe, Clock, ExternalLink } from 'lucide-react'
import { apiClient } from '@/api/client'

interface Article {
  title: string
  summary: string
  url: string
  source: string
  published_at: string
}

interface ProcessingScreenProps {
  progress: number        // 0-100
  label: string          // e.g. "Analysing with AI…"
}

const STEPS = [
  { threshold: 0,  text: 'Uploading file…' },
  { threshold: 15, text: 'Parsing data…' },
  { threshold: 40, text: 'Analysing with AI…' },
  { threshold: 85, text: 'Saving dashboard…' },
  { threshold: 98, text: 'Almost ready…' },
]

const TIPS = [
  "Pro tip: Use the Chat Edit panel to refine your dashboard with natural language.",
  "Pro tip: Click any bar or pie slice to cross-filter all charts simultaneously.",
  "Pro tip: The Brief button generates a one-page executive summary instantly.",
  "Pro tip: Drop multiple files at once to automatically join related datasets.",
  "Pro tip: Share your dashboard and colleagues see your edits live in real time.",
]

export function ProcessingScreen({ progress, label }: ProcessingScreenProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [tipIndex, setTipIndex] = useState(0)
  const [activeArticle, setActiveArticle] = useState(0)

  // Fetch news once on mount
  useEffect(() => {
    apiClient.get('/api/news')
      .then(r => setArticles(r.data.articles || []))
      .catch(() => {})
  }, [])

  // Rotate tips every 4s
  useEffect(() => {
    const t = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4000)
    return () => clearInterval(t)
  }, [])

  // Rotate news cards every 5s
  useEffect(() => {
    if (!articles.length) return
    const t = setInterval(() => setActiveArticle(i => (i + 1) % articles.length), 5000)
    return () => clearInterval(t)
  }, [articles.length])

  const currentStep = [...STEPS].reverse().find(s => progress >= s.threshold)
  const displayLabel = label || currentStep?.text || 'Processing…'

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 z-50 flex flex-col items-center justify-center p-6">

      {/* Animated logo pulse */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-8"
      >
        <div className="relative">
          {/* Outer ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-24 h-24 rounded-full border-4 border-transparent border-t-blue-400 border-r-blue-400"
          />
          {/* Inner ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 w-20 h-20 rounded-full border-4 border-transparent border-t-indigo-400 border-b-indigo-400"
          />
          {/* Logo centre */}
          <div className="absolute inset-0 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-blue-300" />
          </div>
        </div>
      </motion.div>

      {/* Status label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={displayLabel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-white text-xl font-semibold mb-2 text-center"
        >
          {displayLabel}
        </motion.p>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="w-72 h-1.5 bg-white/10 rounded-full overflow-hidden mb-8">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ ease: 'easeOut', duration: 0.4 }}
        />
      </div>

      {/* Steps */}
      <div className="flex gap-3 mb-10">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-500 ${
              progress >= s.threshold ? 'bg-blue-400 scale-125' : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* News section */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-blue-300" />
          <span className="text-blue-300 text-sm font-medium uppercase tracking-wider">
            Global Business Today
          </span>
        </div>

        <AnimatePresence mode="wait">
          {articles.length > 0 ? (
            <motion.div
              key={activeArticle}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="bg-white/8 backdrop-blur border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-white font-semibold leading-snug text-base">
                  {articles[activeArticle].title}
                </h3>
                {articles[activeArticle].url && (
                  <a
                    href={articles[activeArticle].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-shrink-0 text-blue-300 hover:text-blue-200 mt-0.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {articles[activeArticle].summary && (
                <p className="text-white/60 text-sm leading-relaxed mb-3">
                  {articles[activeArticle].summary.slice(0, 140)}
                  {articles[activeArticle].summary.length > 140 ? '…' : ''}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-blue-300/70 text-xs font-medium">
                  {articles[activeArticle].source}
                </span>
                {articles[activeArticle].published_at && (
                  <span className="flex items-center gap-1 text-white/30 text-xs">
                    <Clock className="w-3 h-3" />
                    {new Date(articles[activeArticle].published_at).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
              {/* Dot nav */}
              <div className="flex justify-center gap-1.5 mt-3">
                {articles.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveArticle(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === activeArticle ? 'bg-blue-400 w-3' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="loading-news"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/5 rounded-xl p-5 h-28 flex items-center justify-center"
            >
              <span className="text-white/30 text-sm">Fetching headlines…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rotating tips */}
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white/40 text-xs text-center mt-4 italic"
          >
            {TIPS[tipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

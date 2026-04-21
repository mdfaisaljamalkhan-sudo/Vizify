import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas'
import { ExportButton } from '@/components/export/ExportButton'
import type { DashboardData } from '@/store/dashboardStore'
import { apiClient } from '@/api/client'
import { AlertCircle, MessageSquare, Send, Users } from 'lucide-react'

interface Comment {
  id: string
  author_name: string
  text: string
  created_at: string
}

export function Shared() {
  const { token } = useParams<{ token: string }>()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dashboardRef = useRef<HTMLDivElement | null>(null)

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [posting, setPosting] = useState(false)
  const [viewers, setViewers] = useState(1)
  const [liveUpdate, setLiveUpdate] = useState(false)
  const commentEndRef = useRef<HTMLDivElement>(null)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setError('Invalid share link'); setLoading(false); return }

    Promise.all([
      apiClient.get(`/api/shared/${token}`),
      apiClient.get(`/api/shared/${token}/comments`),
    ]).then(([dashRes, commentRes]) => {
      setDashboard({ ...dashRes.data.dashboard_data, id: dashRes.data.id })
      setComments(commentRes.data)
    }).catch(e => {
      setError(e.response?.data?.detail || 'Failed to load dashboard')
    }).finally(() => setLoading(false))
  }, [token])

  // ── SSE live sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    const es = new EventSource(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/api/shared/${token}/stream`
    )

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'dashboard_updated') {
          setDashboard(prev => prev ? { ...msg.data, id: prev.id } : prev)
          setLiveUpdate(true)
          setTimeout(() => setLiveUpdate(false), 2500)
        } else if (msg.type === 'comment_added') {
          setComments(prev => [...prev, msg.data])
          setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } else if (msg.type === 'viewers') {
          setViewers(msg.data.count)
        }
      } catch { /* ignore malformed */ }
    }

    es.onerror = () => {
      // Browser auto-reconnects on error — no manual retry needed
    }

    return () => es.close()
  }, [token])

  // ── Post comment ──────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!newComment.trim() || !token) return
    setPosting(true)
    try {
      await apiClient.post(`/api/shared/${token}/comments`, {
        author_name: authorName.trim() || 'Anonymous',
        text: newComment.trim(),
      })
      setNewComment('')
      // Comment will arrive via SSE — no need to push manually
    } catch (e) {
      console.error('Post comment failed', e)
    } finally {
      setPosting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-700 mb-2">Dashboard Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'This dashboard is no longer available.'}</p>
          <a href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Upload
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{dashboard.title}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Read-only shared view</p>
            </div>
            {/* Live indicator */}
            {liveUpdate && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full animate-pulse font-medium">
                ● Live update
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Viewer count */}
            <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <Users className="w-4 h-4" />
              {viewers} viewing
            </span>
            <ExportButton dashboardRef={dashboardRef} fileName={dashboard.title} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Dashboard */}
        <div ref={dashboardRef} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <DashboardCanvas dashboard={dashboard} />
        </div>

        {/* Comments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Team Comments
            <span className="ml-1 text-sm text-gray-500 font-normal">({comments.length})</span>
          </h2>

          {/* Comment list */}
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No comments yet — be the first!</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{c.author_name}</span>
                    <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{c.text}</p>
                </div>
              ))
            )}
            <div ref={commentEndRef} />
          </div>

          {/* Post comment form */}
          <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-4">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePost()}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handlePost}
                disabled={posting || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs">Powered by Vizify</p>
      </div>
    </div>
  )
}

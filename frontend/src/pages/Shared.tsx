import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas'
import { ExportButton } from '@/components/export/ExportButton'
import type { DashboardData } from '@/store/dashboardStore'
import { apiClient } from '@/api/client'
import { AlertCircle, MessageSquare, Send } from 'lucide-react'

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

  useEffect(() => {
    if (!token) { setError('Invalid share link'); setLoading(false); return }
    apiClient.get(`/api/shared/${token}`)
      .then(r => { setDashboard(r.data.dashboard_data); setError(null) })
      .catch(e => setError(e.response?.data?.detail || 'Failed to load dashboard'))
      .finally(() => setLoading(false))

    apiClient.get(`/api/shared/${token}/comments`)
      .then(r => setComments(r.data))
      .catch(() => {})
  }, [token])

  const handlePostComment = async () => {
    if (!newComment.trim() || !token) return
    setPosting(true)
    try {
      const res = await apiClient.post(`/api/shared/${token}/comments`, {
        author_name: authorName.trim() || 'Anonymous',
        text: newComment.trim(),
      })
      setComments(prev => [...prev, res.data])
      setNewComment('')
    } catch (e) {
      console.error('Failed to post comment', e)
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
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
          <p className="text-gray-600 mb-4">{error || 'This dashboard is no longer available'}</p>
          <a href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Upload
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shared Dashboard</h1>
            <p className="text-sm text-gray-600">Read-only public view</p>
          </div>
          <ExportButton dashboardRef={dashboardRef} fileName={dashboard.title} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div ref={dashboardRef} className="space-y-8 bg-white rounded-xl shadow-sm p-8">
          <DashboardCanvas dashboard={dashboard} />
        </div>

        {/* Comments Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Comments ({comments.length})
          </h2>

          <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-gray-500 text-sm italic">No comments yet. Be the first!</p>
            )}
            {comments.map(c => (
              <div key={c.id} className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-gray-900">{c.author_name}</span>
                  <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handlePostComment}
                disabled={posting || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-gray-500 text-sm">
          Powered by Vizify
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas'
import { ExportButton } from '@/components/export/ExportButton'
import type { DashboardData } from '@/store/dashboardStore'
import { apiClient } from '@/api/client'
import { AlertCircle } from 'lucide-react'

export function Shared() {
  const { token } = useParams<{ token: string }>()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dashboardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!token) {
        setError('Invalid share link')
        setLoading(false)
        return
      }

      try {
        const response = await apiClient.get(`/api/shared/${token}`)
        setDashboard(response.data.dashboard_data)
        setError(null)
      } catch (err: any) {
        const message = err.response?.data?.detail || err.message || 'Failed to load dashboard'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [token])

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
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Upload
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shared Dashboard</h1>
            <p className="text-sm text-gray-600">Read-only public view</p>
          </div>
          <ExportButton dashboardRef={dashboardRef} fileName={dashboard.title} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div ref={dashboardRef} className="space-y-8 bg-white rounded-xl shadow-sm p-8">
          <DashboardCanvas dashboard={dashboard} />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          <p>This is a publicly shared dashboard. © 2026 SubaDash</p>
        </div>
      </div>
    </div>
  )
}

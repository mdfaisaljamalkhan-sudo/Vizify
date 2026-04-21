import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStore } from '@/store/dashboardStore'
import { apiClient } from '@/api/client'
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas'
import { ExportButton } from '@/components/export/ExportButton'
import { Header } from '@/components/Header'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { ChatEditPanel } from '@/components/chat/ChatEditPanel'
import { BriefButton } from '@/components/dashboard/BriefButton'
import { FeatureBar } from '@/components/dashboard/FeatureBar'
import { ChevronLeft } from 'lucide-react'

export function Dashboard() {
  const navigate = useNavigate()
  const dashboard = useDashboardStore((s) => s.dashboard)
  const extractedText = useDashboardStore((s) => s.extractedText)
  const clearDashboard = useDashboardStore((s) => s.clearDashboard)
  const setDashboard = useDashboardStore((s) => s.setDashboard)
  const dashboardRef = useRef<HTMLDivElement | null>(null)
  const [editVersion, setEditVersion] = useState(1)

  // If store is empty (e.g. page refresh), load most recent dashboard from backend
  useEffect(() => {
    if (!dashboard) {
      apiClient.get('/api/dashboards?limit=1')
        .then(res => {
          if (res.data?.length > 0) {
            return apiClient.get(`/api/dashboards/${res.data[0].id}`)
          }
        })
        .then(res => {
          if (res?.data) {
            setDashboard({ ...res.data.dashboard_data, id: res.data.id })
          }
        })
        .catch(() => {})
    }
  }, [])

  const handleDashboardUpdate = (updatedData: Record<string, any>) => {
    if (dashboard) {
      setDashboard({ ...dashboard, ...updatedData })
      setEditVersion((v) => v + 1)
    }
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No dashboard data. Please upload a file first.</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Upload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <button
            onClick={() => {
              clearDashboard()
              navigate('/')
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            {dashboard.id && <BriefButton dashboardId={dashboard.id} />}
            <ExportButton dashboardRef={dashboardRef} fileName={dashboard.title} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <FeatureBar />
        <div ref={dashboardRef} className="space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 relative">
          {/* Version Badge */}
          <div className="absolute top-4 right-4 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
            v{editVersion}
          </div>
          <DashboardCanvas dashboard={dashboard} />
        </div>
      </div>

      {/* Chat Window - positioned as fixed overlay */}
      <ChatWindow extractedText={extractedText} dashboardContext={dashboard} />

      {/* Chat Edit Panel - positioned as fixed overlay */}
      {dashboard && dashboard.id && (
        <ChatEditPanel
          dashboardId={dashboard.id}
          extractedText={extractedText || ''}
          onDashboardUpdate={handleDashboardUpdate}
        />
      )}
    </div>
  )
}

import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStore } from '@/store/dashboardStore'
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas'
import { ExportButton } from '@/components/export/ExportButton'
import { Header } from '@/components/Header'
import { ChevronLeft } from 'lucide-react'

export function Dashboard() {
  const navigate = useNavigate()
  const dashboard = useDashboardStore((s) => s.dashboard)
  const clearDashboard = useDashboardStore((s) => s.clearDashboard)
  const dashboardRef = useRef<HTMLDivElement | null>(null)

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No dashboard data. Please upload a file first.</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Upload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <button
            onClick={() => {
              clearDashboard()
              navigate('/')
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <ExportButton dashboardRef={dashboardRef} fileName={dashboard.title} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div ref={dashboardRef} className="space-y-8 bg-white rounded-xl shadow-sm p-8">
          <DashboardCanvas dashboard={dashboard} />
        </div>
      </div>
    </div>
  )
}

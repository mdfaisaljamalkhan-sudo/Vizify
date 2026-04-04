import type { DashboardData } from '@/store/dashboardStore'
import { KPICard } from './KPICard'
import { ChartCard } from './ChartCard'
import { InsightsPanel } from './InsightsPanel'
import { BarChart } from '@/components/charts/BarChart'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'
import { BCGMatrix } from '@/components/charts/BCGMatrix'
import { SWOTQuadrant } from '@/components/charts/SWOTQuadrant'
import { PLWaterfall } from '@/components/charts/PLWaterfall'

interface DashboardCanvasProps {
  dashboard: DashboardData
}

export function DashboardCanvas({ dashboard }: DashboardCanvasProps) {
  const renderChart = (chart: any) => {
    switch (chart.chart_type) {
      case 'bar':
        return <BarChart data={chart.data} x_key={chart.x_key} y_keys={chart.y_keys} />
      case 'line':
        return <LineChart data={chart.data} x_key={chart.x_key} y_keys={chart.y_keys} />
      case 'pie':
        return <PieChart data={chart.data} x_key={chart.x_key} y_keys={chart.y_keys} />
      case 'scatter':
        return <BCGMatrix data={chart.data} x_key={chart.x_key} y_keys={chart.y_keys} />
      case 'quadrant':
        return <SWOTQuadrant data={chart.data} x_key={chart.x_key} y_keys={chart.y_keys} />
      case 'waterfall':
        return <PLWaterfall data={chart.data} x_key={chart.x_key} y_keys={chart.y_keys} />
      default:
        return <div className="text-gray-500 text-center py-8">Chart type not yet supported</div>
    }
  }

  return (
    <div className="space-y-8 print:space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{dashboard.title}</h1>
        <p className="text-gray-600 text-sm">Type: {dashboard.dashboard_type}</p>
      </div>

      {/* KPIs Grid */}
      {dashboard.kpis && dashboard.kpis.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Performance Indicators</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboard.kpis.map((kpi, i) => (
              <KPICard key={i} {...kpi} />
            ))}
          </div>
        </section>
      )}

      {/* Charts */}
      {dashboard.charts && dashboard.charts.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dashboard.charts.map((chart, i) => (
              <ChartCard key={i} title={chart.title}>
                {renderChart(chart)}
              </ChartCard>
            ))}
          </div>
        </section>
      )}

      {/* Insights & Recommendations */}
      <section>
        <InsightsPanel
          executive_summary={dashboard.executive_summary}
          insights={dashboard.insights}
          recommendations={dashboard.recommendations}
        />
      </section>
    </div>
  )
}

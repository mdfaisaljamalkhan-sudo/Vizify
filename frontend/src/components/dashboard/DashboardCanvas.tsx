import { useState } from 'react'
import type { DashboardData, Scenario } from '@/store/dashboardStore'
import { KPICard } from './KPICard'
import { ChartCard } from './ChartCard'
import { InsightsPanel } from './InsightsPanel'
import { ActiveFiltersBar } from './ActiveFiltersBar'
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { BarChart } from '@/components/charts/BarChart'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'
import { BCGMatrix } from '@/components/charts/BCGMatrix'
import { SWOTQuadrant } from '@/components/charts/SWOTQuadrant'
import { PLWaterfall } from '@/components/charts/PLWaterfall'

interface DashboardCanvasProps {
  dashboard: DashboardData
}

function ScenarioPanel({ scenarios }: { scenarios: Scenario[] }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  if (!scenarios?.length) return null
  const s = scenarios[active]
  return (
    <div className="border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left font-semibold text-amber-800 dark:text-amber-200">
        <TrendingUp className="w-4 h-4" />
        What-If Scenarios ({scenarios.length})
        {open ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
      </button>
      {open && (
        <div className="mt-3">
          <div className="flex gap-2 mb-3 flex-wrap">
            {scenarios.map((sc, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${i === active ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-200'}`}>
                {sc.name}
              </button>
            ))}
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">{s.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {s.kpi_deltas.map((k, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded p-2 text-center border border-amber-200 dark:border-amber-700">
                <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{k.base_value} → {k.scenario_value}</p>
                <p className={`text-xs font-semibold ${k.delta_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {k.delta_pct >= 0 ? '▲' : '▼'} {Math.abs(k.delta_pct).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
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
        return <div className="text-gray-500 dark:text-gray-400 text-center py-8">Chart type not yet supported</div>
    }
  }

  return (
    <div className="space-y-8 print:space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{dashboard.title}</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Type: {dashboard.dashboard_type}</p>
      </div>

      {/* KPIs Grid */}
      {dashboard.kpis && dashboard.kpis.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Key Performance Indicators</h2>
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Analytics</h2>
          <ActiveFiltersBar />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dashboard.charts.map((chart, i) => (
              <ChartCard key={i} title={chart.title} source_code={chart.source_code}>
                {renderChart(chart)}
              </ChartCard>
            ))}
          </div>
        </section>
      )}

      {/* What-If Scenarios */}
      {dashboard.scenarios && dashboard.scenarios.length > 0 && (
        <section>
          <ScenarioPanel scenarios={dashboard.scenarios} />
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

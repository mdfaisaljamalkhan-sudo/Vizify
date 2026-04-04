import { create } from 'zustand'

export interface KPI {
  label: string
  value: string
  trend: 'up' | 'down' | 'flat'
  delta: string
}

export interface ChartData {
  chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'waterfall' | 'quadrant'
  title: string
  data: Record<string, any>[]
  x_key: string
  y_keys: string[]
}

export interface DashboardData {
  dashboard_type: string
  title: string
  executive_summary: string
  kpis: KPI[]
  charts: ChartData[]
  insights: string[]
  recommendations: string[]
}

interface DashboardStore {
  dashboard: DashboardData | null
  setDashboard: (data: DashboardData) => void
  clearDashboard: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  dashboard: null,
  setDashboard: (data) => set({ dashboard: data }),
  clearDashboard: () => set({ dashboard: null }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),
}))

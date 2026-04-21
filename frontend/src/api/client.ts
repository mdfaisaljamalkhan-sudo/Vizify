import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// File upload endpoint
export const uploadFile = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// Analyze endpoint
export const analyzeData = async (
  extracted_text: string,
  file_schema: Record<string, any>,
  template?: string,
  provider?: string
) => {
  const payload: any = { extracted_text, file_schema }
  if (template) payload.template = template
  if (provider) payload.provider = provider
  return apiClient.post('/api/analyze', payload)
}

// Get available providers
export const getProviders = async () => {
  return apiClient.get('/api/analyze/providers')
}

// Chat with dashboard
export const chatWithDashboard = async (
  message: string,
  extractedText: string,
  dashboardContext: any
) => {
  return apiClient.post('/api/chat', {
    message,
    extracted_text: extractedText,
    dashboard_context: dashboardContext,
  })
}

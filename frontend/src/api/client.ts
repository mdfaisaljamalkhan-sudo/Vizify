import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if it exists
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 (unauthorized) and 402 (upgrade required)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth on unauthorized
      useAuthStore.getState().logout()
    }
    if (error.response?.status === 402) {
      // Emit upgrade event
      window.dispatchEvent(new CustomEvent('show-upgrade-modal'))
    }
    return Promise.reject(error)
  }
)

// File upload endpoint
export const uploadFile = async (file: File, provider?: string) => {
  const formData = new FormData()
  formData.append('file', file)

  const config = {
    headers: { 'Content-Type': 'multipart/form-data' },
  }

  const params = provider ? { provider } : {}

  return apiClient.post('/api/upload', formData, {
    ...config,
    params,
  })
}

// Analyze endpoint
export const analyzeData = async (
  extracted_text: string,
  file_schema: Record<string, any>,
  provider?: string
) => {
  const payload: any = {
    extracted_text,
    file_schema,
  }
  if (provider) payload.provider = provider

  return apiClient.post('/api/analyze', payload)
}

// Get available providers
export const getProviders = async () => {
  return apiClient.get('/api/analyze/providers')
}

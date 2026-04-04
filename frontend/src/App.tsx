import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Upload } from '@/pages/Upload'
import { Dashboard } from '@/pages/Dashboard'
import { Shared } from '@/pages/Shared'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/api/client'

function App() {
  const login = useAuthStore((s) => s.login)

  useEffect(() => {
    // Auto-login with demo account on app load
    const autoDemoLogin = async () => {
      try {
        const response = await apiClient.post('/api/auth/demo')
        const { user, access_token } = response.data
        login(user, access_token)
      } catch (error) {
        console.error('Demo login failed:', error)
      }
    }

    autoDemoLogin()
  }, [login])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/shared/:token" element={<Shared />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Upload } from '@/pages/Upload'
import { Dashboard } from '@/pages/Dashboard'
import { Shared } from '@/pages/Shared'
import { DataQuality } from '@/pages/DataQuality'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/quality" element={<DataQuality />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/shared/:token" element={<Shared />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, AlertCircle } from 'lucide-react'
import { uploadFile, analyzeData, apiClient } from '@/api/client'
import { useDashboardStore } from '@/store/dashboardStore'
import { useNavigate } from 'react-router-dom'

const ALLOWED_TYPES = ['.csv', '.xlsx', '.xls', '.docx', '.pdf', '.json']
const MAX_SIZE = 25 * 1024 * 1024 // 25MB

export function FileDropzone() {
  const navigate = useNavigate()
  const { setIsLoading, setError, setDashboard, setExtractedText } = useDashboardStore()
  const [uploadProgress, setUploadProgress] = useState(0)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      // Validate file type
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_TYPES.includes(ext)) {
        setError(`File type ${ext} not supported. Allowed: ${ALLOWED_TYPES.join(', ')}`)
        return
      }

      if (file.size > MAX_SIZE) {
        setError(`File size exceeds 25MB limit`)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        setUploadProgress(30)

        // Upload file
        const uploadResponse = await uploadFile(file)
        const { extracted_text, file_schema } = uploadResponse.data
        setExtractedText(extracted_text)

        setUploadProgress(60)

        // Analyze
        const analyzeResponse = await analyzeData(extracted_text, file_schema)
        setUploadProgress(75)

        // Save dashboard to backend to get a persistent ID
        const saveResponse = await apiClient.post('/api/dashboards', {
          title: analyzeResponse.data.dashboard.title,
          file_name: file.name,
          file_type: ext.replace('.', ''),
          file_schema: file_schema,
          extracted_text: extracted_text,
          dashboard_data: analyzeResponse.data.dashboard,
        })
        setUploadProgress(95)

        // Store dashboard with its backend ID
        setDashboard({ ...analyzeResponse.data.dashboard, id: saveResponse.data.id })
        setUploadProgress(100)

        setTimeout(() => {
          navigate('/quality')
        }, 500)
      } catch (err: any) {
        const message = err.response?.data?.detail || err.message || 'Upload failed'
        setError(message)
      } finally {
        setIsLoading(false)
        setUploadProgress(0)
      }
    },
    [navigate, setIsLoading, setError, setDashboard, setExtractedText]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
      'application/json': ['.json'],
    },
  })

  const isLoading = useDashboardStore((s) => s.isLoading)
  const error = useDashboardStore((s) => s.error)

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} disabled={isLoading} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-600 font-semibold">Drop file here...</p>
        ) : (
          <>
            <p className="text-gray-700 font-semibold mb-2">Drag and drop your file</p>
            <p className="text-sm text-gray-500">or click to select</p>
            <p className="text-xs text-gray-400 mt-4">
              CSV, Excel, Word, PDF, JSON • Max 25MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600">Processing...</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, AlertCircle } from 'lucide-react'
import { uploadFile, analyzeData, apiClient } from '@/api/client'
import { useDashboardStore } from '@/store/dashboardStore'
import { useNavigate } from 'react-router-dom'
import { TemplatePicker } from './TemplatePicker'
import { JoinProposer } from './JoinProposer'
import { ProcessingScreen } from './ProcessingScreen'

const ALLOWED_TYPES = ['.csv', '.xlsx', '.xls', '.docx', '.pdf', '.json']
const MAX_SIZE = 25 * 1024 * 1024

export function FileDropzone() {
  const navigate = useNavigate()
  const { setIsLoading, setError, setDashboard, setExtractedText } = useDashboardStore()
  const [uploadProgress, setUploadProgress] = useState(0)
  const [template, setTemplate] = useState('general')
  const [pendingJoin, setPendingJoin] = useState<{ fileNames: string[]; texts: string[]; schemas: any[] } | null>(null)

  const [progressLabel, setProgressLabel] = useState('')

  const runAnalyzeAndSave = async (extracted_text: string, file_schema: any, fileName: string, ext: string) => {
    setExtractedText(extracted_text)
    setProgressLabel('Analysing with AI…')
    setUploadProgress(40)
    const analyzeResponse = await analyzeData(extracted_text, file_schema, template !== 'general' ? template : undefined, undefined)
    setProgressLabel('Saving dashboard…')
    setUploadProgress(90)
    const saveResponse = await apiClient.post('/api/dashboards', {
      title: analyzeResponse.data.dashboard.title,
      file_name: fileName,
      file_type: ext.replace('.', ''),
      file_schema,
      extracted_text,
      dashboard_data: analyzeResponse.data.dashboard,
    })
    setDashboard({ ...analyzeResponse.data.dashboard, id: saveResponse.data.id })
    setUploadProgress(100)
    navigate('/dashboard')
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      // Validate all files
      for (const f of acceptedFiles) {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase()
        if (!ALLOWED_TYPES.includes(ext)) { setError(`File type ${ext} not supported`); return }
        if (f.size > MAX_SIZE) { setError('File size exceeds 25MB'); return }
      }

      try {
        setIsLoading(true)
        setError(null)
        setProgressLabel('Uploading & parsing…')
        setUploadProgress(15)

        if (acceptedFiles.length === 1) {
          const file = acceptedFiles[0]
          const ext = '.' + file.name.split('.').pop()?.toLowerCase()
          const uploadResponse = await uploadFile(file)
          const { extracted_text, file_schema } = uploadResponse.data
          await runAnalyzeAndSave(extracted_text, file_schema, file.name, ext)
        } else {
          // Multi-file: upload all, then show join proposer
          const results = await Promise.all(acceptedFiles.map(f => uploadFile(f)))
          const texts = results.map(r => r.data.extracted_text)
          const schemas = results.map(r => r.data.file_schema)
          setUploadProgress(50)
          setIsLoading(false)
          setPendingJoin({ fileNames: acceptedFiles.map(f => f.name), texts, schemas })
        }
      } catch (err: any) {
        const message = err.response?.data?.detail || err.message || 'Upload failed'
        setError(message)
      } finally {
        setIsLoading(false)
        setUploadProgress(0)
      }
    },
    [navigate, setIsLoading, setError, setDashboard, setExtractedText, template]
  )

  const handleJoinComplete = async (mergedText: string) => {
    if (!pendingJoin) return
    setPendingJoin(null)
    try {
      setIsLoading(true)
      setError(null)
      await runAnalyzeAndSave(mergedText, {}, pendingJoin.fileNames.join('+'), '.csv')
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed')
      setIsLoading(false)
    }
  }

  const handleJoinSkip = async () => {
    if (!pendingJoin) return
    const text = pendingJoin.texts[0]
    const schema = pendingJoin.schemas[0]
    const name = pendingJoin.fileNames[0]
    const ext = '.' + name.split('.').pop()?.toLowerCase()
    setPendingJoin(null)
    try {
      setIsLoading(true)
      setError(null)
      await runAnalyzeAndSave(text, schema, name, ext)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed')
      setIsLoading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 5,
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

  if (pendingJoin) {
    return (
      <JoinProposer
        fileNames={pendingJoin.fileNames}
        extractedTexts={pendingJoin.texts}
        onJoinComplete={handleJoinComplete}
        onSkip={handleJoinSkip}
      />
    )
  }

  // Full-screen animated processing overlay — rendered via Portal so it
  // escapes any parent stacking context (overflow, shadow, transform).
  if (isLoading) {
    return createPortal(
      <ProcessingScreen progress={uploadProgress} label={progressLabel} />,
      document.body
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <TemplatePicker selected={template} onChange={setTemplate} />
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} disabled={isLoading} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-600 font-semibold">Drop files here...</p>
        ) : (
          <>
            <p className="text-gray-700 font-semibold mb-2">Drag and drop your file(s)</p>
            <p className="text-sm text-gray-500">or click to select • up to 5 files for joining</p>
            <p className="text-xs text-gray-400 mt-4">CSV, Excel, Word, PDF, JSON • Max 25MB each</p>
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
          <p className="text-sm text-gray-600">{progressLabel || 'Uploading & parsing…'}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

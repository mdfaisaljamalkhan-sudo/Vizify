import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Edit3,
  X,
  Send,
  Loader2,
  ChevronDown,
  RotateCcw,
  Code2,
  History,
} from 'lucide-react'
import { useDashboardEdit } from '@/hooks/useDashboardEdit'
import { useThemeStore } from '@/store/themeStore'

interface ChatEditPanelProps {
  dashboardId: string
  extractedText: string
  onDashboardUpdate: (data: Record<string, any>) => void
}

interface EditLog {
  timestamp: string
  message: string
  status: 'success' | 'error'
  generatedCode?: string
  executionLog?: Record<string, any>
}

export function ChatEditPanel({
  dashboardId,
  extractedText,
  onDashboardUpdate,
}: ChatEditPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editLogs, setEditLogs] = useState<EditLog[]>([])
  const { isDark } = useThemeStore()
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const {
    editDashboard,
    getEditHistory,
    undoEdit,
    editHistory,
    isLoading,
    error,
    setError,
  } = useDashboardEdit()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [editLogs])

  useEffect(() => {
    if (isOpen && dashboardId) {
      getEditHistory(dashboardId)
    }
  }, [isOpen, dashboardId, getEditHistory])

  const handleSendEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !extractedText) return

    const timestamp = new Date().toLocaleTimeString()

    try {
      const result = await editDashboard(input, dashboardId, extractedText)

      if (result) {
        setEditLogs((prev) => [
          ...prev,
          {
            timestamp,
            message: input,
            status: result.status === 'success' ? 'success' : 'error',
            generatedCode: result.generated_code,
            executionLog: result.execution_log,
          },
        ])

        if (result.status === 'success' && result.dashboard_data) {
          onDashboardUpdate(result.dashboard_data)
          setInput('')
          // Refresh history
          await getEditHistory(dashboardId)
        }
      }
    } catch (err) {
      console.error('Edit error:', err)
      setEditLogs((prev) => [
        ...prev,
        {
          timestamp,
          message: input,
          status: 'error',
        },
      ])
    }
  }

  const handleUndo = async (targetVersion: number) => {
    try {
      const result = await undoEdit(dashboardId, targetVersion)
      if (result?.status === 'success' && result.dashboard_data) {
        onDashboardUpdate(result.dashboard_data)
        await getEditHistory(dashboardId)
        setEditLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            message: `Reverted to version ${targetVersion}`,
            status: 'success',
          },
        ])
      }
    } catch (err) {
      console.error('Undo error:', err)
    }
  }

  if (!extractedText) return null

  return (
    <div className="fixed bottom-20 right-6 z-40">
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="edit-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute bottom-16 right-0 w-96 h-[600px] rounded-lg shadow-2xl flex flex-col overflow-hidden ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            {/* Header */}
            <div
              className={`px-4 py-4 border-b ${
                isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
              } flex items-center justify-between`}
            >
              <h3 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Edit3 className="w-4 h-4" />
                Edit Dashboard
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} px-2`}>
              <button
                onClick={() => setShowHistory(false)}
                className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
                  !showHistory
                    ? isDark
                      ? 'border-b-2 border-blue-600 text-blue-400'
                      : 'border-b-2 border-blue-600 text-blue-600'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className={`flex-1 py-2 px-3 text-sm font-medium flex items-center justify-center gap-1 transition-colors ${
                  showHistory
                    ? isDark
                      ? 'border-b-2 border-blue-600 text-blue-400'
                      : 'border-b-2 border-blue-600 text-blue-600'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <History className="w-4 h-4" />
                History
              </button>
            </div>

            {/* Content */}
            {!showHistory ? (
              <>
                {/* Edit Logs */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {editLogs.length === 0 && (
                    <div
                      className={`text-center py-8 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      <p className="text-sm">
                        Describe changes you want to make...
                      </p>
                    </div>
                  )}
                  {editLogs.map((log, i) => (
                    <div key={i} className="space-y-2">
                      <div
                        className={`flex items-start gap-2 ${
                          log.status === 'success' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                            log.status === 'success'
                              ? 'bg-green-600 text-white'
                              : isDark
                                ? 'bg-red-900 text-red-100'
                                : 'bg-red-100 text-red-900'
                          }`}
                        >
                          <p className="font-medium text-xs opacity-75">
                            {log.timestamp}
                          </p>
                          <p>{log.message}</p>
                        </div>
                      </div>
                      {log.generatedCode && (
                        <button
                          onClick={() => setShowCode(!showCode)}
                          className={`ml-2 text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                            isDark
                              ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          <Code2 className="w-3 h-3" />
                          View Code
                        </button>
                      )}
                      {showCode && log.generatedCode && (
                        <div
                          className={`ml-2 p-2 rounded text-xs font-mono overflow-x-auto ${
                            isDark
                              ? 'bg-gray-900 text-gray-300'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <pre className="break-words whitespace-pre-wrap">
                            {log.generatedCode}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form
                  onSubmit={handleSendEdit}
                  className={`px-4 py-4 border-t ${
                    isDark
                      ? 'border-gray-700 bg-gray-900'
                      : 'border-gray-200 bg-gray-50'
                  } flex gap-2`}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Change title, hide elements..."
                    disabled={isLoading}
                    className={`flex-1 px-3 py-2 rounded border text-sm ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } disabled:opacity-50`}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>

                {error && (
                  <div className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 text-xs rounded">
                    {error}
                  </div>
                )}
              </>
            ) : (
              /* History Tab */
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {editHistory.length === 0 ? (
                  <div
                    className={`text-center py-8 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    <p className="text-sm">No edit history yet</p>
                  </div>
                ) : (
                  editHistory.map((item) => (
                    <button
                      key={item.version_number}
                      onClick={() => handleUndo(item.version_number)}
                      className={`w-full text-left px-3 py-2 rounded transition-colors ${
                        isDark
                          ? 'hover:bg-gray-700 bg-gray-900'
                          : 'hover:bg-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p
                            className={`text-sm font-medium ${
                              isDark ? 'text-gray-200' : 'text-gray-900'
                            }`}
                          >
                            v{item.version_number}
                          </p>
                          <p
                            className={`text-xs ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}
                          >
                            {item.change_description || 'Unnamed edit'}
                          </p>
                          <p
                            className={`text-xs ${
                              isDark ? 'text-gray-500' : 'text-gray-500'
                            }`}
                          >
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                        <RotateCcw className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`p-4 rounded-full shadow-lg transition-all ${
          isDark
            ? 'bg-purple-700 hover:bg-purple-600 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
        title="Edit dashboard"
      >
        <Edit3 className="w-6 h-6" />
      </motion.button>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

// Lightweight formatter: renders bullet points and bold without a markdown lib
function formatResponse(text: string) {
  const lines = text.split('\n').filter(l => l.trim())
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        // Bullet lines
        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.replace(/^[•\-\*]\s*/, '')
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue-400 flex-shrink-0 font-bold mt-0.5">•</span>
              <span>{renderInline(content)}</span>
            </div>
          )
        }
        // Bottom line / label lines
        if (trimmed.toLowerCase().startsWith('bottom line')) {
          return (
            <div key={i} className="mt-2 pt-2 border-t border-white/10 text-xs font-semibold opacity-80">
              {renderInline(trimmed)}
            </div>
          )
        }
        return <p key={i}>{renderInline(trimmed)}</p>
      })}
    </div>
  )
}

function renderInline(text: string) {
  // Bold: **text** → <strong>
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)
}
import { chatWithDashboard } from '@/api/client'
import { useThemeStore } from '@/store/themeStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatWindowProps {
  extractedText: string | null
  dashboardContext: any
}

export function ChatWindow({ extractedText, dashboardContext }: ChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { isDark } = useThemeStore()
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !extractedText) return

    // Add user message
    const userMessage: Message = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await chatWithDashboard(
        input,
        extractedText,
        dashboardContext
      )
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error while processing your question. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  if (!extractedText) return null

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute bottom-16 right-0 w-96 h-[520px] rounded-lg shadow-2xl flex flex-col overflow-hidden ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            {/* Header */}
            <div className={`px-4 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Dashboard Assistant
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p className="text-sm">Ask questions about your data...</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : isDark
                          ? 'bg-gray-700 text-gray-100'
                          : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {msg.role === 'assistant' ? formatResponse(msg.content) : msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSendMessage}
              className={`px-4 py-4 border-t ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} flex gap-2`}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your data..."
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
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${
          isDark
            ? 'bg-blue-700 hover:bg-blue-600 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        title="Ask questions about your data"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium">Ask AI</span>
      </motion.button>
    </div>
  )
}

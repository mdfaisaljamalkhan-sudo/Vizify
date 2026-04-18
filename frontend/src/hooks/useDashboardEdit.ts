import { useState, useCallback } from 'react'
import { apiClient } from '@/api/client'

interface EditHistoryItem {
  version_number: number
  change_description: string | null
  created_at: string
}

interface EditResponse {
  status: 'success' | 'error' | 'review_required'
  dashboard_data?: Record<string, any>
  edit_description?: string
  error?: string
  generated_code?: string
  execution_log?: Record<string, any>
}

export function useDashboardEdit() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([])

  const editDashboard = useCallback(
    async (
      message: string,
      dashboardId: string,
      extractedText: string
    ): Promise<EditResponse | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await apiClient.post('/api/chat/edit', {
          message,
          dashboard_id: dashboardId,
          extracted_text: extractedText,
        })

        if (response.data.status === 'error') {
          setError(response.data.error || 'Edit failed')
          return response.data
        }

        return response.data
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to edit dashboard'
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const getEditHistory = useCallback(
    async (dashboardId: string): Promise<void> => {
      try {
        const response = await apiClient.get(`/api/chat/edit/history/${dashboardId}`)
        setEditHistory(response.data.history || [])
      } catch (err) {
        console.error('Failed to load edit history:', err)
      }
    },
    []
  )

  const undoEdit = useCallback(
    async (
      dashboardId: string,
      targetVersion?: number
    ): Promise<EditResponse | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await apiClient.post('/api/chat/edit/undo', {
          dashboard_id: dashboardId,
          target_version: targetVersion,
        })

        if (response.data.status === 'error') {
          setError(response.data.error || 'Undo failed')
          return response.data
        }

        return response.data
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to undo edit'
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return {
    editDashboard,
    getEditHistory,
    undoEdit,
    editHistory,
    isLoading,
    error,
    setError,
  }
}

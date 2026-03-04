import { create } from 'zustand'
import type { WorkflowStatus } from '@/types'

/**
 * Manages the overall application workflow state.
 * Tracks where the user is in the draw → analyze → generate → preview flow.
 */

interface WorkflowStore {
  // Current workflow status
  status: WorkflowStatus
  
  // Error message when status is 'error'
  errorMessage: string | null
  
  // Generated HTML code for preview
  previewCode: string | null
  
  // Which AI provider was used (shown in UI)
  lastProvider: 'gemini' | 'groq' | null
  
  // User's prompt text
  prompt: string
  
  // Global theme/style hint
  globalTheme: string
  
  // Actions
  setStatus: (status: WorkflowStatus) => void
  setError: (message: string) => void
  clearError: () => void
  setPreviewCode: (code: string, provider?: 'gemini' | 'groq') => void
  clearPreview: () => void
  setPrompt: (prompt: string) => void
  setGlobalTheme: (theme: string) => void
  reset: () => void
}

const initialState = {
  status: 'idle' as WorkflowStatus,
  errorMessage: null,
  previewCode: null,
  lastProvider: null,
  prompt: '',
  globalTheme: '',
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status, errorMessage: status === 'error' ? undefined : null }),

  setError: (message) => set({ status: 'error', errorMessage: message }),

  clearError: () => set({ status: 'idle', errorMessage: null }),

  setPreviewCode: (code, provider) => set({ 
    previewCode: code, 
    lastProvider: provider || null,
    status: 'preview_ready' 
  }),

  clearPreview: () => set({ previewCode: null, lastProvider: null, status: 'idle' }),

  setPrompt: (prompt) => set({ prompt }),

  setGlobalTheme: (theme) => set({ globalTheme: theme }),

  reset: () => set(initialState),
}))
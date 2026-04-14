// =============================================================================
// Workflow Store — with Project Persistence & Auto-Save
// src/store/workflow-store.ts
// =============================================================================

import { create } from 'zustand'

// =============================================================================
// Types
// =============================================================================

export type WorkflowStatus =
  | 'idle'
  | 'analyzing'
  | 'generating'
  | 'success'
  | 'error'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export interface WorkflowState {
  // Project identity
  projectId: string | null
  projectName: string

  // Workflow state
  status: WorkflowStatus
  error: string | null

  // Content
  prompt: string
  globalTheme: string
  previewCode: string

  // Save state
  saveStatus: SaveStatus
  lastSavedAt: Date | null

  // Auto-save timer reference (not serialized)
  _saveTimer: ReturnType<typeof setTimeout> | null
}

export interface WorkflowActions {
  // Project management
  setProjectId: (id: string | null) => void
  setProjectName: (name: string) => void
  loadProject: (project: {
    id: string
    name: string
    prompt?: string | null
    generated_code?: string | null
    global_theme?: string | null
  }) => void

  // Workflow
  setStatus: (status: WorkflowStatus) => void
  setError: (error: string | null) => void

  // Content
  setPrompt: (prompt: string) => void
  setGlobalTheme: (theme: string) => void
  setPreviewCode: (code: string) => void

  // Save
  setSaveStatus: (status: SaveStatus) => void
  triggerAutoSave: (getCanvasData: () => unknown) => void
  saveNow: (getCanvasData: () => unknown) => Promise<void>

  // Reset
  reset: () => void
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: WorkflowState = {
  projectId: null,
  projectName: 'Untitled Project',
  status: 'idle',
  error: null,
  prompt: '',
  globalTheme: '',
  previewCode: '',
  saveStatus: 'saved',
  lastSavedAt: null,
  _saveTimer: null,
}

// =============================================================================
// Auto-save helper
// =============================================================================

async function performSave(
  projectId: string,
  payload: {
    name: string
    prompt: string
    generated_code: string
    global_theme: string
    canvas_data: unknown
  }
): Promise<boolean> {
  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch (error) {
    console.error('[AutoSave] Network error:', error)
    return false
  }
}

// =============================================================================
// Store
// =============================================================================

export const useWorkflowStore = create<WorkflowState & WorkflowActions>((set, get) => ({
  ...initialState,

  // ─── Project management ───────────────────────────────────────────────────

  setProjectId: (id) => set({ projectId: id }),

  setProjectName: (name) => {
    set({ projectName: name, saveStatus: 'unsaved' })
  },

  loadProject: (project) => {
    set({
      projectId: project.id,
      projectName: project.name,
      prompt: project.prompt ?? '',
      previewCode: project.generated_code ?? '',
      globalTheme: project.global_theme ?? '',
      saveStatus: 'saved',
      lastSavedAt: new Date(),
      status: 'idle',
      error: null,
    })
  },

  // ─── Workflow ─────────────────────────────────────────────────────────────

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),

  // ─── Content ──────────────────────────────────────────────────────────────

  setPrompt: (prompt) => {
    set({ prompt, saveStatus: 'unsaved' })
  },

  setGlobalTheme: (globalTheme) => {
    set({ globalTheme, saveStatus: 'unsaved' })
  },

  setPreviewCode: (previewCode) => {
    set({ previewCode, saveStatus: 'unsaved' })
  },

  // ─── Save ─────────────────────────────────────────────────────────────────

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  triggerAutoSave: (getCanvasData) => {
    const state = get()

    // Clear existing timer
    if (state._saveTimer) {
      clearTimeout(state._saveTimer)
    }

    // Mark as unsaved immediately
    set({ saveStatus: 'unsaved' })

    // Set new debounced timer — 3 seconds
    const timer = setTimeout(async () => {
      await get().saveNow(getCanvasData)
    }, 3000)

    set({ _saveTimer: timer })
  },

  saveNow: async (getCanvasData) => {
    const state = get()

    if (!state.projectId) {
      // No project yet — nothing to save
      return
    }

    set({ saveStatus: 'saving' })

    const success = await performSave(state.projectId, {
      name: state.projectName,
      prompt: state.prompt,
      generated_code: state.previewCode,
      global_theme: state.globalTheme,
      canvas_data: getCanvasData(),
    })

    if (success) {
      set({ saveStatus: 'saved', lastSavedAt: new Date() })
    } else {
      set({ saveStatus: 'error' })
    }
  },

  // ─── Reset ────────────────────────────────────────────────────────────────

  reset: () => {
    const state = get()
    if (state._saveTimer) {
      clearTimeout(state._saveTimer)
    }
    set(initialState)
  },
}))
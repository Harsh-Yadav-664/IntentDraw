// =============================================================================
// Workflow Store — with Project Persistence & Auto-Save
// src/store/workflow-store.ts
// =============================================================================

import { create } from 'zustand'
import type { AIProvider } from '@/types'
import type { DesignBrief } from '@/lib/ai/brief'
import { parseSavedParts, type PageParts } from '@/lib/ai/page-parts'

// =============================================================================
// Types
// =============================================================================

/** What the generator is doing right now, shown while a staged run is in flight. */
export interface GenerationProgress {
  label: string
  done: number
  total: number
}

export type WorkflowStatus =
  | 'idle'
  | 'drawing'
  | 'analyzing'
  | 'regions_ready'
  | 'generating'
  | 'preview_ready'
  | 'success'
  | 'error'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export interface WorkflowState {
  // Project identity
  projectId: string | null
  projectName: string

  // Workflow state
  status: WorkflowStatus
  /** Live progress of a staged generation, so a long run never looks stalled. */
  generationProgress: GenerationProgress | null
  error: string | null

  // Content
  prompt: string
  globalTheme: string
  previewCode: string
  // What the understanding stage made of the last request — shown to the user
  // so a misread drawing is visible instead of silently shaping the output.
  // In-memory only for now.
  brief: DesignBrief | null
  /**
   * The pieces the last generation was assembled from, so one section can be
   * rebuilt without regenerating the page. Saved inside canvas_data as
   * `pageParts`, and restored only if they still reproduce the saved page.
   */
  pageParts: PageParts | null
  /** The section being rebuilt right now, if any. */
  rebuildingSection: string | null
  /** Why the last rebuild failed, shown on that section's row. */
  rebuildError: { section: string; message: string } | null
  aiProvider: AIProvider
  nvidiaModelId: string

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
    canvas_data?: unknown
  }) => void

  // Workflow
  setStatus: (status: WorkflowStatus) => void
  setGenerationProgress: (progress: GenerationProgress | null) => void
  setError: (error: string | null) => void

  // Content
  setPrompt: (prompt: string) => void
  setGlobalTheme: (theme: string) => void
  setPreviewCode: (code: string) => void
  setBrief: (brief: DesignBrief | null) => void
  setPageParts: (parts: PageParts | null) => void
  setRebuild: (rebuildingSection: string | null, rebuildError?: { section: string; message: string } | null) => void
  setAiProvider: (provider: AIProvider) => void
  setNvidiaModelId: (modelId: string) => void

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
  generationProgress: null,
  error: null,
  prompt: '',
  globalTheme: '',
  previewCode: '',
  brief: null,
  pageParts: null,
  rebuildingSection: null,
  rebuildError: null,
  aiProvider: 'gemini',
  nvidiaModelId: 'nvidia/nemotron-3.5-lightning-30b-a3b',
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
      brief: null,
      // Older projects have none; stale or malformed parts are dropped.
      pageParts: parseSavedParts(
        project.canvas_data && typeof project.canvas_data === 'object' && !Array.isArray(project.canvas_data)
          ? (project.canvas_data as { pageParts?: unknown }).pageParts
          : null,
        project.generated_code
      ),
      rebuildingSection: null,
      rebuildError: null,
      globalTheme: project.global_theme ?? '',
      saveStatus: 'saved',
      lastSavedAt: new Date(),
      status: 'idle',
      generationProgress: null,
      error: null,
    })
  },

  // ─── Workflow ─────────────────────────────────────────────────────────────

  setStatus: (status) => set({ status }),

  setGenerationProgress: (generationProgress) => set({ generationProgress }),

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

  setBrief: (brief) => set({ brief }),

  setPageParts: (pageParts) => set({ pageParts }),

  setRebuild: (rebuildingSection, rebuildError = null) => set({ rebuildingSection, rebuildError }),

  setAiProvider: (aiProvider) => {
    set({ aiProvider })
  },

  setNvidiaModelId: (nvidiaModelId) => {
    set({ nvidiaModelId })
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

    // The generation's parts ride along inside canvas_data (no migration), so
    // a section can still be rebuilt after a reload.
    const canvasData = getCanvasData()
    const canvas_data =
      state.pageParts && canvasData && typeof canvasData === 'object' && !Array.isArray(canvasData)
        ? { ...canvasData, pageParts: state.pageParts }
        : canvasData

    const success = await performSave(state.projectId, {
      name: state.projectName,
      prompt: state.prompt,
      generated_code: state.previewCode,
      global_theme: state.globalTheme,
      canvas_data,
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
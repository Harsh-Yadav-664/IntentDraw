// =============================================================================
// Workflow Store — with Project Persistence & Auto-Save
// src/store/workflow-store.ts
// =============================================================================

import { create } from 'zustand'
import type { AIProvider } from '@/types'
import type { DesignBrief } from '@/lib/ai/brief'
import { assembleParts, parseSavedParts, type PageParts } from '@/lib/ai/page-parts'

// =============================================================================
// Types
// =============================================================================

/** What the generator is doing right now, shown while a staged run is in flight. */
export interface GenerationProgress {
  label: string
  done: number
  total: number
}

/** One section of the page being built, as the editor shows it while a run is in flight. */
export interface PlannedSection {
  name: string
  status: 'queued' | 'building' | 'built' | 'failed'
}

/**
 * Something wrong with the page on screen: it doesn't compile, or it crashed
 * while rendering. Shown as a notice and behind the top bar's issue button —
 * never as raw red text where the site should be.
 */
export interface PreviewIssue {
  kind: 'compile' | 'runtime'
  /** The technical message, as the compiler or React reported it. */
  message: string
  /** The section the problem is in, when it could be worked out. */
  section: string | null
  line: number | null
  /** One section crashed and was left out; the rest of the page is showing. */
  partial?: boolean
}

/** Why the last run stopped: the daily limit needs a different answer than a failure. */
export type ErrorKind = 'quota' | 'failed'

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
  /** The page's sections and how far each has got — live during a run. */
  buildPlan: PlannedSection[] | null
  error: string | null
  errorKind: ErrorKind | null

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
  /** What is wrong with the page on screen, if anything. */
  issue: PreviewIssue | null
  /** The notice can be closed; the issue stays reachable from the top bar. */
  issueNoticeOpen: boolean
  /** What the layout audit (page-audit.ts) found on the page shown, as a rebuild note per section. */
  audit: Record<string, string>
  aiProvider: AIProvider
  nvidiaModelId: string

  // Save state
  saveStatus: SaveStatus
  lastSavedAt: Date | null

  // Auto-save timer reference (not serialized)
  _saveTimer: ReturnType<typeof setTimeout> | null
  /**
   * Saved parts this session could not use, and the page they belong to. A
   * save writes them back untouched for as long as that page is unchanged —
   * failing to read something must never be a reason to delete it.
   */
  _unreadParts: { raw: unknown; forCode: string } | null
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
  setBuildPlan: (plan: PlannedSection[] | null) => void
  setError: (error: string | null, kind?: ErrorKind) => void

  // Content
  setPrompt: (prompt: string) => void
  setGlobalTheme: (theme: string) => void
  setPreviewCode: (code: string) => void
  setBrief: (brief: DesignBrief | null) => void
  setPageParts: (parts: PageParts | null) => void
  setRebuild: (rebuildingSection: string | null, rebuildError?: { section: string; message: string } | null) => void
  setIssue: (issue: PreviewIssue | null) => void
  closeIssueNotice: () => void
  setAudit: (audit: Record<string, string>) => void
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
  buildPlan: null,
  error: null,
  errorKind: null,
  prompt: '',
  globalTheme: '',
  previewCode: '',
  brief: null,
  pageParts: null,
  rebuildingSection: null,
  rebuildError: null,
  issue: null,
  issueNoticeOpen: false,
  audit: {},
  aiProvider: 'gemini',
  nvidiaModelId: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  saveStatus: 'saved',
  lastSavedAt: null,
  _saveTimer: null,
  _unreadParts: null,
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
    // Older projects have none; stale or malformed parts are not used.
    const rawParts =
      project.canvas_data && typeof project.canvas_data === 'object' && !Array.isArray(project.canvas_data)
        ? (project.canvas_data as { pageParts?: unknown }).pageParts
        : null
    const pageParts = parseSavedParts(rawParts, project.generated_code)
    // Always the page its parts assemble to. For a page saved before a class
    // of assembly error was fixed, that is the repaired page — no rebuild, no
    // model call. The next save stores it.
    const saved = project.generated_code ?? ''
    const previewCode = (pageParts && assembleParts(pageParts).code) || saved
    set({
      projectId: project.id,
      projectName: project.name,
      prompt: project.prompt ?? '',
      previewCode,
      // The reading of the drawing comes back with the page it built, so
      // "What I understood" survives a reload instead of going blank.
      brief: pageParts?.brief ?? null,
      pageParts,
      buildPlan: null,
      errorKind: null,
      rebuildingSection: null,
      rebuildError: null,
      issue: null,
      issueNoticeOpen: false,
      audit: {},
      _unreadParts: !pageParts && rawParts ? { raw: rawParts, forCode: saved } : null,
      globalTheme: project.global_theme ?? '',
      saveStatus: previewCode === saved ? 'saved' : 'unsaved',
      lastSavedAt: new Date(),
      status: 'idle',
      generationProgress: null,
      error: null,
    })
  },

  // ─── Workflow ─────────────────────────────────────────────────────────────

  setStatus: (status) => set({ status }),

  setGenerationProgress: (generationProgress) => set({ generationProgress }),

  setBuildPlan: (buildPlan) => set({ buildPlan }),

  setError: (error, kind) => set({ error, errorKind: error ? (kind ?? 'failed') : null, status: error ? 'error' : 'idle' }),

  // ─── Content ──────────────────────────────────────────────────────────────

  setPrompt: (prompt) => {
    set({ prompt, saveStatus: 'unsaved' })
  },

  setGlobalTheme: (globalTheme) => {
    set({ globalTheme, saveStatus: 'unsaved' })
  },

  setPreviewCode: (previewCode) => {
    // An issue belongs to the page it was found in; a new page starts clean.
    set({ previewCode, saveStatus: 'unsaved', issue: null, issueNoticeOpen: false, audit: {} })
  },

  setBrief: (brief) => set({ brief }),

  setPageParts: (pageParts) => set({ pageParts }),

  setRebuild: (rebuildingSection, rebuildError = null) => set({ rebuildingSection, rebuildError }),

  setIssue: (issue) => {
    const current = get().issue
    // Two frames (the canvas backdrop and the Output view) report the same crash.
    if (issue && current && current.kind === issue.kind && current.message === issue.message) return
    // A compile error is the cause; a crash report arriving after it adds nothing.
    if (issue && current && current.kind === 'compile' && issue.kind === 'runtime') return
    // A page that is down matters more than one section of it; and one issue is
    // shown at a time, so a second section's crash waits for the first fix.
    if (issue?.partial && current && (!current.partial || current.section !== issue.section)) return
    set({ issue, issueNoticeOpen: issue !== null })
  },

  closeIssueNotice: () => set({ issueNoticeOpen: false }),
  setAudit: (audit) => set({ audit }),

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
    const parts = state.pageParts ?? (state._unreadParts?.forCode === state.previewCode ? state._unreadParts.raw : null)
    const canvas_data =
      parts && canvasData && typeof canvasData === 'object' && !Array.isArray(canvasData)
        ? { ...canvasData, pageParts: parts }
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
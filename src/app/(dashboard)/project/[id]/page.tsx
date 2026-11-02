// =============================================================================
// Project Editor Page
// src/app/(dashboard)/project/[id]/page.tsx
// =============================================================================
// Loads a project, renders the editor, and auto-saves (debounced 3s) whenever
// the drawing, prompt, name or generated page changes.
// =============================================================================

'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { toast } from 'sonner'
import { useWorkflowStore } from '@/store/workflow-store'
import { useCanvasStore, parseCanvasData } from '@/store/canvas-store'
import { Editor } from '@/components/editor/editor'
import { ButtonLink } from '@/components/kit/kit'
import { LogoMark, SketchEmptyState } from '@/components/kit/sketch'

type PageProps = { params: Promise<{ id: string }> }

export default function ProjectPage({ params }: PageProps) {
  const { id } = use(params)

  const loadProject = useWorkflowStore((s) => s.loadProject)
  const triggerAutoSave = useWorkflowStore((s) => s.triggerAutoSave)
  const setCanvasData = useCanvasStore((s) => s.setCanvasData)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPublic, setIsPublic] = useState(false)

  // ─── Load project on mount ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${id}`)
        const json = await res.json()
        if (cancelled) return

        if (!json.success || !json.data?.project) {
          setNotFound(true)
          setLoading(false)
          return
        }

        const project = json.data.project
        // Always reset the canvas: the store outlives navigation, and a project
        // with no drawing must not inherit the previous project's shapes.
        setCanvasData(parseCanvasData(project.canvas_data))
        useCanvasStore.getState().setViewMode('canvas')
        useCanvasStore.getState().setActiveTool('select')
        loadProject(project)
        setIsPublic(!!project.is_public)
        setLoading(false)
      } catch (error) {
        console.error('Failed to load project', error)
        if (cancelled) return
        toast.error('Could not load the project')
        setNotFound(true)
        setLoading(false)
      }
    }

    fetchProject()
    return () => {
      cancelled = true
    }
  }, [id, loadProject, setCanvasData])

  // ─── Auto-save when canvas or workflow changes ────────────────────────────

  const getCanvasData = useCallback(() => {
    const { regions, groups } = useCanvasStore.getState()
    return { regions, groups }
  }, [])

  // Subscriptions rather than effects on store values, so a change never
  // re-renders this page.
  useEffect(() => {
    if (loading) return // Don't save while loading

    let lastPrompt = useWorkflowStore.getState().prompt
    let lastCode = useWorkflowStore.getState().previewCode
    let lastTheme = useWorkflowStore.getState().globalTheme
    let lastName = useWorkflowStore.getState().projectName
    let lastRegions = useCanvasStore.getState().regions
    let lastGroups = useCanvasStore.getState().groups

    const unsubWorkflow = useWorkflowStore.subscribe((state) => {
      if (
        state.prompt !== lastPrompt ||
        state.previewCode !== lastCode ||
        state.globalTheme !== lastTheme ||
        // The name is saved too — without it, renaming from the header marked
        // the project unsaved and then never actually persisted it.
        state.projectName !== lastName
      ) {
        lastPrompt = state.prompt
        lastCode = state.previewCode
        lastTheme = state.globalTheme
        lastName = state.projectName
        triggerAutoSave(getCanvasData)
      }
    })

    const unsubCanvas = useCanvasStore.subscribe((state) => {
      if (state.regions !== lastRegions || state.groups !== lastGroups) {
        lastRegions = state.regions
        lastGroups = state.groups
        triggerAutoSave(getCanvasData)
      }
    })

    // A save that failed while offline goes through once the connection is back.
    const retry = () => {
      const status = useWorkflowStore.getState().saveStatus
      if (status === 'error' || status === 'unsaved') void useWorkflowStore.getState().saveNow(getCanvasData)
    }
    window.addEventListener('online', retry)

    return () => {
      unsubWorkflow()
      unsubCanvas()
      window.removeEventListener('online', retry)
    }
  }, [loading, triggerAutoSave, getCanvasData])

  // ─── Not found ────────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
        <SketchEmptyState className="h-[130px] w-[220px]" />
        <h1 className="mt-8 text-[30px] text-ink">This project isn&apos;t here.</h1>
        <p className="mt-3 max-w-[44ch] text-[13.5px] leading-[1.7] text-muted">It may have been deleted, or it belongs to another account.</p>
        <ButtonLink href="/dashboard" variant="primary" className="mt-8">
          Back to projects
        </ButtonLink>
      </div>
    )
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <div className="flex h-[50px] items-center gap-2 border-b border-line bg-bg2 px-4">
          <LogoMark size={16} />
          <div className="shimmer h-3 w-40 rounded-full" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="mono-label pulse-dot text-faint">Opening project…</span>
        </div>
      </div>
    )
  }

  return <Editor projectId={id} isPublic={isPublic} onPublicChange={setIsPublic} />
}

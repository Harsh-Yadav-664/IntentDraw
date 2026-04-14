// =============================================================================
// Project Editor Page
// src/app/(dashboard)/project/[id]/page.tsx
// =============================================================================
// Loads a specific project, renders the canvas editor,
// auto-saves every 3 seconds when changes are made
// =============================================================================

'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkflowStore } from '@/store/workflow-store'
import { useCanvasStore } from '@/store/canvas-store'
import { SaveStatus } from '@/components/shared/save-status'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

// Import your existing dashboard canvas layout
// This is the same 3-panel layout from the old dashboard/page.tsx
// We just wrap it here and wire up the project loading/saving
import { CanvasEditor } from '@/components/shared/canvas-editor'

type PageProps = { params: Promise<{ id: string }> }

export default function ProjectPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const { loadProject, triggerAutoSave, projectName } = useWorkflowStore()
  const { regions, setRegions } = useCanvasStore()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // ─── Load project on mount ────────────────────────────────────────────────

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${id}`)
        const json = await res.json()

        if (!json.success || !json.data?.project) {
          setNotFound(true)
          setLoading(false)
          return
        }

        const project = json.data.project

        // Restore canvas state from saved canvas_data
        if (project.canvas_data && Array.isArray(project.canvas_data)) {
          setRegions(project.canvas_data)
        }

        // Restore workflow state
        loadProject(project)
        setLoading(false)
      } catch (error) {
        console.error('Failed to load project', error)
        toast.error('Failed to load project')
        setNotFound(true)
        setLoading(false)
      }
    }

    fetchProject()
  }, [id, loadProject, setRegions])

  // ─── Auto-save when canvas or workflow changes ────────────────────────────

  // getCanvasData: called by auto-save to capture current canvas state
  const getCanvasData = useCallback(() => {
    return useCanvasStore.getState().regions
  }, [])

  // Trigger auto-save whenever regions change
  useEffect(() => {
    if (loading) return // Don't save while loading
    triggerAutoSave(getCanvasData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]) // intentionally only watching regions for canvas changes

  // ─── Not found ────────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-xl font-medium">Project not found</h1>
        <p className="text-sm text-muted-foreground">
          This project doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button onClick={() => router.push('/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-muted-foreground">Loading project...</div>
      </div>
    )
  }

  // ─── Editor ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium truncate max-w-[200px]">
            {projectName}
          </span>
        </div>
        <SaveStatus />
      </div>

      {/* Canvas editor — your existing 3-panel layout */}
      <div className="flex-1 overflow-hidden">
        <CanvasEditor projectId={id} />
      </div>
    </div>
  )
}
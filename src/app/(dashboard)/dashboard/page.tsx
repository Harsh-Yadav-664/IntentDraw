// =============================================================================
// Dashboard Page — Project List
// src/app/(dashboard)/dashboard/page.tsx
// =============================================================================
// Shows list of user's projects + "New Project" button
// Clicking a project navigates to /project/[id]
// =============================================================================

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, MoreVertical, Pencil, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'

// =============================================================================
// Types
// =============================================================================

interface Project {
  id: string
  name: string
  prompt: string | null
  created_at: string
  updated_at: string
  is_public: boolean
}

// =============================================================================
// Helpers
// =============================================================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// =============================================================================
// Dashboard Page
// =============================================================================

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Load projects ────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const json = await res.json()
      if (json.success) {
        setProjects(json.data.projects)
      }
    } catch (error) {
      console.error('Failed to load projects', error)
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // ─── Create project ───────────────────────────────────────────────────────

  const handleNewProject = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Project' }),
      })
      const json = await res.json()

      if (json.success) {
        router.push(`/project/${json.data.project.id}`)
      } else {
        toast.error('Failed to create project')
        setCreating(false)
      }
    } catch (error) {
      console.error('Failed to create project', error)
      toast.error('Failed to create project')
      setCreating(false)
    }
  }

  // ─── Delete project ───────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/projects/${deleteId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== deleteId))
        toast.success('Project deleted')
      } else {
        toast.error('Failed to delete project')
      }
    } catch (error) {
      console.error('Failed to delete project', error)
      toast.error('Failed to delete project')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient background effect */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-30 pt-6 pb-4 px-6">
        <div className="max-w-6xl mx-auto glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Draw your layout, let AI build it
            </p>
          </div>
          <Button onClick={handleNewProject} disabled={creating} className="rounded-full shadow-[0_0_15px_rgba(200,150,50,0.3)] hover:shadow-[0_0_25px_rgba(200,150,50,0.5)] transition-shadow">
            <Plus className="h-4 w-4 mr-2" />
            {creating ? 'Creating...' : 'New Project'}
          </Button>
        </div>
      </div>

      {/* Project grid */}
      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl bg-muted/20" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-32 text-center glass-panel rounded-3xl mt-8">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <Pencil className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-medium mb-2 text-foreground/90">No projects yet</h2>
            <p className="text-base text-muted-foreground mb-8 max-w-md">
              Create your first project to start drawing layouts and generating beautiful web interfaces.
            </p>
            <Button size="lg" className="rounded-full shadow-[0_0_20px_rgba(200,150,50,0.4)]" onClick={handleNewProject} disabled={creating}>
              <Plus className="h-5 w-5 mr-2" />
              {creating ? 'Creating...' : 'Create first project'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="group cursor-pointer hover-lift relative bg-card/40 backdrop-blur-md border-white/10 overflow-hidden"
                onClick={() => router.push(`/project/${project.id}`)}
              >
                {/* Hover gradient effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-display font-medium line-clamp-2 leading-snug">
                      {project.name}
                    </CardTitle>
                    {/* Prevent card click when using dropdown */}
                    <div onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-white/10"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover/90 backdrop-blur-lg border-white/10">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => setDeleteId(project.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  {project.prompt && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {project.prompt}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
                      <Clock className="h-3.5 w-3.5" />
                      {formatRelativeTime(project.updated_at)}
                    </div>
                    {project.is_public && (
                      <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                        Public
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="glass-panel border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its generated code.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="border-white/10 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_0_15px_rgba(200,50,50,0.3)]"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
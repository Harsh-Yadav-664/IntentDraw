// =============================================================================
// Save Status Indicator
// src/components/shared/save-status.tsx
// =============================================================================
// Shows "Saving...", "Saved", "Unsaved changes", or "Save failed"
// Drop this anywhere in the dashboard header/toolbar
// =============================================================================

'use client'

import { useWorkflowStore } from '@/store/workflow-store'
import { cn } from '@/lib/utils'

export function SaveStatus() {
  const { saveStatus, lastSavedAt } = useWorkflowStore()

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {saveStatus === 'saving' && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {saveStatus === 'saved' && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-muted-foreground">
            Saved{lastSavedAt ? ` at ${formatTime(lastSavedAt)}` : ''}
          </span>
        </>
      )}
      {saveStatus === 'unsaved' && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
          <span className="text-muted-foreground">Unsaved changes</span>
        </>
      )}
      {saveStatus === 'error' && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className={cn('text-red-500')}>Save failed</span>
        </>
      )}
    </div>
  )
}
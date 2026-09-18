'use client'

import { useEffect, useRef, useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { Pencil } from 'lucide-react'

/**
 * Click-to-edit project name in the editor header.
 *
 * Renaming writes through `setProjectName`, which marks the project unsaved;
 * the page's auto-save subscription picks the change up and persists it, so
 * there's no second save path to keep in sync.
 */
export function ProjectTitle() {
  const projectName = useWorkflowStore((s) => s.projectName)
  const setProjectName = useWorkflowStore((s) => s.setProjectName)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim().slice(0, 100)
    // An empty name would leave the header blank with no way back to it.
    if (next && next !== projectName) setProjectName(next)
    else setDraft(projectName)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        maxLength={100}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(projectName)
            setEditing(false)
          }
        }}
        className="w-[220px] rounded-lg border border-primary/40 bg-black/40 px-2.5 py-1 text-sm font-display font-medium text-foreground outline-none focus:border-primary"
        aria-label="Project name"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(projectName)
        setEditing(true)
      }}
      title="Click to rename"
      className="group flex items-center gap-2 rounded-lg px-2.5 py-1 text-sm font-display font-medium text-foreground/90 transition-colors hover:bg-white/5"
    >
      <span className="max-w-[220px] truncate">{projectName}</span>
      <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

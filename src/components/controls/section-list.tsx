'use client'

import { useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { listSections, MAX_SECTION_NOTE_CHARS } from '@/lib/ai/page-parts'
import { AlertTriangle, LayoutList, Loader2, RefreshCw } from 'lucide-react'

/**
 * The generated page's sections, each rebuildable on its own.
 *
 * A full generation is several model calls and minutes of waiting; when one
 * section comes out weak — or failed and is still a placeholder — rebuilding
 * just that one costs a single call and leaves the rest of the page (and the
 * user's drawing) untouched.
 */
export function SectionList() {
  const parts = useWorkflowStore((s) => s.pageParts)
  const rebuilding = useWorkflowStore((s) => s.rebuildingSection)
  const rebuildError = useWorkflowStore((s) => s.rebuildError)
  const generating = useWorkflowStore((s) => s.status === 'generating')
  const { rebuildSection } = useAI()

  const [openRow, setOpenRow] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  if (!parts) return null
  const sections = listSections(parts)
  if (sections.length === 0) return null

  const busy = generating || rebuilding !== null

  const rebuild = async (name: string) => {
    const ok = await rebuildSection(name, notes[name])
    if (ok) {
      setNotes((n) => ({ ...n, [name]: '' }))
      setOpenRow(null)
    }
  }

  return (
    <div className="flex-shrink-0 rounded-xl border border-white/10 bg-black/20" data-testid="section-list">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <LayoutList className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground/90">Sections</span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">rebuild one without regenerating</span>
      </div>

      <ul className="pb-1.5">
        {sections.map(({ name, status }) => {
          const isRebuilding = rebuilding === name
          const isOpen = openRow === name
          const error = rebuildError?.section === name ? rebuildError.message : null

          return (
            <li key={name} className="border-t border-white/5 px-3 py-1.5" data-section={name} data-status={status}>
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    status === 'built' ? 'bg-emerald-400/80' : status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground/40'
                  }`}
                />
                <span className="flex-1 truncate text-xs text-foreground/85">{name}</span>
                {status === 'failed' && !isRebuilding && (
                  <span className="flex items-center gap-1 text-[10px] text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    failed
                  </span>
                )}
                {isRebuilding ? (
                  <span className="flex items-center gap-1 text-[10px] text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    rebuilding…
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenRow(isOpen ? null : name)}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Rebuild
                  </button>
                )}
              </div>

              {isOpen && !isRebuilding && (
                <form
                  className="mt-1.5 flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void rebuild(name)
                  }}
                >
                  <input
                    autoFocus
                    value={notes[name] ?? ''}
                    maxLength={MAX_SECTION_NOTE_CHARS}
                    onChange={(e) => setNotes((n) => ({ ...n, [name]: e.target.value }))}
                    placeholder="Optional: what to change (e.g. make it a comparison table)"
                    aria-label={`What to change in ${name}`}
                    disabled={busy}
                    className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-7 rounded-md bg-primary/20 px-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/30 disabled:opacity-40"
                  >
                    Rebuild
                  </button>
                </form>
              )}

              {error && <p className="mt-1 text-[10px] leading-snug text-destructive/90">{error}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

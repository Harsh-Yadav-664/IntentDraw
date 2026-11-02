'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, Star } from 'lucide-react'
import { Block, cx } from '@/components/kit/kit'
import { useWorkflowStore } from '@/store/workflow-store'
import { builtByLine, preferenceRecord, VERSIONS_ENABLED, type PageVersion, type VersionKind } from '@/lib/ai/versions'

const KIND_LABEL: Record<VersionKind, string> = {
  run: 'run',
  'before-pictures': 'pictures',
  'first-answer': 'look check',
  'auto-fix': 'auto-fix',
  rebuild: 'rebuild',
  earlier: 'earlier',
}

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Every page this session's runs produced on their way to the one shown —
 * development only (versions.ts). "Show" puts one back on screen (and it is
 * what gets saved); the star marks the one preferred and logs that choice with
 * the prompt and the models behind each section.
 */
export function Versions() {
  const versions = useWorkflowStore((s) => s.versions)
  const previewCode = useWorkflowStore((s) => s.previewCode)
  const preferredId = useWorkflowStore((s) => s.preferredVersionId)
  const generating = useWorkflowStore((s) => s.status === 'generating')
  const busy = useWorkflowStore((s) => s.rebuildingSection !== null) || generating
  const [sending, setSending] = useState<string | null>(null)

  if (!VERSIONS_ENABLED || versions.length === 0) return null

  const show = (v: PageVersion) => useWorkflowStore.getState().showVersion(v.id)

  const prefer = async (v: PageVersion) => {
    const { projectId, aiProvider, versions: all, setPreferredVersion, showVersion } = useWorkflowStore.getState()
    setSending(v.id)
    try {
      const record = preferenceRecord(v, all, { projectId, providerChoice: aiProvider })
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })
      const result = await res.json().catch(() => null)
      if (!result?.success) throw new Error(result?.error || `HTTP ${res.status}`)
      setPreferredVersion(v.id)
      showVersion(v.id)
      toast.success('Preference logged', {
        description: record.contested.length > 0 ? `${record.contested.length} section comparison${record.contested.length === 1 ? '' : 's'} recorded.` : 'No section differed from the other versions.',
      })
    } catch (error) {
      toast.error('Could not log the preference', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSending(null)
    }
  }

  return (
    <Block title="Versions" meta={<span className="mono-label text-faint">dev · {versions.length}</span>}>
      <p className="mb-2.5 text-[11px] leading-[1.6] text-faint">
        Every page this session made, oldest first. Nothing extra is generated. Show one to put it back; star the one you like best to log it.
      </p>
      <div className="overflow-hidden rounded-[10px] border border-line" data-testid="version-list">
        {versions.map((v) => {
          const current = v.code === previewCode
          const by = builtByLine(v.parts)
          return (
            <div key={v.id} className={cx('flex items-start gap-2 border-b border-line px-3 py-2 last:border-0', current && 'bg-surface2')} data-version={v.kind}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="mono-label shrink-0 text-faint">{KIND_LABEL[v.kind]}</span>
                  <span className="truncate text-[12px] text-ink" title={v.label}>{v.label}</span>
                </div>
                <div className="mt-0.5 truncate text-[10.5px] text-faint" title={by}>
                  {time(v.at)}
                  {by && ` · ${by}`}
                  {current && <span className="text-accent"> · on screen</span>}
                </div>
              </div>
              <button
                type="button"
                disabled={busy || current}
                onClick={() => show(v)}
                aria-label={`Show ${v.label}`}
                title="Show this version"
                className="rounded-[6px] p-1.5 text-faint transition-colors hover:bg-surface2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                disabled={busy || sending !== null || versions.length < 2}
                onClick={() => void prefer(v)}
                aria-label={`Prefer ${v.label}`}
                aria-pressed={preferredId === v.id}
                title={versions.length < 2 ? 'Only one version so far' : 'I like this one best'}
                className={cx(
                  'rounded-[6px] p-1.5 transition-colors hover:bg-surface2 disabled:pointer-events-none disabled:opacity-40',
                  preferredId === v.id ? 'text-accent' : 'text-faint hover:text-ink',
                )}
              >
                <Star size={12} fill={preferredId === v.id ? 'currentColor' : 'none'} />
              </button>
            </div>
          )
        })}
      </div>
    </Block>
  )
}

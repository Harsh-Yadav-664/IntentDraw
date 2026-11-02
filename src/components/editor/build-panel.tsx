'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ChevronDown, Lock, Pencil, RefreshCw, WifiOff } from 'lucide-react'
import { Block, Button, Chip, StatusDot, cx, type DotStatus } from '@/components/kit/kit'
import { StrokeProgress } from '@/components/kit/sketch'
import { RegionIntentChips } from '@/components/controls/region-intent-chips'
import { useWorkflowStore } from '@/store/workflow-store'
import { useCanvasStore, regionColor } from '@/store/canvas-store'
import { useAI } from '@/hooks/use-ai'
import { listSections, MAX_SECTION_NOTE_CHARS } from '@/lib/ai/page-parts'
import type { AIProvider } from '@/types'
import { ANCHOR_TEXT, ROLE_LABEL } from './reading'

const PROVIDERS: Array<{ value: AIProvider; label: string; hint: string }> = [
  { value: 'auto', label: 'Auto', hint: 'Gemini builds the first screen and content, Groq the navigation, footer and forms' },
  { value: 'gemini', label: 'Gemini Flash', hint: 'Best quality · reads your drawing · falls back through newer Gemini models' },
  { value: 'openrouter', label: 'OpenRouter', hint: 'Stronger free coding models' },
  { value: 'groq', label: 'Groq', hint: 'Fastest · reads your drawing with Qwen' },
  { value: 'nvidia', label: 'NVIDIA Nemotron', hint: 'Backup · slowest' },
]

// Long enough that a burst of typing is one update, short enough that hitting
// Generate immediately after typing still sends what's on screen.
const PROMPT_DEBOUNCE_MS = 200
const MAX_PROMPT_CHARS = 10_000

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

/** Ask the canvas to select a shape and scroll it into view. */
export function focusRegion(id: string) {
  window.dispatchEvent(new CustomEvent('intentdraw:focus-region', { detail: { id } }))
}

export function BuildPanel({ onShowOutput, onEditReading, onUpgrade }: { onShowOutput: () => void; onEditReading: () => void; onUpgrade: () => void }) {
  const prompt = useWorkflowStore((s) => s.prompt)
  const setPrompt = useWorkflowStore((s) => s.setPrompt)
  const progress = useWorkflowStore((s) => s.generationProgress)
  const aiProvider = useWorkflowStore((s) => s.aiProvider)
  const setAiProvider = useWorkflowStore((s) => s.setAiProvider)
  const nvidiaModelId = useWorkflowStore((s) => s.nvidiaModelId)
  const setNvidiaModelId = useWorkflowStore((s) => s.setNvidiaModelId)
  const error = useWorkflowStore((s) => s.error)
  const errorKind = useWorkflowStore((s) => s.errorKind)
  const setError = useWorkflowStore((s) => s.setError)
  const hasSite = useWorkflowStore((s) => s.previewCode.length > 0)
  const regions = useCanvasStore((s) => s.regions)
  const selectedRegionIds = useCanvasStore((s) => s.selectedRegionIds)
  const { isGenerating, generateCode, cancelGeneration } = useAI()
  const online = useOnline()

  const [draft, setDraft] = useState(prompt)
  const [models, setModels] = useState<string[]>([])
  const modelsRequested = useRef(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Adopt external changes (loading a project) without clobbering live typing —
  // React's "adjusting state when a value changes" pattern.
  const [syncedPrompt, setSyncedPrompt] = useState(prompt)
  if (prompt !== syncedPrompt) {
    setSyncedPrompt(prompt)
    setDraft(prompt)
  }

  useEffect(() => {
    if (draft === prompt) return
    const timer = setTimeout(() => setPrompt(draft), PROMPT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, prompt, setPrompt])

  // NVIDIA's model list, fetched once when that provider is picked.
  useEffect(() => {
    if (aiProvider !== 'nvidia' || modelsRequested.current) return
    modelsRequested.current = true
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.models) setModels(data.models)
      })
      .catch(() => {})
  }, [aiProvider])

  const generate = async () => {
    if (!draft.trim()) {
      toast.warning('Add a sentence about the site first — even a short one.')
      promptRef.current?.focus()
      return
    }
    // Flush the draft first — otherwise a click within the debounce window
    // generates from the previous prompt.
    if (draft !== prompt) setPrompt(draft)
    await generateCode()
  }

  const described = regions.filter((r) => r.intent.trim() || r.tag?.kind).length
  const percent = progress ? Math.min(1, progress.done / Math.max(1, progress.total)) : 0
  const provider = PROVIDERS.find((p) => p.value === aiProvider) ?? PROVIDERS[0]
  const nextProvider = PROVIDERS[(PROVIDERS.findIndex((p) => p.value === aiProvider) + 1) % PROVIDERS.length]

  return (
    <div>
      {/* prompt */}
      <section className="border-b border-line px-4 pb-4 pt-4">
        <label htmlFor="prompt" className="mb-2 flex items-baseline justify-between">
          <span className="mono-label text-faint">Describe the site</span>
          <span className="tab-num text-[10.5px] text-faint">{draft.length > 0 ? `${draft.length.toLocaleString()} chars` : 'a sentence is enough'}</span>
        </label>
        <textarea
          id="prompt"
          ref={promptRef}
          rows={5}
          maxLength={MAX_PROMPT_CHARS}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isGenerating}
          placeholder="Describe the site you want — who it's for, what it sells, how it should feel…"
          className="w-full resize-y rounded-[10px] border border-line bg-surface2 p-3 text-[12.5px] leading-[1.6] text-ink transition-colors duration-150 placeholder:text-faint focus:border-accent disabled:opacity-60"
        />

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11px] text-faint">
            {regions.length === 0 ? (
              'No drawing — the prompt alone is enough.'
            ) : (
              <>
                <span className="tab-num text-muted">{described}</span> of <span className="tab-num text-muted">{regions.length}</span> regions described
              </>
            )}
          </span>
          <span className="mono-label text-faint">Ctrl ↵ build</span>
        </div>
        {regions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {regions.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => focusRegion(r.id)}
                title={r.intent || 'Not described yet — click to describe it on the canvas'}
                className={cx(
                  'inline-flex h-[22px] items-center gap-1 rounded-full border px-2 font-mono text-[10px] transition-colors duration-150',
                  selectedRegionIds.includes(r.id)
                    ? 'border-accent text-accent'
                    : r.intent.trim() || r.tag?.kind
                      ? 'border-line text-muted hover:border-line2 hover:text-ink'
                      : 'border-dashed border-line2 text-faint hover:text-ink',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: regionColor(r.regionNumber) }} />R{r.regionNumber}
              </button>
            ))}
          </div>
        )}

        {/* model */}
        <div className="mt-4">
          <div className="relative">
            <select
              aria-label="Model"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AIProvider)}
              disabled={isGenerating}
              className="h-8 w-full appearance-none rounded-[8px] border border-line bg-transparent pl-2.5 pr-7 text-[11.5px] text-muted transition-colors duration-150 hover:border-line2 hover:text-ink focus:border-accent"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
          </div>
          <p className="mt-1.5 text-[10.5px] leading-[1.55] text-faint">{provider.hint}. If it&apos;s busy, the others take over.</p>
          {aiProvider === 'nvidia' && (
            <div className="relative mt-2">
              <select
                aria-label="NVIDIA model"
                value={nvidiaModelId}
                onChange={(e) => setNvidiaModelId(e.target.value)}
                className="h-8 w-full appearance-none rounded-[8px] border border-line bg-transparent pl-2.5 pr-7 text-[11px] text-muted focus:border-accent"
              >
                {(models.length > 0 ? models : [nvidiaModelId]).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
            </div>
          )}
        </div>

        {isGenerating ? (
          <div className="mt-3 rounded-[10px] border border-line bg-surface2 p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-ink">{progress ? `${progress.label}…` : 'Starting…'}</span>
              <span className="tab-num text-[10.5px] text-faint">{Math.round(percent * 100)}%</span>
            </div>
            <StrokeProgress progress={Math.max(0.04, percent)} className="mt-2.5 h-[10px] w-full" />
            <p className="mt-2 text-[10.5px] leading-[1.6] text-faint">Sections appear in Output as they finish. Free models take 2–4 minutes.</p>
            <div className="mt-2.5 flex gap-2">
              <Button size="xs" variant="outline" className="flex-1" onClick={onShowOutput}>
                Watch in Output
              </Button>
              <Button size="xs" variant="quiet" onClick={cancelGeneration} title="Stop after the current step — what's built is kept">
                Stop
              </Button>
            </div>
          </div>
        ) : !online ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-[10px] border border-line bg-surface2 p-3.5">
            <WifiOff size={14} className="mt-0.5 shrink-0 text-faint" />
            <div>
              <div className="text-[12px] text-ink">Offline — your changes are kept.</div>
              <p className="mt-1.5 text-[11px] leading-[1.65] text-muted">Keep drawing. You can build again when you&apos;re back online.</p>
            </div>
          </div>
        ) : error && errorKind === 'quota' ? (
          <div className="mt-3 rounded-[10px] border border-warn/35 bg-warn/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <Lock size={14} className="mt-0.5 shrink-0 text-warn" />
              <div>
                <div className="text-[12px] text-ink">Today&apos;s generations are used up.</div>
                <p className="mt-1.5 text-[11px] leading-[1.65] text-muted">{error} Your drawing and prompt are saved, and rebuilding single sections still works.</p>
                <div className="mt-3 flex gap-2">
                  <Button size="xs" variant="primary" onClick={onUpgrade}>
                    See plans
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setError(null)}>
                    Keep drawing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="mt-3 rounded-[10px] border border-danger/35 bg-danger/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0">
                <div className="text-[12px] text-ink">{error.startsWith('Generated, but') ? 'Some sections didn’t build.' : 'The build stopped.'}</div>
                <p className="mt-1.5 break-words text-[11px] leading-[1.65] text-muted">{error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!error.startsWith('Generated, but') && (
                    <>
                      <Button size="xs" variant="primary" icon={<RefreshCw size={11} />} onClick={generate}>
                        Try again
                      </Button>
                      <Button size="xs" variant="outline" onClick={() => setAiProvider(nextProvider.value)}>
                        Start with {nextProvider.label}
                      </Button>
                    </>
                  )}
                  <Button size="xs" variant="quiet" onClick={() => setError(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="primary" size="lg" className="mt-3 w-full" onClick={generate} icon={<Pencil size={14} />}>
            {hasSite ? 'Build the site again' : 'Generate site'}
          </Button>
        )}
      </section>

      <Reading onEditReading={onEditReading} />
      <Sections />

      <div className="px-4 py-4">
        <div className="mono-label mb-2.5 text-faint">Coming soon</div>
        <div className="flex flex-wrap gap-1.5 opacity-70">
          <Chip>Several screens per project</Chip>
          <Chip>Version history</Chip>
          <Chip>Click the site to edit it</Chip>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------- what I understood ---------------------------- */

function Reading({ onEditReading }: { onEditReading: () => void }) {
  const brief = useWorkflowStore((s) => s.brief)
  const generating = useWorkflowStore((s) => s.status === 'generating')
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)

  if (!brief) return null

  if (brief.source === 'fallback') {
    return (
      <section className="border-b border-line px-4 py-4">
        <div className="mono-label mb-2 text-faint">What I understood</div>
        <p className="text-[11.5px] leading-[1.7] text-muted">The understanding step couldn&apos;t reach a model, so this build used the basic shape heuristics.</p>
      </section>
    )
  }

  const palette = brief.palette ? Object.entries(brief.palette) : []
  const editingElement = editing ? brief.drawing.elements.find((x) => x.name + x.regions.join() === editing) : null

  return (
    <section className="border-b border-line px-4 py-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5" aria-expanded={open}>
          <ChevronDown size={12} className={cx('text-faint transition-transform duration-200', !open && '-rotate-90')} />
          <span className="mono-label text-faint">What I understood</span>
        </button>
        {brief.drawing.elements.length > 0 && (
          <button type="button" onClick={onEditReading} className="text-[11px] text-accent hover:underline">
            Edit reading
          </button>
        )}
      </div>
      {brief.summary && <p className="mt-3 text-[12px] leading-[1.7] text-ink">{brief.summary}</p>}
      {open && (
        <div className="mt-3.5 space-y-4">
          {brief.drawing.elements.length > 0 && (
            <div>
              {brief.drawing.reading && <p className="mb-2 text-[11.5px] leading-[1.6] text-muted">{brief.drawing.reading}</p>}
              <div className="flex flex-wrap gap-1.5">
                {brief.drawing.elements.map((e) => {
                  const key = e.name + e.regions.join()
                  return (
                    <Chip key={key} active={editing === key} onClick={() => setEditing(editing === key ? null : key)} title={e.render ?? 'Click to correct how this was read'}>
                      <span className="text-ink">{e.name}</span> · {ROLE_LABEL[e.role]}
                      {e.regions.length > 0 && <span className="text-faint"> · {e.regions.map((n) => `R${n}`).join('+')}</span>}
                    </Chip>
                  )
                })}
              </div>
              {editingElement && (
                <div className="mt-2.5 rounded-[10px] border border-line bg-surface2 p-3">
                  <p className="mb-2.5 text-[11px] leading-[1.6] text-muted">
                    Read as {ROLE_LABEL[editingElement.role]}
                    {ANCHOR_TEXT[editingElement.anchor] ? `, ${ANCHOR_TEXT[editingElement.anchor]}` : ''}. Not what you meant? Say what it is — your answer wins next build.
                  </p>
                  <RegionIntentChips regionNumbers={editingElement.regions} compact disabled={generating} />
                </div>
              )}
            </div>
          )}
          {(brief.concept || brief.signature) && (
            <div className="grid grid-cols-2 gap-3">
              {brief.concept && (
                <div>
                  <div className="mono-label mb-1.5 text-faint">Concept</div>
                  <div className="text-[11.5px] leading-[1.6] text-muted">{brief.concept}</div>
                </div>
              )}
              {brief.signature && (
                <div>
                  <div className="mono-label mb-1.5 text-faint">Signature</div>
                  <div className="text-[11.5px] leading-[1.6] text-muted">{brief.signature}</div>
                </div>
              )}
            </div>
          )}
          {palette.length > 0 && (
            <div>
              <div className="mono-label mb-2 text-faint">Palette</div>
              <div className="flex gap-1">
                {palette.map(([role, hex]) => (
                  <span key={role} title={`${role} ${hex}`} className="h-5 flex-1 rounded-[4px] border border-line2" style={{ background: hex }} />
                ))}
              </div>
            </div>
          )}
          {/* Older saved briefs predate per-site design. */}
          {brief.design && (
            <div>
              <div className="mono-label mb-2 text-faint">Design</div>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink">{brief.design.displayFont}</span>
                <span className="text-[11px] text-faint">headings</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-[12px] text-ink">{brief.design.bodyFont}</span>
                <span className="text-[11px] text-faint">body</span>
              </div>
              <div className="mt-1 text-[11px] text-faint">
                {brief.design.corners} corners · {brief.design.surfaces} surfaces · {brief.design.density}
                {brief.design.hero ? ` · ${brief.design.hero} first screen` : ''}
              </div>
            </div>
          )}
          {brief.sections.length > 0 && (
            <div>
              <div className="mono-label mb-2 text-faint">Section plan</div>
              <div className="text-[11.5px] leading-[1.6] text-muted">{brief.sections.map((s) => s.name).join(' → ')}</div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* -------------------------------- sections -------------------------------- */

function Sections() {
  const parts = useWorkflowStore((s) => s.pageParts)
  const plan = useWorkflowStore((s) => s.buildPlan)
  const rebuilding = useWorkflowStore((s) => s.rebuildingSection)
  const rebuildError = useWorkflowStore((s) => s.rebuildError)
  const generating = useWorkflowStore((s) => s.status === 'generating')
  const { rebuildSection } = useAI()
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const audit = useWorkflowStore((s) => s.audit)
  const rows: Array<{ name: string; status: DotStatus; note?: string; layout?: boolean; builtBy?: string }> = plan
    ? plan.map((s) => ({ name: s.name, status: s.status }))
    : parts
      ? listSections(parts).map((s) => ({
          name: s.name,
          status: rebuilding === s.name ? 'building' : s.status === 'built' ? 'built' : 'failed',
          // What still looks generated (saved with the section) and what the
          // layout check saw on the page shown — one note, layout first.
          note: [audit[s.name], s.note].filter(Boolean).join(' ').slice(0, MAX_SECTION_NOTE_CHARS) || undefined,
          layout: !!audit[s.name],
          builtBy: s.model || s.provider ? `Built by ${s.model ?? s.provider}${s.ms ? ` in ${Math.round(s.ms / 1000)}s` : ''}` : undefined,
        }))
      : []

  if (rows.length === 0) {
    return (
      <Block title="Sections">
        <p className="text-[11.5px] leading-[1.7] text-faint">The section plan appears here once the build starts. Each one can be rebuilt on its own afterwards.</p>
      </Block>
    )
  }

  const busy = generating || rebuilding !== null
  const rebuild = async (name: string) => {
    setOpenRow(null)
    const ok = await rebuildSection(name, notes[name])
    if (ok) {
      setNotes((n) => ({ ...n, [name]: '' }))
      toast.success(`${name} rebuilt. Everything else is untouched.`)
    }
  }

  return (
    <Block title="Sections" meta={<span className="tab-num text-[10.5px] text-faint">{rows.filter((r) => r.status === 'built').length}/{rows.length} built</span>}>
      <div className="overflow-hidden rounded-[10px] border border-line" data-testid="section-list">
        {rows.map((s) => {
          const error = rebuildError?.section === s.name ? rebuildError.message : null
          return (
            <div key={s.name} className="border-b border-line last:border-0" data-section={s.name} data-status={s.status}>
              <div className="flex h-9 items-center gap-2.5 px-3">
                <StatusDot status={s.status} />
                <span className="flex-1 truncate text-[12px] text-ink" title={s.builtBy}>{s.name}</span>
                {s.status === 'building' ? (
                  <span className="mono-label text-accent">building</span>
                ) : s.status === 'queued' ? (
                  <span className="mono-label text-faint">queued</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      // A section that still looks generated opens with that as its note.
                      if (openRow !== s.name && s.note && !notes[s.name]) setNotes((n) => ({ ...n, [s.name]: s.note! }))
                      setOpenRow(openRow === s.name ? null : s.name)
                    }}
                    className={cx(
                      'flex items-center gap-1 rounded-[6px] px-2 py-1 text-[10.5px] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
                      s.status === 'failed' ? 'border border-accent/40 text-accent hover:bg-accent/12' : 'text-faint hover:bg-surface2 hover:text-ink',
                    )}
                  >
                    <RefreshCw size={10} /> Rebuild
                  </button>
                )}
              </div>
              {s.status === 'failed' && openRow !== s.name && !error && (
                <div className="px-3 pb-2.5 text-[10.5px] leading-[1.6] text-danger">Not built — it shows as a placeholder. Nothing else was touched.</div>
              )}
              {error && <div className="px-3 pb-2.5 text-[10.5px] leading-[1.6] text-danger">{error}</div>}
              {s.status === 'built' && s.note && openRow !== s.name && !error && (
                <div className="px-3 pb-2.5 text-[10.5px] leading-[1.6] text-faint" data-testid="section-look-note">
                  {s.layout ? 'Layout check found a problem here' : 'Could look less generated'} — Rebuild fixes it with a note.
                </div>
              )}
              {openRow === s.name && (
                <form
                  className="bg-surface2 px-3 py-2.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void rebuild(s.name)
                  }}
                >
                  <input
                    autoFocus
                    value={notes[s.name] ?? ''}
                    maxLength={MAX_SECTION_NOTE_CHARS}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.name]: e.target.value }))}
                    placeholder="Optional note — e.g. make it a comparison table"
                    aria-label={`What to change in ${s.name}`}
                    className="h-8 w-full rounded-[6px] border border-line bg-surface px-2.5 text-[11.5px] text-ink placeholder:text-faint focus:border-accent"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button type="submit" size="xs" variant="primary" disabled={busy}>
                      Rebuild {s.name}
                    </Button>
                    <Button size="xs" variant="quiet" onClick={() => setOpenRow(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </Block>
  )
}

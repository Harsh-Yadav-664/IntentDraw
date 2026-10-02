'use client'

import { useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { Brain, ChevronDown } from 'lucide-react'
import type { BriefElement } from '@/lib/ai/brief'
import { RegionIntentChips } from './region-intent-chips'

/**
 * What the understanding stage made of the request.
 *
 * Two jobs. It makes the wait legible — the user sees their drawing was read as
 * "two mountains and a river" seconds after pressing Generate, instead of
 * staring at a spinner. And it makes a misreading visible: a shape taken as
 * layout when it was meant as a picture used to shape the output silently.
 */

const ANCHOR_TEXT: Record<string, string> = {
  exact: 'exactly where drawn',
  anywhere: 'anywhere in its part',
  behind: 'behind',
}

const ROLE_LABEL: Record<BriefElement['role'], string> = {
  layout: 'layout',
  illustration: 'picture',
  object: '3D object',
  decoration: 'decoration',
  motion: 'motion path',
  connector: 'connector',
}

export function BriefCard() {
  const brief = useWorkflowStore((s) => s.brief)
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)

  if (!brief) return null

  if (brief.source === 'fallback') {
    return (
      <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-[11px] leading-relaxed text-muted-foreground/70">
        The understanding step couldn&apos;t reach a model, so this run used the basic shape heuristics.
      </div>
    )
  }

  const palette = brief.palette ? Object.entries(brief.palette) : []

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.04]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-foreground/90">
          <Brain className="h-3.5 w-3.5 text-primary" />
          What I understood
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/5 px-3 pb-3 pt-2.5 text-[11px] leading-relaxed">
          {brief.summary && <p className="text-foreground/85">{brief.summary}</p>}

          {brief.drawing.elements.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground/80">
                <span className="text-foreground/70">Drawing: </span>
                {brief.drawing.reading || 'read as shapes'}
              </p>
              <div className="flex flex-wrap gap-1">
                {brief.drawing.elements.map((e) => {
                  const key = e.name + e.regions.join()
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setEditing(editing === key ? null : key)}
                      aria-expanded={editing === key}
                      className={`rounded-md border px-1.5 py-0.5 text-left text-[10px] text-muted-foreground transition-colors hover:border-white/25 ${editing === key ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-black/30'}`}
                      title={e.render ?? 'Click to correct how this was read'}
                    >
                      <span className="text-foreground/80">{e.name}</span>
                      {' · '}
                      {ROLE_LABEL[e.role]}
                      {' · '}
                      {ANCHOR_TEXT[e.anchor] ?? ''}
                      <span className="text-muted-foreground/50"> {e.regions.map((n) => `R${n}`).join('+')}</span>
                    </button>
                  )
                })}
              </div>
              {editing && (() => {
                const e = brief.drawing.elements.find((x) => x.name + x.regions.join() === editing)
                if (!e) return null
                return (
                  <div className="rounded-lg border border-white/10 bg-black/25 p-2">
                    <p className="mb-2 text-muted-foreground/80">
                      Not what you meant? Say what <span className="text-foreground/80">{e.regions.map((n) => `R${n}`).join('+')}</span> is — then Generate again. Your answer is final.
                    </p>
                    <RegionIntentChips regionNumbers={e.regions} compact />
                  </div>
                )
              })()}
            </div>
          )}

          {brief.concept && (
            <p className="text-muted-foreground/80">
              <span className="text-foreground/70">Concept: </span>
              {brief.concept}
            </p>
          )}

          {brief.signature && (
            <p className="text-muted-foreground/80">
              <span className="text-foreground/70">Signature: </span>
              {brief.signature}
            </p>
          )}

          {palette.length > 0 && (
            <div className="flex items-center gap-1.5">
              {palette.map(([role, hex]) => (
                <span
                  key={role}
                  title={`${role} ${hex}`}
                  className="h-4 w-4 rounded-full border border-white/15"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <span className="ml-1 text-[10px] text-muted-foreground/50">palette</span>
            </div>
          )}

          {/* Older saved briefs predate per-site design. */}
          {brief.design && (
            <p className="text-muted-foreground/80">
              <span className="text-foreground/70">Design: </span>
              {brief.design.displayFont} + {brief.design.bodyFont} · {brief.design.corners} corners ·{' '}
              {brief.design.surfaces} · {brief.design.density}
            </p>
          )}

          {brief.sections.length > 0 && (
            <p className="text-muted-foreground/60">
              {brief.sections.map((s) => s.name).join(' → ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

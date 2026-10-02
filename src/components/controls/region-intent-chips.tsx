'use client'

import { useCanvasStore } from '@/store/canvas-store'
import type { IntentAnchor, IntentKind, RegionTag } from '@/types'

/**
 * One-click answers to "what is this shape, and where does it go?".
 *
 * The owner's rule: nobody should need a ten-line prompt for the drawing to be
 * understood. IntentDraw works intent out on its own (lib/ai/intent.ts); these
 * chips are for when the user wants to be sure — a tag is final, it outranks
 * the prompt and the model. "Auto" (no tag) leaves the decision to IntentDraw.
 */

const KINDS: Array<{ value: IntentKind; label: string; hint: string }> = [
  { value: 'content', label: 'Content', hint: 'Text, cards, a form, a nav — something goes here' },
  { value: 'text', label: 'Text', hint: 'A heading or words, exactly here' },
  { value: 'picture', label: 'Picture', hint: 'Draw it as art in the site' },
  { value: 'object', label: '3D object', hint: 'A rotating, interactive 3D object (cube or sphere by its shape)' },
  { value: 'background', label: 'Background', hint: 'Behind the content' },
  { value: 'decoration', label: 'Decoration', hint: 'An ornament, not content' },
  { value: 'motion', label: 'Motion path', hint: 'Something travels along this line' },
  { value: 'connector', label: 'Arrow', hint: 'Shows a link or flow between two things' },
]

const ANCHORS: Array<{ value: IntentAnchor; label: string; hint: string }> = [
  { value: 'exact', label: 'Exactly here', hint: 'Where and as big as drawn' },
  { value: 'anywhere', label: 'Anywhere in this part', hint: 'Somewhere in this part of the page' },
  { value: 'behind', label: 'Behind', hint: 'Behind the content' },
]

function Chip({ active, label, hint, onClick, disabled }: { active: boolean; label: string; hint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-md border px-2 py-1 text-[11px] leading-none transition-colors disabled:opacity-50 ${
        active
          ? 'border-primary/60 bg-primary/15 text-foreground'
          : 'border-white/10 bg-black/20 text-muted-foreground hover:border-white/25 hover:text-foreground/90'
      }`}
    >
      {label}
    </button>
  )
}

export function RegionIntentChips({
  regionNumbers,
  disabled,
  compact,
}: {
  regionNumbers: number[]
  disabled?: boolean
  /** Inside the brief card: smaller, no explanation line. */
  compact?: boolean
}) {
  const regions = useCanvasStore((s) => s.regions)
  const setRegionTag = useCanvasStore((s) => s.setRegionTag)
  const tagged = regions.filter((r) => regionNumbers.includes(r.regionNumber))
  if (tagged.length === 0) return null

  // Shown as set only when every selected shape agrees.
  const common = <K extends keyof RegionTag>(key: K): RegionTag[K] | undefined => {
    const first = tagged[0].tag?.[key]
    return tagged.every((r) => r.tag?.[key] === first) ? first : undefined
  }
  const kind = common('kind')
  const anchor = common('anchor')

  const toggle = (next: RegionTag) => {
    const clearing = (next.kind && next.kind === kind) || (next.anchor && next.anchor === anchor)
    setRegionTag(regionNumbers, clearing ? { kind: next.kind ? undefined : kind, anchor: next.anchor ? undefined : anchor } : next)
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground/70">What is it?</p>
        <div className="flex flex-wrap gap-1">
          <Chip active={!kind} label="Auto" hint="IntentDraw decides from the drawing and prompt" onClick={() => setRegionTag(regionNumbers, { kind: undefined, anchor })} disabled={disabled} />
          {KINDS.map((k) => (
            <Chip key={k.value} active={kind === k.value} label={k.label} hint={k.hint} onClick={() => toggle({ kind: k.value })} disabled={disabled} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground/70">Where?</p>
        <div className="flex flex-wrap gap-1">
          <Chip active={!anchor} label="Auto" hint="IntentDraw decides" onClick={() => setRegionTag(regionNumbers, { kind, anchor: undefined })} disabled={disabled} />
          {ANCHORS.map((a) => (
            <Chip key={a.value} active={anchor === a.value} label={a.label} hint={a.hint} onClick={() => toggle({ anchor: a.value })} disabled={disabled} />
          ))}
        </div>
      </div>
      {!compact && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/60">
          Optional. IntentDraw reads your drawing and prompt on its own — tag a shape only to be sure. A tag always wins.
        </p>
      )}
    </div>
  )
}

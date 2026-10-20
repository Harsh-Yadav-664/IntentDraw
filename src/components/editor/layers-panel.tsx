'use client'

import { ArrowUpRight, Circle, Eye, EyeOff, Layers, Pencil, Square, Trash2, Ungroup } from 'lucide-react'
import { Block, Button, cx } from '@/components/kit/kit'
import { RegionIntentChips } from '@/components/controls/region-intent-chips'
import { useCanvasStore, regionColor } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { PAGE_CONFIG } from '@/lib/canvas/pages'
import type { Region } from '@/types'
import { focusRegion } from './build-panel'

const KIND_ICON = { rectangle: Square, circle: Circle, freeform: Pencil, arrow: ArrowUpRight } as const
const KIND_NAME = { rectangle: 'Box', circle: 'Circle', freeform: 'Stroke', arrow: 'Arrow' } as const

/** Which page(s) a shape is on, 1-based. */
function pageSpan(r: Region): [number, number] {
  const g = r.geometry
  return [Math.floor(g.y / PAGE_CONFIG.pageHeight) + 1, Math.floor((g.y + Math.max(1, g.height) - 1) / PAGE_CONFIG.pageHeight) + 1]
}

/** A shape's name in lists: what the user said it is, else its kind and number. */
export function regionLabel(r: Region): string {
  const said = r.intent.trim()
  if (said) return said.length > 34 ? `${said.slice(0, 33)}…` : said
  return `${KIND_NAME[r.geometry.type]} ${r.regionNumber}`
}

const SHORTCUTS: Array<[string, string]> = [
  ['V R O P A', 'tools'],
  ['Shift drag', 'square / circle'],
  ['Ctrl D', 'duplicate'],
  ['Ctrl G', 'group'],
  ['Ctrl A', 'select all'],
  ['Arrows', 'nudge'],
  ['Ctrl wheel', 'zoom'],
  ['Space drag', 'pan'],
  ['Ctrl ↵', 'build'],
  ['Del', 'delete'],
]

export function LayersPanel() {
  const regions = useCanvasStore((s) => s.regions)
  const groups = useCanvasStore((s) => s.groups)
  const selectedRegionIds = useCanvasStore((s) => s.selectedRegionIds)
  const visibility = useCanvasStore((s) => s.visibility)
  const selectRegions = useCanvasStore((s) => s.selectRegions)
  const toggleVisibility = useCanvasStore((s) => s.toggleVisibility)
  const deleteRegions = useCanvasStore((s) => s.deleteRegions)
  const updateRegionIntent = useCanvasStore((s) => s.updateRegionIntent)
  const groupSelection = useCanvasStore((s) => s.groupSelection)
  const ungroup = useCanvasStore((s) => s.ungroup)
  const renameGroup = useCanvasStore((s) => s.renameGroup)
  const updateGroupIntent = useCanvasStore((s) => s.updateGroupIntent)
  const generating = useWorkflowStore((s) => s.status === 'generating')

  const sel = regions.filter((r) => selectedRegionIds.includes(r.id))
  const single = sel.length === 1 ? sel[0] : null
  const allInOneGroup = sel.length > 1 && !!sel[0].groupId && sel.every((r) => r.groupId === sel[0].groupId)

  return (
    <div>
      {/* inspector */}
      <Block title={single ? `Selected · R${single.regionNumber}` : sel.length > 1 ? `${sel.length} selected` : 'Inspector'}>
        {single ? (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={single.intent}
              disabled={generating}
              onChange={(e) => updateRegionIntent(single.id, e.target.value)}
              placeholder="What is this shape? e.g. a mountain ridge behind the headline"
              aria-label={`Describe R${single.regionNumber}`}
              className="w-full resize-none rounded-[8px] border border-line bg-surface2 p-2.5 text-[12px] leading-[1.6] text-ink placeholder:text-faint focus:border-accent disabled:opacity-60"
            />
            <RegionIntentChips regionNumbers={[single.regionNumber]} disabled={generating} />
            <div className="flex items-center justify-between text-[11px] text-faint">
              <span>
                {KIND_NAME[single.geometry.type]} · {Math.round(single.geometry.width)}×{Math.round(single.geometry.height)} · page{' '}
                {(() => {
                  const [a, b] = pageSpan(single)
                  return a === b ? a : `${a}–${b}`
                })()}
              </span>
              <button type="button" onClick={() => deleteRegions([single.id])} className="text-faint hover:text-danger">
                Delete
              </button>
            </div>
          </div>
        ) : sel.length > 1 ? (
          <div className="space-y-3">
            {!allInOneGroup && (
              <Button size="sm" variant="outline" className="w-full" icon={<Layers size={12} />} onClick={() => groupSelection()} disabled={generating}>
                Group {sel.length} shapes — describe them once
              </Button>
            )}
            <RegionIntentChips regionNumbers={sel.map((r) => r.regionNumber)} disabled={generating} compact />
            <Button size="sm" variant="danger" className="w-full" icon={<Trash2 size={12} />} onClick={() => deleteRegions(selectedRegionIds)}>
              Delete {sel.length} shapes
            </Button>
          </div>
        ) : (
          <p className="text-[11.5px] leading-[1.7] text-faint">Select a shape to say what it is. Shift-click or drag a marquee to select several.</p>
        )}
      </Block>

      {/* layers */}
      <Block title="Layers" meta={<span className="tab-num text-[10.5px] text-faint">{regions.length}</span>}>
        {regions.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-line px-3 py-6 text-center text-[11px] text-faint">Layers appear here as you draw.</div>
        ) : (
          <div className="space-y-0.5">
            {[...regions].reverse().map((r) => {
              const Icon = KIND_ICON[r.geometry.type]
              const on = selectedRegionIds.includes(r.id)
              const shown = visibility[r.id] !== false
              const [a, b] = pageSpan(r)
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if (e.shiftKey) selectRegions(on ? selectedRegionIds.filter((x) => x !== r.id) : [...selectedRegionIds, r.id])
                    else focusRegion(r.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') focusRegion(r.id)
                  }}
                  className={cx('group flex h-9 cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 transition-colors duration-150', on ? 'bg-accent/10' : 'hover:bg-surface2', !shown && 'opacity-45')}
                >
                  <Icon size={12} style={{ color: regionColor(r.regionNumber) }} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] text-ink">{regionLabel(r)}</div>
                  </div>
                  {!r.intent.trim() && !r.tag?.kind && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" title="Not described yet — IntentDraw will work it out" />}
                  <span className="mono-label text-faint">{a === b ? `P${a}` : `P${a}–${b}`}</span>
                  <span className="w-[24px] font-mono text-[10px] text-faint">R{r.regionNumber}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleVisibility(r.id)
                    }}
                    className="text-faint opacity-0 transition-opacity duration-150 hover:text-ink focus:opacity-100 group-hover:opacity-100"
                    aria-label={shown ? `Hide R${r.regionNumber}` : `Show R${r.regionNumber}`}
                  >
                    {shown ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteRegions([r.id])
                    }}
                    className="text-faint opacity-0 transition-opacity duration-150 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete R${r.regionNumber}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Block>

      {/* groups */}
      <Block title="Groups" meta={<span className="tab-num text-[10.5px] text-faint">{groups.length}</span>}>
        {groups.length === 0 ? (
          <p className="text-[11.5px] leading-[1.7] text-faint">Select several shapes and group them to describe them once — e.g. &ldquo;the hero landscape&rdquo;.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const members = regions.filter((r) => r.groupId === g.id)
              return (
                <div key={g.id} className="rounded-[10px] border border-line bg-surface2 p-2.5">
                  <div className="flex items-center gap-2">
                    <Layers size={12} className="shrink-0 text-faint" />
                    <input
                      value={g.name}
                      onChange={(e) => renameGroup(g.id, e.target.value)}
                      aria-label="Group name"
                      disabled={generating}
                      className="min-w-0 flex-1 rounded-[4px] bg-transparent px-1 text-[12px] text-ink focus:bg-surface"
                    />
                    <button type="button" onClick={() => selectRegions(members.map((m) => m.id))} className="text-[10.5px] text-faint hover:text-ink">
                      Select
                    </button>
                    <button type="button" onClick={() => ungroup(g.id)} disabled={generating} className="flex items-center gap-1 text-[10.5px] text-faint hover:text-ink">
                      <Ungroup size={10} /> Ungroup
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={g.intent}
                    disabled={generating}
                    onChange={(e) => updateGroupIntent(g.id, e.target.value)}
                    placeholder="One description for all of them…"
                    className="mt-2 w-full resize-none rounded-[6px] border border-line bg-surface p-2 text-[11.5px] leading-[1.55] text-ink placeholder:text-faint focus:border-accent"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {members.map((m) => (
                      <span key={m.id} className="inline-flex h-[18px] items-center gap-1 rounded-full border border-line px-1.5 font-mono text-[9.5px] text-muted">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: regionColor(m.regionNumber) }} />R{m.regionNumber}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Block>

      <div className="px-4 py-4 text-[10.5px] leading-[1.8] text-faint">
        <div className="mono-label mb-2 text-faint">Shortcuts</div>
        <div className="grid grid-cols-2 gap-x-3">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="font-mono text-muted">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

import { Button, Dialog } from '@/components/kit/kit'
import { RegionIntentChips } from '@/components/controls/region-intent-chips'
import { useWorkflowStore } from '@/store/workflow-store'
import { useCanvasStore, regionColor } from '@/store/canvas-store'
import { ROLE_LABEL, ANCHOR_TEXT } from './reading'

/**
 * Correct how the drawing was read. Each answer is a tag on the shapes, which
 * outranks the prompt and the model on the next build — so the fix sticks.
 */
export function ReadingDialog({ open, onClose, onGenerate, generating }: { open: boolean; onClose: () => void; onGenerate: () => void; generating: boolean }) {
  const brief = useWorkflowStore((s) => s.brief)
  const regionCount = useCanvasStore((s) => s.regions.length)
  const elements = brief?.drawing.elements.filter((e) => e.regions.length > 0) ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit the reading"
      eyebrow="What I understood"
      width="max-w-[640px]"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            disabled={generating}
            onClick={() => {
              onClose()
              onGenerate()
            }}
          >
            Build again with these answers
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[12.5px] leading-[1.75] text-muted">
          Say what each part really is. Your answers are saved on the shapes and win over the prompt and the model the next time you build.
        </p>
        {elements.length === 0 && (
          <p className="text-[12px] text-faint">{regionCount === 0 ? 'No drawing — the reading comes from your prompt alone.' : 'Build once to see how your drawing was read.'}</p>
        )}
        {elements.map((e) => (
          <div key={e.name + e.regions.join()} className="rounded-[10px] border border-line bg-surface2 p-3.5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {e.regions.map((n) => (
                <span key={n} className="flex h-[18px] items-center gap-1 rounded-[4px] px-1.5 font-mono text-[9.5px] font-medium text-[#14110A]" style={{ background: regionColor(n) }}>
                  R{n}
                </span>
              ))}
              <span className="text-[12.5px] text-ink">{e.name}</span>
              <span className="text-[11.5px] text-faint">
                read as {ROLE_LABEL[e.role]}
                {ANCHOR_TEXT[e.anchor] ? `, ${ANCHOR_TEXT[e.anchor]}` : ''}
              </span>
            </div>
            <RegionIntentChips regionNumbers={e.regions} compact disabled={generating} />
          </div>
        ))}
      </div>
    </Dialog>
  )
}

'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Loader2, RotateCcw, Undo2, X } from 'lucide-react'
import { Button, Dialog, Field } from '@/components/kit/kit'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { assembleParts, type PageParts } from '@/lib/ai/page-parts'
import { imageKey } from '@/lib/images/slots'
import type { PageEdit } from '@/lib/edit/edits'

/**
 * Edit mode for a built site (issue #17): click words to change them in place,
 * click a picture to put your own in. No model call, no waiting — each change
 * is applied to the section's code (lib/edit/edits.ts), checked to compile,
 * saved like any other change, and can be undone.
 *
 * Words the code builds at runtime (a computed price, a template) have no one
 * place in the source; for those the user is offered a rebuild of that section
 * with the change as its note.
 */

const MAX_UNDO = 30
const UPLOAD_MAX_BYTES = 1.8 * 1024 * 1024
const UPLOAD_MAX_SIDE = 2400

interface Snapshot {
  parts: PageParts | null
  code: string
}

interface PendingImage {
  section: string | null
  key: string
  alt: string
  replaced: boolean
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Shrinks a large picture in the browser so phone photos fit the 2 MB store limit. WebP keeps transparency. */
async function preparePicture(file: File): Promise<Blob> {
  if (!/^image\//.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This picture could not be read. Try a JPEG, PNG or WebP file.')
  }
  const small = Math.max(bitmap.width, bitmap.height) <= UPLOAD_MAX_SIDE
  if (small && file.size <= UPLOAD_MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    bitmap.close()
    return file
  }
  const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const quality of [0.86, 0.72, 0.55]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (blob && blob.size <= UPLOAD_MAX_BYTES) return blob
  }
  throw new Error('This picture is too large even after shrinking it.')
}

export function useEditMode({ reloadFrame }: { reloadFrame: () => void }) {
  const { rebuildSection } = useAI()
  const undo = useRef<Snapshot[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [textRequest, setTextRequest] = useState<{ section: string | null; before: string } | null>(null)
  const [sectionRequest, setSectionRequest] = useState<{ section: string; snippet: string } | null>(null)

  /** Applies one change to the page; returns false (with the reason shown) when it can't. */
  const apply = useCallback(
    async (edits: PageEdit[]): Promise<boolean> => {
      const state = useWorkflowStore.getState()
      if (state.status === 'generating' || state.rebuildingSection) {
        toast.error('Wait for the build to finish before editing.')
        return false
      }
      const before: Snapshot = { parts: state.pageParts, code: state.previewCode }
      const [{ applyPageEdit }, { findSyntaxProblem }] = await Promise.all([import('@/lib/edit/edits'), import('@/lib/ai/validate')])

      let parts = before.parts
      let code = before.code
      for (const edit of edits) {
        const r = applyPageEdit(parts, code, edit)
        if (!r.ok) {
          if (r.reason === 'unchanged') continue
          if (edit.kind === 'text' && r.reason === 'not-found') {
            const section = edit.section
            toast.message('These words are built by the page’s code', {
              description: section ? `They can’t be changed in place. Rebuild ${section} with this change instead (one model call).` : 'They can’t be changed in place.',
              action: section
                ? { label: 'Rebuild with this change', onClick: () => void rebuildSection(section, `Change the text “${edit.before.trim().slice(0, 120)}” to “${edit.after.trim().slice(0, 120)}”. Keep everything else as it is.`) }
                : undefined,
            })
          } else {
            toast.error(r.reason === 'unsafe' ? 'That picture address can’t be used.' : 'That change could not be applied.')
          }
          reloadFrame()
          return false
        }
        if (r.parts) {
          parts = r.parts
          code = assembleParts(r.parts).code ?? ''
        } else {
          code = r.code
        }
      }
      if (code === before.code) return true
      if (!code || findSyntaxProblem(code)) {
        toast.error('That change would break the page, so it was not made.')
        reloadFrame()
        return false
      }
      undo.current = [...undo.current, before].slice(-MAX_UNDO)
      setUndoCount(undo.current.length)
      if (parts !== before.parts) state.setPageParts(parts)
      state.setPreviewCode(code)
      return true
    },
    [rebuildSection, reloadFrame]
  )

  const undoLast = useCallback(() => {
    const last = undo.current.pop()
    setUndoCount(undo.current.length)
    if (!last) return
    const state = useWorkflowStore.getState()
    state.setPageParts(last.parts)
    state.setPreviewCode(last.code)
  }, [])

  /** Every EDIT_* message from the preview frame — untrusted, so every field is checked. */
  const onEditMessage = useCallback(
    (data: Record<string, unknown>) => {
      const section = typeof data.section === 'string' ? data.section.slice(0, 80) : null
      if (data.type === 'EDIT_TEXT' && Array.isArray(data.changes)) {
        const edits: PageEdit[] = data.changes.slice(0, 8).flatMap((c: unknown) => {
          const change = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
          const occurrence = typeof change.occurrence === 'number' && Number.isFinite(change.occurrence) ? Math.max(0, Math.min(500, Math.floor(change.occurrence))) : 0
          const beforeText = str(change.before)
          return beforeText.trim() ? [{ kind: 'text' as const, section, before: beforeText, after: str(change.after), occurrence }] : []
        })
        if (edits.length > 0) void apply(edits)
      } else if (data.type === 'EDIT_PICK_SECTION') {
        // Only one of this page's own sections can be rebuilt.
        const parts = useWorkflowStore.getState().pageParts
        if (!section || !parts?.sections.includes(section)) {
          toast.error('This page was built before sections could be rebuilt one by one. Build the site again to change it part by part.')
          return
        }
        setSectionRequest({ section, snippet: str(data.snippet, 120) })
      } else if (data.type === 'EDIT_TEXT_REQUEST') {
        const beforeText = str(data.before, 600)
        if (beforeText.trim()) setTextRequest({ section, before: beforeText })
      } else if (data.type === 'EDIT_PICK_IMAGE') {
        const src = str(data.src, 4000)
        const key = imageKey(src) ?? (/^https?:\/\//.test(src) ? src : null)
        if (!key) {
          toast.error('This picture is drawn by the page itself and can’t be replaced here.')
          return
        }
        const parts = useWorkflowStore.getState().pageParts
        const code = useWorkflowStore.getState().previewCode
        const replaced = (parts ? parts.blocks.map(b => b.code) : [code]).some(c => c.includes('intentdraw:user-images') && c.includes(JSON.stringify(key).slice(1, -1)))
        setPendingImage({ section, key, alt: str(data.alt, 160), replaced })
      }
    },
    [apply]
  )

  return { apply, undoLast, undoCount, onEditMessage, pendingImage, setPendingImage, textRequest, setTextRequest, sectionRequest, setSectionRequest }
}

/** The strip over the preview while editing. */
export function EditBar({ undoCount, onUndo, onDone }: { undoCount: number; onUndo: () => void; onDone: () => void }) {
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-line bg-surface2 px-4">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      <p className="truncate text-[12px] text-muted">
        <span className="text-ink">Editing.</span> Click words to change them, a picture to put your own in, or “Change …” to rebuild a section from a note. Enter saves, Esc cancels.
      </p>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="quiet" icon={<Undo2 size={12} />} disabled={undoCount === 0} onClick={onUndo}>
          Undo
        </Button>
        <Button size="sm" variant="outline" icon={<X size={12} />} onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

/** Replace one picture: choose a file, it is stored, the page shows it. */
export function ImageDialog({ pending, onClose, apply }: { pending: PendingImage | null; onClose: () => void; apply: (edits: PageEdit[]) => Promise<boolean> }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setError(null)
    onClose()
  }

  const upload = async (file: File | undefined) => {
    if (!file || !pending) return
    setBusy(true)
    setError(null)
    try {
      const picture = await preparePicture(file)
      const form = new FormData()
      form.append('file', picture, 'picture')
      const res = await fetch('/api/uploads/image', { method: 'POST', body: form })
      const result = await res.json().catch(() => null)
      if (!result?.success || typeof result.data?.url !== 'string') throw new Error(result?.error || 'The picture could not be uploaded.')
      if (await apply([{ kind: 'image', section: pending.section, key: pending.key, url: result.data.url }])) {
        toast.success('Picture replaced')
        setBusy(false)
        onClose()
        return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The picture could not be uploaded.')
    }
    setBusy(false)
  }

  const restore = async () => {
    if (!pending) return
    if (await apply([{ kind: 'image', section: pending.section, key: pending.key, url: '' }])) onClose()
  }

  return (
    <Dialog
      open={pending !== null}
      onClose={close}
      eyebrow="Edit"
      title="Replace this picture"
      footer={
        <>
          {pending?.replaced && (
            <Button variant="quiet" icon={<RotateCcw size={13} />} disabled={busy} onClick={restore}>
              Put the original back
            </Button>
          )}
          <Button variant="primary" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : 'Choose a picture'}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-[1.7] text-muted">
        {pending?.alt ? <>This is <span className="text-ink">“{pending.alt}”</span>. </> : null}
        Your picture takes its place everywhere the page shows it, and stays when the section is rebuilt. JPEG, PNG or WebP; large photos are shrunk first.
      </p>
      {error && <p className="mt-3 text-[12.5px] text-[var(--c-danger)]">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          void upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </Dialog>
  )
}

/** Words animated letter by letter can't be typed over in place; they are changed here instead. */
export function TextDialog({ request, onClose, apply }: { request: { section: string | null; before: string } | null; onClose: () => void; apply: (edits: PageEdit[]) => Promise<boolean> }) {
  const [value, setValue] = useState('')
  const [shown, setShown] = useState<typeof request>(null)
  if (request !== shown) {
    setShown(request)
    setValue(request?.before ?? '')
  }
  const save = async () => {
    if (!request) return
    if (await apply([{ kind: 'text', section: request.section, before: request.before, after: value }])) onClose()
  }
  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      eyebrow="Edit"
      title="Change these words"
      footer={
        <Button variant="primary" disabled={!value.trim() || value === request?.before} onClick={save}>
          Save
        </Button>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Text" value={value} maxLength={600} autoFocus onChange={e => setValue(e.target.value)} />
      </form>
    </Dialog>
  )
}

/**
 * "Point and say": change one section by saying what should be different. One
 * model call — the same rebuild as the Sections list, with the user's words as
 * its note. Pictures the user put in are kept (replaceSection carries them).
 */
export function SectionChangeDialog({ request, onClose }: { request: { section: string; snippet: string } | null; onClose: () => void }) {
  const { rebuildSection } = useAI()
  const rebuilding = useWorkflowStore((s) => s.rebuildingSection)
  const generating = useWorkflowStore((s) => s.status === 'generating')
  const [note, setNote] = useState('')
  const [shown, setShown] = useState<typeof request>(null)
  if (request !== shown) {
    setShown(request)
    setNote('')
  }
  const busy = rebuilding !== null || generating
  const submit = async () => {
    if (!request || !note.trim() || busy) return
    const section = request.section
    onClose()
    toast(`Rebuilding ${section}`, { description: 'Just this section — everything else stays as it is.' })
    const ok = await rebuildSection(section, note.trim())
    if (ok) toast.success(`${section} rebuilt`)
    else toast.error(`Could not rebuild ${section}. The old version is kept.`)
  }
  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      eyebrow="Edit"
      title={request ? `Change ${request.section}` : 'Change this section'}
      footer={
        <Button variant="primary" disabled={!note.trim() || busy} onClick={submit}>
          {busy ? 'Busy…' : 'Rebuild this section'}
        </Button>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
      >
        {request?.snippet ? <p className="mb-3 truncate text-[12px] text-faint">“{request.snippet}”</p> : null}
        <label className="block">
          <span className="mono-label mb-2 block text-faint">What should be different?</span>
          <textarea
            value={note}
            autoFocus
            maxLength={300}
            rows={3}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
            }}
            placeholder="e.g. make it a comparison table, warmer copy, put the photo on the left"
            className="w-full resize-y rounded-[10px] border border-line bg-surface2 p-3 text-[12.5px] leading-[1.6] text-ink placeholder:text-faint focus:border-accent"
          />
        </label>
        <p className="mt-2 text-[11px] text-faint">One model call. Only this section changes; your own pictures in it are kept.</p>
      </form>
    </Dialog>
  )
}

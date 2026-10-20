'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, Copy, Loader2, RefreshCw, Wrench, X } from 'lucide-react'
import { Button, Dialog, cx } from '@/components/kit/kit'
import { useWorkflowStore, type PreviewIssue } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { MAX_SECTION_NOTE_CHARS, type PageParts } from '@/lib/ai/page-parts'
import { auditBySection } from '@/lib/utils/page-audit'

/* -------------------------------------------------------------------------- */
/* Finding the issue                                                           */
/* -------------------------------------------------------------------------- */

/** The section a component belongs to: itself, or the block that defines it as a helper. */
function sectionOf(name: string | null, parts: PageParts | null): string | null {
  if (!name || !parts) return null
  if (parts.sections.includes(name)) return name
  const declares = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?(?:const|let|var|function|class)\\s+${name.replace(/[$]/g, '\\$')}\\b`)
  return parts.blocks.find((b) => declares.test(b.code))?.sections[0] ?? null
}

/** React's component stack reads `at HeroSection`, innermost first. */
function sectionFromStack(stack: string, parts: PageParts | null): string | null {
  for (const match of stack.matchAll(/\bat\s+([A-Za-z_$][\w$]*)/g)) {
    const section = sectionOf(match[1], parts)
    if (section) return section
  }
  return null
}

/**
 * Watches the page on screen for the two ways it can be broken:
 *  - it doesn't compile — checked here with the same parser the preview uses,
 *    so it is found even when no preview frame is showing;
 *  - it crashes while rendering — reported by the preview frame.
 * Mounted once, by the editor.
 */
export function useIssueWatcher() {
  const previewCode = useWorkflowStore((s) => s.previewCode)
  const generating = useWorkflowStore((s) => s.status === 'generating')
  const setIssue = useWorkflowStore((s) => s.setIssue)
  const setAudit = useWorkflowStore((s) => s.setAudit)

  useEffect(() => {
    if (!previewCode || generating) return
    let cancelled = false
    // Loaded on demand: the parser is large and only this check needs it.
    void import('@/lib/ai/validate').then(({ findSyntaxProblem, declarationAt }) => {
      if (cancelled) return
      const problem = findSyntaxProblem(previewCode)
      if (!problem) return
      const parts = useWorkflowStore.getState().pageParts
      const duplicate = problem.message.match(/^(?:Duplicate declaration "|Identifier ')([A-Za-z_$][\w$]*)/)?.[1] ?? null
      setIssue({
        kind: 'compile',
        message: problem.line ? `${problem.message} (line ${problem.line})` : problem.message,
        section: sectionOf(duplicate, parts) ?? sectionOf(declarationAt(previewCode, problem.line), parts),
        line: problem.line,
      })
    })
    return () => {
      cancelled = true
    }
  }, [previewCode, generating, setIssue])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: unknown; kind?: unknown; message?: unknown; stack?: unknown; section?: unknown; partial?: unknown; findings?: unknown } | null
      if (data?.type === 'IFRAME_AUDIT') {
        // What the rendered page looks like to a reader — offered per section as a rebuild note.
        const { status, pageParts } = useWorkflowStore.getState()
        if (status !== 'generating' && pageParts) setAudit(auditBySection(data.findings, pageParts.sections))
        return
      }
      if (!data || data.type !== 'IFRAME_ERROR') return
      if (data.kind !== 'compile' && data.kind !== 'runtime') return
      // A page mid-build is expected to be incomplete.
      if (useWorkflowStore.getState().status === 'generating') return
      const parts = useWorkflowStore.getState().pageParts
      // A section's own boundary names it; the frame is untrusted, so the name
      // only counts if it is one of this page's sections.
      const named = typeof data.section === 'string' && parts?.sections.includes(data.section) ? data.section : null
      setIssue({
        kind: data.kind,
        message: String(data.message ?? 'Unknown error').slice(0, 4000),
        section: named ?? sectionFromStack(String(data.stack ?? ''), parts),
        line: null,
        partial: data.kind === 'runtime' && data.partial === true,
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setIssue, setAudit])
}

/* -------------------------------------------------------------------------- */
/* Saying it, and fixing it                                                    */
/* -------------------------------------------------------------------------- */

function wording(issue: PreviewIssue) {
  const where = issue.section ?? 'The page'
  if (issue.partial) {
    return { title: `${issue.section ?? 'A section'} crashed`, body: `${issue.section ?? 'One section'} hit an error as it started and was left out. The rest of the page is showing.` }
  }
  return issue.kind === 'compile'
    ? { title: 'The page didn’t compile', body: `${where} has a mistake in its code, so the site can’t be shown yet.` }
    : { title: 'The page crashed while loading', body: `${where} hit an error as it started, so the site can’t be shown yet.` }
}

/** The one-click repair: rebuild the section at fault (one model call), or the site if it can't be pinned down. */
function useIssueFix() {
  const issue = useWorkflowStore((s) => s.issue)
  const rebuilding = useWorkflowStore((s) => s.rebuildingSection)
  const generating = useWorkflowStore((s) => s.status === 'generating')
  const { rebuildSection, generateCode } = useAI()

  const section = issue?.section ?? null
  const busy = generating || rebuilding !== null
  const fix = async () => {
    if (!issue || busy) return
    if (!section) {
      void generateCode()
      return
    }
    const note = `The last version of this section failed with: ${issue.message}. Write it again so it compiles and runs.`.slice(0, MAX_SECTION_NOTE_CHARS)
    const ok = await rebuildSection(section, note)
    if (!ok) toast.error(`Could not rebuild ${section}. Try again, or build the site again.`)
  }
  return {
    fix,
    busy,
    label: busy ? (generating ? 'Building…' : `Rebuilding ${rebuilding}…`) : section ? `Rebuild ${section}` : 'Build the site again',
    hint: section ? 'One model call. Doesn’t use a generation.' : 'Uses one generation.',
  }
}

function FixButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { fix, busy, label } = useIssueFix()
  return (
    <Button size={size} variant="primary" disabled={busy} icon={busy ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />} onClick={() => void fix()}>
      {label}
    </Button>
  )
}

/** Top bar: appears while the page has an issue; reopens the details at any time. */
export function IssueButton({ onOpen }: { onOpen: () => void }) {
  const issue = useWorkflowStore((s) => s.issue)
  if (!issue) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      title="The page has an error — see what went wrong"
      className="flex h-8 items-center gap-1.5 rounded-[8px] border border-danger/40 bg-danger/10 px-2.5 text-[11.5px] text-ink transition-colors duration-150 hover:border-danger"
    >
      <AlertTriangle size={12} className="text-danger" />1 issue
    </button>
  )
}

/** The persistent notice. Closing it hides the notice only — the issue stays behind the top bar button. */
export function IssueNotice({ onDetails, className }: { onDetails: () => void; className?: string }) {
  const issue = useWorkflowStore((s) => s.issue)
  const open = useWorkflowStore((s) => s.issueNoticeOpen)
  const close = useWorkflowStore((s) => s.closeIssueNotice)
  const { hint } = useIssueFix()
  if (!issue || !open) return null
  const { title, body } = wording(issue)
  return (
    <div role="alert" className={cx('w-[340px] rounded-[12px] border border-danger/35 bg-surface p-3.5 shadow-plate', className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
          <AlertTriangle size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-ink">{title}</div>
          <p className="mt-1 text-[11.5px] leading-[1.6] text-muted">{body}</p>
        </div>
        <button type="button" onClick={close} aria-label="Close this notice" className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-faint transition-colors duration-150 hover:bg-surface2 hover:text-ink">
          <X size={12} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 pl-[34px]">
        <FixButton />
        <Button size="sm" variant="quiet" onClick={onDetails}>
          Details
        </Button>
      </div>
      <div className="mt-2 pl-[34px] text-[10.5px] text-faint">{hint}</div>
    </div>
  )
}

/** What the site area shows instead of a broken page. */
export function IssueEmptyState({ onDetails }: { onDetails: () => void }) {
  const issue = useWorkflowStore((s) => s.issue)
  const { hint } = useIssueFix()
  if (!issue) return null
  const { title, body } = wording(issue)
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg2 px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full border border-danger/30 bg-danger/10 text-danger">
        <AlertTriangle size={22} />
      </span>
      <h2 className="mt-6 text-[24px] text-ink">{title}.</h2>
      <p className="mt-2 max-w-[46ch] text-[13px] leading-[1.7] text-muted">{body} Your drawing, your prompt and every other section are untouched.</p>
      <div className="mt-6 flex items-center gap-2">
        <FixButton size="md" />
        <Button variant="outline" onClick={onDetails}>
          See what went wrong
        </Button>
      </div>
      <div className="mt-3 text-[11px] text-faint">{hint}</div>
    </div>
  )
}

export function IssueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const issue = useWorkflowStore((s) => s.issue)
  const { hint } = useIssueFix()
  const [copied, setCopied] = useState(false)

  // Fixed while the dialog is open: nothing left to show.
  useEffect(() => {
    if (open && !issue) onClose()
  }, [open, issue, onClose])

  const copy = async () => {
    if (!issue) return
    try {
      await navigator.clipboard.writeText(`${issue.kind === 'compile' ? 'Compile error' : 'Runtime error'}${issue.section ? ` in ${issue.section}` : ''}\n${issue.message}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the details')
    }
  }

  const text = issue ? wording(issue) : null
  return (
    <Dialog
      open={open && !!issue}
      onClose={onClose}
      eyebrow="Issue"
      title={text?.title ?? 'Issue'}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="mr-auto text-[11px] text-faint">{hint}</span>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          <FixButton size="md" />
        </div>
      }
    >
      {issue && text && (
        <div className="space-y-4">
          <p className="text-[13px] leading-[1.7] text-muted">{text.body}</p>
          <dl className="grid grid-cols-[92px_1fr] gap-y-2 text-[12px]">
            <dt className="text-faint">Where</dt>
            <dd className="text-ink">{issue.section ?? 'Could not be narrowed to one section'}</dd>
            <dt className="text-faint">Kind</dt>
            <dd className="text-ink">{issue.kind === 'compile' ? 'The code doesn’t compile' : 'The code compiles, then crashes when it runs'}</dd>
          </dl>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="mono-label text-faint">Technical details</span>
              <button type="button" onClick={() => void copy()} className="flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink">
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-line bg-bg2 p-3 font-mono text-[11.5px] leading-[1.6] text-muted">{issue.message}</pre>
          </div>
          {!issue.section && (
            <p className="flex items-start gap-2 text-[11.5px] leading-[1.6] text-faint">
              <RefreshCw size={12} className="mt-0.5 shrink-0" />
              You can also rebuild a single section from the Sections list in the Build panel — that never uses a generation.
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}

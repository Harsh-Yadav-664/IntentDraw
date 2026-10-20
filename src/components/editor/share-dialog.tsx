'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, ExternalLink, Globe, Link2, Lock, X } from 'lucide-react'
import { Button, Chip, Dialog, Switch, cx } from '@/components/kit/kit'

/**
 * Publish the generated site at /p/<id>. Off by default — a project is private
 * until its owner turns this on, and turning it off takes the page down.
 */
export function ShareDialog({ open, onClose, projectId, hasOutput, onChange }: { open: boolean; onClose: () => void; projectId: string; hasOutput: boolean; onChange?: (isPublic: boolean) => void }) {
  const [isPublic, setIsPublic] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = typeof window !== 'undefined' ? `${window.location.origin}/p/${projectId}` : `/p/${projectId}`

  // Read the current setting when the dialog opens, not on every page load.
  useEffect(() => {
    if (!open || isPublic !== null) return
    let cancelled = false
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setIsPublic(!!json?.data?.project?.is_public)
      })
      .catch(() => {
        if (!cancelled) setIsPublic(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, isPublic, projectId])

  const toggle = async (next: boolean) => {
    setSaving(true)
    const previous = isPublic
    setIsPublic(next)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onChange?.(next)
      toast.success(next ? 'Published — anyone with the link can view the site.' : 'Unpublished — the link no longer works.')
    } catch {
      setIsPublic(previous)
      toast.error('Could not change sharing. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const live = isPublic === true

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Publish to a public link"
      eyebrow="Sharing"
      footer={
        <>
          {live && (
            <Button variant="danger" className="mr-auto" icon={<X size={13} />} onClick={() => toggle(false)} disabled={saving}>
              Unpublish
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[13.5px] text-ink">{isPublic === null ? 'Checking…' : live ? 'Your site is live' : 'Your site is private'}</div>
            <p className="mt-1.5 max-w-[42ch] text-[12px] leading-[1.7] text-muted">
              {live
                ? 'Anyone with the link can see the built site. Your drawing, prompt and reading stay private.'
                : hasOutput
                  ? 'Nothing is on the public link right now. Turn this on to publish the current version.'
                  : 'Generate a site first — there is nothing to publish yet.'}
            </p>
          </div>
          <Switch checked={live} onChange={toggle} label="Publish to a public link" disabled={isPublic === null || saving || (!hasOutput && !live)} />
        </div>

        <div className={cx('flex items-center gap-2 rounded-[10px] border p-2 transition-colors duration-200', live ? 'border-line bg-surface2' : 'border-dashed border-line2 opacity-60')}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
            {live ? <Globe size={13} className="shrink-0 text-ok" /> : <Lock size={13} className="shrink-0 text-faint" />}
            <span className="tab-num truncate text-[12px] text-ink">{url.replace(/^https?:\/\//, '')}</span>
          </div>
          <Button size="sm" variant="outline" icon={copied ? <Check size={12} /> : <Copy size={12} />} disabled={!live} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <a
            href={live ? url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!live}
            className={cx(
              'inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line2 px-3 text-[12px] text-ink transition-colors duration-150 hover:bg-surface2',
              !live && 'pointer-events-none opacity-40',
            )}
          >
            <ExternalLink size={12} /> Open
          </a>
        </div>

        <div className="rounded-[10px] border border-line bg-surface2 p-4">
          <div className="mono-label mb-3 text-faint">What visitors see</div>
          <div className="space-y-2.5">
            {(
              [
                [true, 'The built site, at full width'],
                [true, 'Your project name, as the page title'],
                [false, 'Your drawing, prompt or reading'],
                [false, 'Your account or your other projects'],
              ] as const
            ).map(([good, text]) => (
              <div key={text} className="flex items-center gap-2.5">
                <span className={cx('grid h-4 w-4 place-items-center rounded-full', good ? 'bg-ok/15 text-ok' : 'bg-surface3 text-faint')}>
                  {good ? <Check size={10} /> : <X size={10} />}
                </span>
                <span className="text-[12px] text-muted">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Chip tone="neutral">
            <Link2 size={10} /> Custom domain
          </Chip>
          <Chip tone="warn">Coming soon</Chip>
        </div>
      </div>
    </Dialog>
  )
}

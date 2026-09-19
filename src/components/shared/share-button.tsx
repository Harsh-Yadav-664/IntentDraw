'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Check, Copy, ExternalLink, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Share a generated site at /p/<id>. Off by default — a project is private until
 * its owner turns this on, and turning it off takes the page down.
 */
export function ShareButton({ projectId, hasOutput }: { projectId: string; hasOutput: boolean }) {
  const [open, setOpen] = useState(false)
  const [isPublic, setIsPublic] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = typeof window !== 'undefined' ? `${window.location.origin}/p/${projectId}` : `/p/${projectId}`

  // Read the current setting when the popover opens, not on every page load.
  useEffect(() => {
    if (!open || isPublic !== null) return
    let cancelled = false
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(json => {
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
      toast.success(next ? 'Anyone with the link can now view this site.' : 'Sharing turned off.')
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
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm hover:bg-white/10">
          <Globe className="h-3.5 w-3.5" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-white/10 bg-popover p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Share this site</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Anyone with the link can view the generated site. Your drawing and prompt stay private.
            </p>
          </div>
          {isPublic === null ? (
            <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={isPublic}
              onCheckedChange={toggle}
              disabled={saving || (!hasOutput && !isPublic)}
              aria-label="Share publicly"
            />
          )}
        </div>

        {!hasOutput && !isPublic && (
          <p className="mt-3 text-xs text-muted-foreground/70">Generate a site first — there’s nothing to share yet.</p>
        )}

        {isPublic && (
          <div className="mt-3 flex items-center gap-1.5">
            <input
              readOnly
              value={url}
              onFocus={e => e.currentTarget.select()}
              className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 text-xs text-foreground/90"
              aria-label="Share link"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copy} title="Copy link">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="Open">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

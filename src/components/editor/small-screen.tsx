'use client'

import { useSyncExternalStore } from 'react'
import { Maximize2, Share2 } from 'lucide-react'
import { Button, ButtonLink } from '@/components/kit/kit'
import { LogoMark } from '@/components/kit/sketch'
import PreviewFrame from '@/components/preview/preview-frame'
import { useWorkflowStore } from '@/store/workflow-store'
import { openInNewTab } from '@/lib/export'

const QUERY = '(max-width: 1023.98px)'

/** True below the editor's 1024px minimum. False on the server and on first paint of a desktop. */
export function useSmallScreen(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(QUERY)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}

/**
 * Below 1024px the editor can't work (drawing and the build panel need room),
 * but the built site can still be looked at, shared and opened — at real phone
 * width, in the same sandboxed frame. Mounted only on small screens, so a
 * desktop never runs a second live preview behind the editor.
 */
export function SmallScreenView({ onShare }: { onShare: () => void }) {
  const small = useSmallScreen()
  const code = useWorkflowStore((s) => s.previewCode)
  const name = useWorkflowStore((s) => s.projectName)
  if (!small) return null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg lg:hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <LogoMark size={18} />
        <span className="truncate text-[14px] text-ink">{name || 'Untitled project'}</span>
        <ButtonLink href="/dashboard" size="sm" variant="quiet" className="ml-auto">
          Projects
        </ButtonLink>
      </div>
      {code ? (
        <>
          <div className="min-h-0 flex-1">
            <PreviewFrame code={code} deviceSize="mobile" className="h-full w-full" />
          </div>
          <div className="shrink-0 border-t border-line px-4 py-3">
            <p className="text-[12px] leading-[1.6] text-muted">Your site at phone width. Drawing and editing need a screen at least 1024px wide.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon={<Share2 size={12} />} onClick={onShare}>
                Share
              </Button>
              <Button size="sm" variant="outline" icon={<Maximize2 size={12} />} onClick={() => openInNewTab(code, name)}>
                Open full screen
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="overflow-y-auto px-6 py-10">
          <h1 className="text-[28px] leading-tight text-ink">The editor is best on a desktop.</h1>
          <p className="mt-4 max-w-[46ch] text-[13.5px] leading-[1.75] text-muted">
            Nothing is built yet, and drawing and the build panel need a screen at least 1024px wide. Your project is saved — open it on a larger screen to keep going.
          </p>
          <div className="mt-8">
            <ButtonLink href="/dashboard" variant="primary">
              Back to projects
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  )
}

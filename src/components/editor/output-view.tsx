'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Code, Copy, Eye, Maximize2, Monitor, PenLine, RefreshCw, Smartphone, Tablet } from 'lucide-react'
import { Button, Segmented } from '@/components/kit/kit'
import { SketchEmptyState } from '@/components/kit/sketch'
import PreviewFrame, { DEVICE_WIDTHS } from '@/components/preview/preview-frame'
import { useWorkflowStore } from '@/store/workflow-store'
import { exportSource, openInNewTab } from '@/lib/export'
import { ExportMenu } from './export-menu'
import { IssueEmptyState } from './issue'

type Device = 'desktop' | 'tablet' | 'mobile'

/** The built site in a browser frame: three device widths, the code, and the way out. */
export function OutputView({ projectId, isPublic, onBackToDesign, onIssueDetails }: { projectId: string; isPublic: boolean; onBackToDesign: () => void; onIssueDetails: () => void }) {
  // One crashed section leaves the rest of the page showing; only a page that
  // can't render at all is replaced by the empty state.
  const broken = useWorkflowStore((s) => s.issue !== null && !s.issue.partial)
  const previewCode = useWorkflowStore((s) => s.previewCode)
  const projectName = useWorkflowStore((s) => s.projectName)
  const building = useWorkflowStore((s) => s.status === 'generating')
  const [device, setDevice] = useState<Device>('desktop')
  const [mode, setMode] = useState<'preview' | 'code'>('preview')
  const [frameKey, setFrameKey] = useState(0)
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exportSource(previewCode, projectName))
      setCopied(true)
      toast.success('Code copied to the clipboard')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the code')
    }
  }

  const address = isPublic && typeof window !== 'undefined' ? `${window.location.host}/p/${projectId}` : 'preview — not published'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 flex-wrap items-center gap-3 border-b border-line px-5">
        <Segmented
          size="sm"
          label="Device width"
          value={device}
          onChange={setDevice}
          items={[
            { value: 'desktop', label: 'Desktop', icon: <Monitor size={12} />, disabled: mode === 'code' },
            { value: 'tablet', label: 'Tablet', icon: <Tablet size={12} />, disabled: mode === 'code' },
            { value: 'mobile', label: 'Mobile', icon: <Smartphone size={12} />, disabled: mode === 'code' },
          ]}
        />
        <div className="mono-label hidden text-faint xl:block">{mode === 'code' ? 'React + Tailwind source' : `${DEVICE_WIDTHS[device]}px · scaled to fit`}</div>
        <div className="ml-auto flex items-center gap-2">
          <Segmented
            size="sm"
            label="Preview or code"
            value={mode}
            onChange={setMode}
            items={[
              { value: 'preview', label: 'Preview', icon: <Eye size={12} /> },
              { value: 'code', label: 'Code', icon: <Code size={12} /> },
            ]}
          />
          <Button size="sm" variant="quiet" icon={<RefreshCw size={12} />} disabled={!previewCode} onClick={() => setFrameKey((k) => k + 1)} title="Run the page again from the top">
            Replay
          </Button>
          <Button size="sm" variant="outline" icon={<Maximize2 size={12} />} disabled={!previewCode} onClick={() => openInNewTab(previewCode, projectName)}>
            Open in new tab
          </Button>
          <ExportMenu variant="primary" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-5">
        <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-line2 bg-surface">
          <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-line px-4">
            <div className="flex gap-1.5">
              {['#E5735C', '#F0B357', '#7DD3A0'].map((c) => (
                <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <div className="mx-auto flex h-[22px] w-[320px] max-w-[50%] items-center justify-center rounded-full border border-line bg-surface2 px-3">
              <span className="tab-num truncate text-[10.5px] text-faint">{address}</span>
            </div>
            <div className="mono-label text-faint">{building ? 'building' : !previewCode ? 'empty' : broken ? 'error' : 'ready'}</div>
          </div>

          <div className="relative min-h-0 flex-1 bg-bg2">
            {!previewCode ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <SketchEmptyState className="h-[120px] w-[200px]" />
                <h2 className="mt-6 text-[24px] text-ink">Nothing built yet.</h2>
                <p className="mt-2 max-w-[44ch] text-[13px] leading-[1.7] text-muted">
                  Write a sentence about the site in the Build panel — draw first if you like — then press Generate. Sections appear here as they finish.
                </p>
                <Button variant="outline" className="mt-6" icon={<PenLine size={13} />} onClick={onBackToDesign}>
                  Back to the canvas
                </Button>
              </div>
            ) : mode === 'preview' ? (
              <>
                {/* The frame stays mounted — it is what reports a crash — with the explanation over it. */}
                <PreviewFrame key={frameKey} code={previewCode} deviceSize={device} className="h-full w-full" />
                {broken && <IssueEmptyState onDetails={onIssueDetails} />}
              </>
            ) : (
              <div className="h-full overflow-auto">
                <div className="sticky top-0 flex justify-end bg-gradient-to-b from-bg2 to-transparent p-3">
                  <Button size="sm" variant="outline" icon={copied ? <Check size={12} /> : <Copy size={12} />} onClick={copyCode}>
                    {copied ? 'Copied' : 'Copy code'}
                  </Button>
                </div>
                <pre className="min-h-full whitespace-pre-wrap px-5 pb-6 font-mono text-[12px] leading-[1.6] text-muted">{previewCode}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

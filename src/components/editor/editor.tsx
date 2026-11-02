'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronsRight, Layers, Monitor, Pencil, Share2, WifiOff } from 'lucide-react'
import { Button, ButtonLink, Segmented, cx } from '@/components/kit/kit'
import { LogoMark } from '@/components/kit/sketch'
import { useCanvasStore } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { useUsage } from '@/hooks/use-usage'
import useKeyboardShortcuts from '@/hooks/use-keyboard-shortcuts'
import { BuildPanel, useOnline } from './build-panel'
import { LayersPanel } from './layers-panel'
import { OutputView } from './output-view'
import { ExportMenu } from './export-menu'
import { ShareDialog } from './share-dialog'
import { UpgradeDialog } from './upgrade-dialog'
import { ReadingDialog } from './reading-dialog'
import { IssueButton, IssueDialog, IssueNotice, useIssueWatcher } from './issue'

// Konva needs browser APIs.
const DrawingCanvas = dynamic(() => import('@/components/canvas/drawing-canvas'), {
  ssr: false,
  loading: () => <div className="h-full w-full shimmer opacity-30" />,
})

function ProjectName() {
  const projectName = useWorkflowStore((s) => s.projectName)
  const setProjectName = useWorkflowStore((s) => s.setProjectName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(projectName)

  const commit = () => {
    const next = draft.trim().slice(0, 100)
    // An empty name would leave the header blank with no way back to it.
    if (next && next !== projectName) setProjectName(next)
    else setDraft(projectName)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={100}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(projectName)
            setEditing(false)
          }
        }}
        aria-label="Project name"
        className="h-8 w-[240px] rounded-[6px] border border-accent bg-surface2 px-2 text-[12.5px] text-ink"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(projectName)
        setEditing(true)
      }}
      title="Click to rename"
      className="h-8 min-w-0 max-w-[260px] truncate rounded-[6px] px-2 text-[12.5px] text-ink transition-colors duration-150 hover:bg-surface2"
    >
      {projectName}
    </button>
  )
}

function SaveState() {
  const saveStatus = useWorkflowStore((s) => s.saveStatus)
  const lastSavedAt = useWorkflowStore((s) => s.lastSavedAt)
  const online = useOnline()
  const time = lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  if (!online) {
    return (
      <span className="ml-1 hidden shrink-0 items-center gap-1.5 text-[11px] text-warn xl:flex">
        <WifiOff size={11} /> Offline — changes kept
      </span>
    )
  }
  return (
    <span className={cx('ml-1 hidden shrink-0 items-center gap-1.5 text-[11px] xl:flex', saveStatus === 'saving' ? 'text-accent' : saveStatus === 'error' ? 'text-warn' : 'text-faint')}>
      {saveStatus === 'saved' ? <Check size={11} /> : <span className={cx('h-1.5 w-1.5 rounded-full', saveStatus === 'error' ? 'bg-warn' : 'bg-accent', saveStatus === 'saving' && 'pulse-dot')} />}
      <span className="tab-num">
        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved — will retry' : saveStatus === 'unsaved' ? 'Unsaved changes' : `Saved ${time}`}
      </span>
    </span>
  )
}

function UsageChip({ stats, onClick }: { stats: ReturnType<typeof useUsage>['stats']; onClick: () => void }) {
  if (!stats) return null
  const uncapped = stats.limit >= 100_000
  return (
    <button
      type="button"
      onClick={onClick}
      title={uncapped ? 'Development: generations are not limited' : `${stats.remaining} of ${stats.limit} generations left today`}
      className="hidden h-8 items-center gap-2 rounded-[8px] border border-line px-2.5 transition-colors duration-150 hover:border-accent lg:flex"
    >
      {uncapped ? (
        <span className="text-[11px] text-faint">Dev · unlimited</span>
      ) : (
        <>
          <span className="tab-num text-[11px] text-ink">
            {stats.remaining}/{stats.limit}
          </span>
          <span className="h-[3px] w-10 overflow-hidden rounded-full bg-surface3">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((stats.remaining / Math.max(1, stats.limit)) * 100)}%` }} />
          </span>
          <span className="text-[11px] text-faint">left today</span>
        </>
      )}
    </button>
  )
}

export function Editor({ projectId, isPublic, onPublicChange }: { projectId: string; isPublic: boolean; onPublicChange: (v: boolean) => void }) {
  const viewMode = useCanvasStore((s) => s.viewMode)
  const setViewMode = useCanvasStore((s) => s.setViewMode)
  const regionCount = useCanvasStore((s) => s.regions.length)
  const progress = useWorkflowStore((s) => s.generationProgress)
  const plan = useWorkflowStore((s) => s.buildPlan)
  const hasOutput = useWorkflowStore((s) => s.previewCode.length > 0)
  const prompt = useWorkflowStore((s) => s.prompt)
  const { isGenerating, generateCode } = useAI()
  const { stats, refresh: refreshUsage } = useUsage()

  // A finished build used one generation; show the new count.
  const wasGenerating = useRef(isGenerating)
  useEffect(() => {
    if (wasGenerating.current && !isGenerating) void refreshUsage()
    wasGenerating.current = isGenerating
  }, [isGenerating, refreshUsage])

  const [tab, setTab] = useState<'build' | 'layers'>('build')
  const [collapsed, setCollapsed] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [readingOpen, setReadingOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  useIssueWatcher()

  const view = viewMode === 'preview' ? 'output' : 'design'
  const setView = (v: 'design' | 'output') => setViewMode(v === 'output' ? 'preview' : 'canvas')

  const generate = () => {
    if (isGenerating || !prompt.trim()) return
    void generateCode()
  }
  useKeyboardShortcuts({ enabled: view === 'design', onGenerate: generate })

  // A new group gets named and described in the Layers tab, so open it there.
  useEffect(
    () =>
      useCanvasStore.subscribe((state, prev) => {
        if (state.groups.length > prev.groups.length) {
          setTab('layers')
          setCollapsed(false)
        }
      }),
    [],
  )

  const built = plan?.filter((s) => s.status === 'built').length ?? 0
  const percent = progress ? progress.done / Math.max(1, progress.total) : 0

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-ink">
      {/* ================================ top bar ================================ */}
      <header className="relative grid h-[50px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line bg-bg2 px-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href="/dashboard" aria-label="Back to projects" className="flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink">
            <ArrowLeft size={14} />
            <LogoMark size={16} />
          </Link>
          <span className="text-faint">/</span>
          <ProjectName />
          <SaveState />
        </div>

        <Segmented
          label="Design or output"
          value={view}
          onChange={setView}
          items={[
            { value: 'design', label: 'Design', icon: <Pencil size={12} /> },
            {
              value: 'output',
              label: (
                <span className="flex items-center gap-1.5">
                  Output
                  {isGenerating && plan && (
                    <span className="tab-num text-[10px] opacity-70">
                      {built}/{plan.length}
                    </span>
                  )}
                </span>
              ),
              icon: <Monitor size={12} />,
            },
          ]}
        />

        <div className="flex items-center justify-end gap-2">
          <IssueButton onOpen={() => setIssueOpen(true)} />
          <UsageChip stats={stats} onClick={() => setUpgradeOpen(true)} />
          <Button size="sm" variant="outline" icon={<Share2 size={12} />} onClick={() => setShareOpen(true)}>
            Share
          </Button>
          <ExportMenu />
        </div>

        {/* thin global progress line */}
        {isGenerating && (
          <motion.div className="absolute bottom-[-1px] left-0 h-[2px] bg-accent" initial={{ width: '2%' }} animate={{ width: `${Math.max(2, percent * 100)}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
        )}
      </header>

      {/* ================================== body ================================= */}
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {view === 'design' ? (
            <DrawingCanvas />
          ) : (
            <OutputView projectId={projectId} isPublic={isPublic} onBackToDesign={() => setView('design')} onIssueDetails={() => setIssueOpen(true)} />
          )}
          {/* Stays until it is fixed or closed; above the tool dock on the canvas. */}
          <IssueNotice onDetails={() => setIssueOpen(true)} className={cx('absolute right-5 z-40', view === 'design' ? 'bottom-[92px]' : 'bottom-7')} />
        </div>

        <aside className="shrink-0 border-l border-line bg-bg2 transition-[width] duration-200" style={{ width: collapsed ? 44 : 344 }}>
          {collapsed ? (
            <button type="button" onClick={() => setCollapsed(false)} aria-label="Open panel" className="flex h-full w-full flex-col items-center gap-3 py-3 text-faint transition-colors duration-150 hover:text-ink">
              <ChevronsRight size={14} className="rotate-180" />
              <span className="mono-label" style={{ writingMode: 'vertical-rl' }}>
                Build & layers
              </span>
            </button>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex h-[44px] shrink-0 items-center gap-1 border-b border-line px-2">
                {(['build', 'layers'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cx('relative flex h-[44px] items-center gap-1.5 px-3 text-[12px] capitalize transition-colors duration-150', tab === t ? 'text-ink' : 'text-faint hover:text-ink')}
                  >
                    {t === 'build' ? <Pencil size={12} /> : <Layers size={12} />}
                    {t}
                    {t === 'layers' && <span className="tab-num text-[10.5px] text-faint">{regionCount}</span>}
                    {t === 'build' && isGenerating && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />}
                    {tab === t && <motion.span layoutId="panel-tab" className="absolute inset-x-2 bottom-[-1px] h-[2px] rounded-full bg-accent" />}
                  </button>
                ))}
                <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse panel" className="ml-auto grid h-8 w-8 place-items-center rounded-[8px] text-faint transition-colors duration-150 hover:bg-surface2 hover:text-ink">
                  <ChevronsRight size={14} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === 'build' ? (
                  <BuildPanel onShowOutput={() => setView('output')} onEditReading={() => setReadingOpen(true)} onUpgrade={() => setUpgradeOpen(true)} />
                ) : (
                  <LayersPanel />
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ============================ small screens ============================ */}
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-bg px-6 py-10 lg:hidden">
        <div className="flex items-center gap-2">
          <LogoMark size={18} />
          <span className="font-display text-[20px]">IntentDraw</span>
        </div>
        <h1 className="mt-8 text-[28px] leading-tight text-ink">The editor is best on a desktop.</h1>
        <p className="mt-4 max-w-[46ch] text-[13.5px] leading-[1.75] text-muted">Drawing and the build panel need a screen at least 1024px wide. Your project is saved — open it on a larger screen to keep going.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <ButtonLink href="/dashboard" variant="primary">
            Back to projects
          </ButtonLink>
          {isPublic && hasOutput && (
            <a href={`/p/${projectId}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-[10px] border border-line2 px-4 text-[13px] text-ink">
              Open the live site
            </a>
          )}
        </div>
      </div>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} projectId={projectId} hasOutput={hasOutput} onChange={onPublicChange} />
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} usage={stats} />
      <IssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} />
      <ReadingDialog open={readingOpen} onClose={() => setReadingOpen(false)} onGenerate={generate} generating={isGenerating} />
    </div>
  )
}

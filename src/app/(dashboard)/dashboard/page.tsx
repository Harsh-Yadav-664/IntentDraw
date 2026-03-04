'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Toolbar from '@/components/canvas/toolbar'
import ControlsPanel from '@/components/controls/controls-panel'
import PreviewPanel from '@/components/preview/preview-panel'
import { useCanvasStore } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import useKeyboardShortcuts from '@/hooks/use-keyboard-shortcuts'

// Dynamic import — Konva needs browser APIs
const DrawingCanvas = dynamic(
  () => import('@/components/canvas/drawing-canvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-lg border border-slate-200 bg-white flex items-center justify-center" style={{ height: '500px' }}>
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    ),
  }
)

export default function DashboardPage() {
  useKeyboardShortcuts()

  const regionsCount = useCanvasStore((s) => s.regions.length)
  const status = useWorkflowStore((s) => s.status)

  // Status indicator text
  const statusText = {
    idle: 'Ready',
    drawing: 'Drawing...',
    analyzing: 'Analyzing...',
    regions_ready: 'Regions detected',
    generating: 'Generating...',
    preview_ready: 'Preview ready',
    error: 'Error',
  }[status]

  const statusColor = {
    idle: 'bg-slate-400',
    drawing: 'bg-blue-500',
    analyzing: 'bg-yellow-500 animate-pulse',
    regions_ready: 'bg-green-500',
    generating: 'bg-yellow-500 animate-pulse',
    preview_ready: 'bg-green-500',
    error: 'bg-red-500',
  }[status]

  return (
    <main className="h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="text-xl font-bold">
              Intent<span className="text-blue-600">Draw</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                <span className="text-slate-600">{statusText}</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-sm text-slate-500">
                {regionsCount} region{regionsCount !== 1 ? 's' : ''}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/">Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-[1800px] mx-auto p-4 sm:p-6">
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            
            {/* Canvas Panel — 5 columns */}
            <div className="lg:col-span-5 flex flex-col space-y-3 min-h-0">
              <Toolbar />
              <div className="flex-1 min-h-0">
                <DrawingCanvas />
              </div>
            </div>

            {/* Controls Panel — 3 columns */}
            <div className="lg:col-span-3 min-h-0">
              <ControlsPanel />
            </div>

            {/* Preview Panel — 4 columns */}
            <div className="lg:col-span-4 min-h-0">
              <PreviewPanel />
            </div>
            
          </div>
        </div>
      </div>
    </main>
  )
}
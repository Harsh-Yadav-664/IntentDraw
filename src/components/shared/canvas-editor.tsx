// =============================================================================
// Canvas Editor Wrapper
// src/components/shared/canvas-editor.tsx
// =============================================================================
// This is a wrapper around your existing 3-panel dashboard layout.
// The existing dashboard/page.tsx has the full canvas UI.
// We extract it into this shared component so both:
//   - /dashboard (legacy, if you kept it) 
//   - /project/[id] (new project-based flow)
// can use the same canvas editor.
//
// HOW TO CREATE THIS:
// 1. Take the JSX content (the 3-panel layout) from your current
//    src/app/(dashboard)/dashboard/page.tsx
// 2. Move it into this file as a component called CanvasEditor
// 3. Add projectId prop so it knows which project it belongs to
//
// If your current dashboard/page.tsx is complex, the simplest approach
// is to just re-export it or create a thin wrapper:
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ChevronRight, Menu } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkflowStore } from '@/store/workflow-store'
import Toolbar from '@/components/canvas/toolbar'
import ControlsPanel from '@/components/controls/controls-panel'
import PreviewPanel from '@/components/preview/preview-panel'
import useKeyboardShortcuts from '@/hooks/use-keyboard-shortcuts'
import { useCanvasStore } from '@/store/canvas-store'
import type { ViewMode } from '@/types'

// Dynamic import — Konva needs browser APIs
const DrawingCanvas = dynamic(
  () => import('@/components/canvas/drawing-canvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded-2xl border border-white/10 bg-black/20 flex items-center justify-center backdrop-blur-sm">
        <Skeleton className="w-16 h-16 rounded-full bg-white/5" />
      </div>
    ),
  }
)

interface CanvasEditorProps {
  projectId: string
}

export function CanvasEditor({ projectId: _projectId }: CanvasEditorProps) {
  useKeyboardShortcuts()
  const viewMode = useCanvasStore((s) => s.viewMode)
  const [isControlsOpen, setControlsOpen] = useState(true)

  // Automatically collapse controls in split view to save space
  useEffect(() => {
    if (viewMode === 'split') {
      setControlsOpen(false)
    } else {
      setControlsOpen(true)
    }
  }, [viewMode])

  return (
    <div className="h-full relative overflow-hidden bg-[#0A0A0B]">
      {/* Dark dotted background pattern for the infinite canvas feel */}
      <div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', 
          backgroundSize: '24px 24px' 
        }} 
      />
      {/* Subtle ambient glows for premium feel */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-60" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none mix-blend-screen opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-primary/5 pointer-events-none mix-blend-overlay" />
      
      <div className="h-full flex relative z-10">
        
        {/* Main Workspace Area */}
        <div className="flex-1 h-full flex flex-col relative min-w-0">
          
          {/* Content Area */}
          <div className="flex-1 flex w-full h-full p-6 md:p-8 gap-6 overflow-hidden items-center justify-center">
             
             {/* Canvas Artboard */}
             {viewMode === 'canvas' && (
               <div className="relative flex flex-col animate-in fade-in zoom-in-95 duration-300 w-full h-full max-w-5xl max-h-full">
                 {/* Window Wrapper */}
                 <div className="flex-1 flex flex-col w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#121214] ring-1 ring-white/5 relative">
                    
                    {/* Top Canvas Ribbon (Toolbar) */}
                    <div className="h-12 bg-black/60 backdrop-blur-md border-b border-white/10 flex items-center px-4 flex-shrink-0 z-40 w-full justify-center">
                       <Toolbar />
                    </div>
                    
                    {/* Canvas Area */}
                    <div className="flex-1 relative w-full overflow-hidden">
                       <DrawingCanvas />
                    </div>
                 </div>
               </div>
             )}
             
             {/* Preview Artboard */}
             {viewMode === 'preview' && (
               <div className="relative flex flex-col animate-in fade-in zoom-in-95 duration-300 w-full h-full max-w-5xl max-h-full">
                 <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5 flex flex-col">
                    <PreviewPanel />
                 </div>
               </div>
             )}
             
          </div>

        </div>

        {/* Right Sidebar (Controls) */}
        <div 
          className={`h-full border-l border-white/5 flex-shrink-0 bg-[#0A0A0B]/95 backdrop-blur-xl z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out relative ${
            isControlsOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full border-l-0 shadow-none'
          }`}
        >
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setControlsOpen(!isControlsOpen)}
            className={`absolute top-4 -left-12 h-10 w-10 flex items-center justify-center rounded-l-xl bg-[#0A0A0B]/95 border border-r-0 border-white/10 text-white/70 hover:text-white transition-all backdrop-blur-xl z-50 shadow-[-5px_0_15px_rgba(0,0,0,0.5)] ${!isControlsOpen ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 hover:text-primary-foreground' : ''}`}
            title={isControlsOpen ? "Collapse controls" : "Expand controls"}
          >
            {isControlsOpen ? <ChevronRight className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="w-80 h-full p-4 overflow-hidden flex flex-col">
            <ControlsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
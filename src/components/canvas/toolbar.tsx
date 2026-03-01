'use client'

import { useCanvasStore } from '@/store/canvas-store'
import type { CanvasTool } from '@/types'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  MousePointer2,
  Square,
  Circle,
  Pencil,
  ArrowUpRight,
  Undo2,
  Redo2,
  Trash2,
  RotateCcw,
} from 'lucide-react'

const TOOLS: { id: CanvasTool; icon: LucideIcon; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'C' },
  { id: 'freeform', icon: Pencil, label: 'Pencil', shortcut: 'P' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Arrow', shortcut: 'A' },
]

export default function Toolbar() {
  const activeTool = useCanvasStore((s) => s.activeTool)
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const selectedRegionId = useCanvasStore((s) => s.selectedRegionId)
  const deleteRegion = useCanvasStore((s) => s.deleteRegion)
  const clearRegions = useCanvasStore((s) => s.clearRegions)
  const canUndo = useCanvasStore((s) => s.canUndo)
  const canRedo = useCanvasStore((s) => s.canRedo)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const regionsCount = useCanvasStore((s) => s.regions.length)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 p-2 bg-slate-50 rounded-lg border">
        {TOOLS.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? 'default' : 'ghost'}
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => setActiveTool(tool.id)}
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {tool.label}{' '}
                <kbd className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">
                  {tool.shortcut}
                </kbd>
              </p>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Undo <kbd className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Ctrl+Z</kbd></p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Redo <kbd className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Ctrl+Shift+Z</kbd></p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => { if (selectedRegionId) deleteRegion(selectedRegionId) }}
              disabled={!selectedRegionId}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Delete <kbd className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Del</kbd></p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={clearRegions}
              disabled={regionsCount === 0}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Clear canvas</p>
          </TooltipContent>
        </Tooltip>

        {regionsCount > 0 && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <span className="text-xs text-slate-500 px-2">
              {regionsCount} region{regionsCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
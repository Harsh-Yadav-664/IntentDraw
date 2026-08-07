import { useEffect } from 'react'
import { useCanvasStore } from '@/store/canvas-store'

/**
 * Global keyboard shortcuts for the canvas.
 * Ignores keypresses when user is typing in an input/textarea.
 */
export default function useKeyboardShortcuts() {
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const selectRegions = useCanvasStore((s) => s.selectRegions)
  const deleteRegions = useCanvasStore((s) => s.deleteRegions)
  const selectedRegionIds = useCanvasStore((s) => s.selectedRegionIds)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key.toLowerCase()

      if (e.ctrlKey || e.metaKey) {
        if (key === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        }
        return
      }

      switch (key) {
        case 'v': setActiveTool('select'); break
        case 'r': setActiveTool('rectangle'); break
        case 'c': setActiveTool('circle'); break
        case 'p': setActiveTool('freeform'); break
        case 'a': setActiveTool('arrow'); break
        case 'escape': selectRegions([]); break
        case 'delete':
        case 'backspace':
          if (selectedRegionIds.length > 0) {
            e.preventDefault()
            deleteRegions(selectedRegionIds)
          }
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedRegionIds, setActiveTool, selectRegions, deleteRegions, undo, redo])
}
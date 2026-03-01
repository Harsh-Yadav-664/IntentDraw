import { useEffect } from 'react'
import { useCanvasStore } from '@/store/canvas-store'

/**
 * Global keyboard shortcuts for the canvas.
 * Ignores keypresses when user is typing in an input/textarea.
 */
export default function useKeyboardShortcuts() {
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const selectRegion = useCanvasStore((s) => s.selectRegion)
  const deleteRegion = useCanvasStore((s) => s.deleteRegion)
  const selectedRegionId = useCanvasStore((s) => s.selectedRegionId)
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
        case 'escape': selectRegion(null); break
        case 'delete':
        case 'backspace':
          if (selectedRegionId) {
            e.preventDefault()
            deleteRegion(selectedRegionId)
          }
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedRegionId, setActiveTool, selectRegion, deleteRegion, undo, redo])
}
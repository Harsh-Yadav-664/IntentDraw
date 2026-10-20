import { useEffect, useRef } from 'react'
import { useCanvasStore } from '@/store/canvas-store'
import type { CanvasTool } from '@/types'

const TOOL_KEYS: Record<string, CanvasTool> = {
  v: 'select',
  r: 'rectangle',
  o: 'circle',
  c: 'circle',
  p: 'freeform',
  a: 'arrow',
}

/**
 * The editor's keyboard shortcuts. Typing in a field is left alone, except
 * Ctrl/Cmd+Enter, which builds the site from anywhere.
 *
 * Only active in Design view (`enabled`), where the canvas is on screen.
 */
export default function useKeyboardShortcuts({ enabled, onGenerate }: { enabled: boolean; onGenerate?: () => void }) {
  // Read through a ref so the listener is bound once, yet always calls the
  // latest callback.
  const generateRef = useRef(onGenerate)
  useEffect(() => {
    generateRef.current = onGenerate
  }, [onGenerate])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key === 'Enter') {
        e.preventDefault()
        generateRef.current?.()
        return
      }
      if (typing || !enabled) return

      const store = useCanvasStore.getState()
      const key = e.key.toLowerCase()
      const selected = store.selectedRegionIds

      if (mod) {
        if (key === 'z') {
          e.preventDefault()
          if (e.shiftKey) store.redo()
          else store.undo()
        } else if (key === 'y') {
          e.preventDefault()
          store.redo()
        } else if (key === 'a') {
          e.preventDefault()
          store.selectAll()
        } else if (key === 'd') {
          e.preventDefault()
          if (selected.length > 0) store.duplicateRegions(selected)
        } else if (key === 'g') {
          e.preventDefault()
          store.groupSelection()
        }
        return
      }

      if (e.altKey) return
      if (TOOL_KEYS[key]) {
        store.setActiveTool(TOOL_KEYS[key])
        return
      }
      if (key === 'escape') {
        store.selectRegions([])
        store.setActiveTool('select')
        return
      }
      if ((key === 'delete' || key === 'backspace') && selected.length > 0) {
        e.preventDefault()
        store.deleteRegions(selected)
        return
      }
      if (e.key.startsWith('Arrow') && selected.length > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        store.translateRegions(selected, dx, dy)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled])
}

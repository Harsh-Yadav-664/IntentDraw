import { create } from 'zustand'
import type { Region, RegionGeometry, CanvasTool } from '@/types'
import { generateUUID } from '@/lib/utils'

// Structural type for the Konva stage — avoids importing konva in a non-client file.
// Only declares the method we actually call.
interface StageExporter {
  toDataURL(config?: { pixelRatio?: number }): string
}

// History lives outside the store so snapshots don't trigger re-renders.
// Only the boolean flags (canUndo/canRedo) are reactive.
let _history: Region[][] = [[]]
let _historyIndex = 0

interface CanvasStore {
  regions: Region[]
  activeTool: CanvasTool
  selectedRegionId: string | null
  canUndo: boolean
  canRedo: boolean
  _stageInstance: StageExporter | null

  setActiveTool: (tool: CanvasTool) => void
  selectRegion: (id: string | null) => void
  setStageInstance: (stage: StageExporter | null) => void

  addRegion: (geometry: RegionGeometry) => void
  updateRegionGeometry: (id: string, updates: Partial<RegionGeometry>) => void
  updateRegionIntent: (id: string, intent: string) => void
  deleteRegion: (id: string) => void
  clearRegions: () => void
  setRegions: (regions: Region[]) => void

  undo: () => void
  redo: () => void

  exportToPng: () => string | null
  exportAsJson: () => string
  importFromJson: (json: string) => void
}

export const useCanvasStore = create<CanvasStore>((set, get) => {
  const syncHistoryFlags = () => {
    set({
      canUndo: _historyIndex > 0,
      canRedo: _historyIndex < _history.length - 1,
    })
  }

  // Deep-clone regions and push to history stack (max 50 entries)
  const pushHistory = () => {
    const { regions } = get()
    _history = _history.slice(0, _historyIndex + 1)
    _history.push(JSON.parse(JSON.stringify(regions)) as Region[])
    if (_history.length > 50) _history = _history.slice(-50)
    _historyIndex = _history.length - 1
    syncHistoryFlags()
  }

  // After a region is deleted, close gaps: [1,3] → [1,2]
  const renumber = (regions: Region[]): Region[] =>
    regions.map((r, i) => ({ ...r, regionNumber: i + 1 }))

  return {
    regions: [],
    activeTool: 'select',
    selectedRegionId: null,
    canUndo: false,
    canRedo: false,
    _stageInstance: null,

    setActiveTool: (tool) => set({ activeTool: tool, selectedRegionId: null }),
    selectRegion: (id) => set({ selectedRegionId: id }),
    setStageInstance: (stage) => set({ _stageInstance: stage }),

    addRegion: (geometry) => {
      const { regions } = get()
      const now = new Date().toISOString()
      const newRegion: Region = {
        id: generateUUID(),
        regionNumber: regions.length + 1,
        geometry,
        intent: '',
        lockState: { layout: false, style: false, animation: false },
        generatedCode: null,
        createdAt: now,
        updatedAt: now,
      }
      set({ regions: [...regions, newRegion] })
      pushHistory()
    },

    updateRegionGeometry: (id, updates) => {
      set((state) => ({
        regions: state.regions.map((r) =>
          r.id === id
            ? { ...r, geometry: { ...r.geometry, ...updates }, updatedAt: new Date().toISOString() }
            : r
        ),
      }))
      pushHistory()
    },

    updateRegionIntent: (id, intent) => {
      set((state) => ({
        regions: state.regions.map((r) =>
          r.id === id ? { ...r, intent, updatedAt: new Date().toISOString() } : r
        ),
      }))
    },

    deleteRegion: (id) => {
      const { selectedRegionId } = get()
      set((state) => ({
        regions: renumber(state.regions.filter((r) => r.id !== id)),
        selectedRegionId: selectedRegionId === id ? null : selectedRegionId,
      }))
      pushHistory()
    },

    clearRegions: () => {
      set({ regions: [], selectedRegionId: null })
      pushHistory()
    },

    setRegions: (regions) => set({ regions }),

    undo: () => {
      if (_historyIndex <= 0) return
      _historyIndex--
      set({
        regions: JSON.parse(JSON.stringify(_history[_historyIndex])) as Region[],
        selectedRegionId: null,
      })
      syncHistoryFlags()
    },

    redo: () => {
      if (_historyIndex >= _history.length - 1) return
      _historyIndex++
      set({
        regions: JSON.parse(JSON.stringify(_history[_historyIndex])) as Region[],
        selectedRegionId: null,
      })
      syncHistoryFlags()
    },

    exportToPng: () => {
      const stage = get()._stageInstance
      if (!stage) return null
      return stage.toDataURL({ pixelRatio: 2 })
    },

    exportAsJson: () => JSON.stringify(get().regions),

    importFromJson: (json) => {
      try {
        const regions = JSON.parse(json) as Region[]
        set({ regions, selectedRegionId: null })
        pushHistory()
      } catch (e) {
        console.error('Failed to import canvas JSON:', e)
      }
    },
  }
})
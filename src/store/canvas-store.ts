import { create } from 'zustand'
import type { Region, RegionGeometry, CanvasTool } from '@/types'
import { generateUUID } from '@/lib/utils'

interface StageExporter {
  toDataURL(config?: { pixelRatio?: number }): string
}

let _history: Region[][] = [[]]
let _historyIndex = 0

interface CanvasStore {
  regions: Region[]
  activeTool: CanvasTool
  selectedRegionId: string | null
  canUndo: boolean
  canRedo: boolean
  _stageInstance: StageExporter | null
  
  // Visibility tracking
  visibility: Record<string, boolean>

  setActiveTool: (tool: CanvasTool) => void
  selectRegion: (id: string | null) => void
  setStageInstance: (stage: StageExporter | null) => void

  addRegion: (geometry: RegionGeometry) => void
  updateRegionGeometry: (id: string, updates: Partial<RegionGeometry>) => void
  updateRegionIntent: (id: string, intent: string) => void
  deleteRegion: (id: string) => void
  clearRegions: () => void
  setRegions: (regions: Region[]) => void
  
  // Visibility actions
  toggleVisibility: (id: string) => void
  setVisibility: (id: string, visible: boolean) => void

  undo: () => void
  redo: () => void

  exportToPng: () => string | null
  exportAsJson: () => string
  importFromJson: (json: string) => void
}

// Region colors - Photoshop-like palette
export const REGION_COLORS = [
  '#3A7BFF', // Blue
  '#FF6B35', // Orange
  '#2EC4B6', // Teal
  '#E040FB', // Purple
  '#FFD600', // Yellow
  '#00E676', // Green
  '#FF4081', // Pink
  '#00B0FF', // Light Blue
  '#76FF03', // Lime
  '#FF6D00', // Deep Orange
  '#651FFF', // Deep Purple
  '#F50057', // Red
]

export const useCanvasStore = create<CanvasStore>((set, get) => {
  const syncHistoryFlags = () => {
    set({
      canUndo: _historyIndex > 0,
      canRedo: _historyIndex < _history.length - 1,
    })
  }

  const pushHistory = () => {
    const { regions } = get()
    _history = _history.slice(0, _historyIndex + 1)
    _history.push(JSON.parse(JSON.stringify(regions)) as Region[])
    if (_history.length > 50) _history = _history.slice(-50)
    _historyIndex = _history.length - 1
    syncHistoryFlags()
  }

  const renumber = (regions: Region[]): Region[] =>
    regions.map((r, i) => ({ ...r, regionNumber: i + 1 }))

  return {
    regions: [],
    activeTool: 'select',
    selectedRegionId: null,
    canUndo: false,
    canRedo: false,
    _stageInstance: null,
    visibility: {},

    setActiveTool: (tool) => set({ activeTool: tool, selectedRegionId: null }),
    selectRegion: (id) => set({ selectedRegionId: id }),
    setStageInstance: (stage) => set({ _stageInstance: stage }),

    addRegion: (geometry) => {
      const { regions, visibility } = get()
      const now = new Date().toISOString()
      const newId = generateUUID()
      const newRegion: Region = {
        id: newId,
        regionNumber: regions.length + 1,
        geometry,
        intent: '',
        lockState: { layout: false, style: false, animation: false },
        generatedCode: null,
        createdAt: now,
        updatedAt: now,
      }
      set({ 
        regions: [...regions, newRegion],
        visibility: { ...visibility, [newId]: true }
      })
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
      const { selectedRegionId, visibility } = get()
      const newVisibility = { ...visibility }
      delete newVisibility[id]
      
      set((state) => ({
        regions: renumber(state.regions.filter((r) => r.id !== id)),
        selectedRegionId: selectedRegionId === id ? null : selectedRegionId,
        visibility: newVisibility,
      }))
      pushHistory()
    },

    clearRegions: () => {
      set({ regions: [], selectedRegionId: null, visibility: {} })
      pushHistory()
    },

    setRegions: (regions) => {
      const visibility: Record<string, boolean> = {}
      regions.forEach(r => { visibility[r.id] = true })
      set({ regions, visibility })
    },
    
    toggleVisibility: (id) => {
      set((state) => ({
        visibility: { 
          ...state.visibility, 
          [id]: state.visibility[id] === false ? true : false 
        }
      }))
    },
    
    setVisibility: (id, visible) => {
      set((state) => ({
        visibility: { ...state.visibility, [id]: visible }
      }))
    },

    undo: () => {
      if (_historyIndex <= 0) return
      _historyIndex--
      const regions = JSON.parse(JSON.stringify(_history[_historyIndex])) as Region[]
      const visibility: Record<string, boolean> = {}
      regions.forEach(r => { visibility[r.id] = true })
      set({ regions, selectedRegionId: null, visibility })
      syncHistoryFlags()
    },

    redo: () => {
      if (_historyIndex >= _history.length - 1) return
      _historyIndex++
      const regions = JSON.parse(JSON.stringify(_history[_historyIndex])) as Region[]
      const visibility: Record<string, boolean> = {}
      regions.forEach(r => { visibility[r.id] = true })
      set({ regions, selectedRegionId: null, visibility })
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
        const visibility: Record<string, boolean> = {}
        regions.forEach(r => { visibility[r.id] = true })
        set({ regions, selectedRegionId: null, visibility })
        pushHistory()
      } catch (e) {
        console.error('Failed to import canvas JSON:', e)
      }
    },
  }
})
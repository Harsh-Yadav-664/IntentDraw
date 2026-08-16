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
  selectedRegionIds: string[]
  canUndo: boolean
  canRedo: boolean
  _stageInstance: StageExporter | null
  
  // Visibility tracking
  visibility: Record<string, boolean>

  // View Mode
  viewMode: 'canvas' | 'split' | 'preview'
  setViewMode: (mode: 'canvas' | 'split' | 'preview') => void

  setActiveTool: (tool: CanvasTool) => void
  selectRegions: (ids: string[]) => void
  toggleRegionSelection: (id: string) => void
  setStageInstance: (stage: StageExporter | null) => void

  addRegion: (geometry: RegionGeometry) => void
  updateRegionGeometry: (id: string, updates: Partial<RegionGeometry>) => void
  updateRegionIntent: (id: string, intent: string) => void
  deleteRegions: (ids: string[]) => void
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

// Region colors - Professional wireframe palette
export const REGION_COLORS = [
  '#8b949e', // Muted Gray
  '#58a6ff', // Muted Blue
  '#3fb950', // Muted Green
  '#bc8cff', // Muted Purple
  '#d29922', // Muted Yellow
  '#f85149', // Muted Red
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
    selectedRegionIds: [],
    canUndo: false,
    canRedo: false,
    _stageInstance: null,
    viewMode: 'canvas',
    visibility: {},

    setViewMode: (mode) => set({ viewMode: mode }),
    setActiveTool: (tool) => set({ activeTool: tool, selectedRegionIds: [] }),
    selectRegions: (ids) => set({ selectedRegionIds: ids }),
    toggleRegionSelection: (id) => set((state) => ({
      selectedRegionIds: state.selectedRegionIds.includes(id)
        ? state.selectedRegionIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedRegionIds, id]
    })),
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

    deleteRegions: (ids) => {
      const { selectedRegionIds, visibility } = get()
      const newVisibility = { ...visibility }
      ids.forEach(id => delete newVisibility[id])
      
      set((state) => ({
        regions: renumber(state.regions.filter((r) => !ids.includes(r.id))),
        selectedRegionIds: selectedRegionIds.filter(id => !ids.includes(id)),
        visibility: newVisibility,
      }))
      pushHistory()
    },

    clearRegions: () => {
      set({ regions: [], selectedRegionIds: [], visibility: {} })
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
      set({ regions, selectedRegionIds: [], visibility })
      syncHistoryFlags()
    },

    redo: () => {
      if (_historyIndex >= _history.length - 1) return
      _historyIndex++
      const regions = JSON.parse(JSON.stringify(_history[_historyIndex])) as Region[]
      const visibility: Record<string, boolean> = {}
      regions.forEach(r => { visibility[r.id] = true })
      set({ regions, selectedRegionIds: [], visibility })
      syncHistoryFlags()
    },

    exportToPng: () => {
      const stage = get()._stageInstance
      if (!stage) return null
      
      // Temporarily add a background rect so the image isn't transparent
      // We use any type here to bypass strict Konva types since we just need the layer
      const layer = (stage as any).getLayers()[0]
      if (layer && typeof window !== 'undefined' && (window as any).Konva) {
        const bgRect = new (window as any).Konva.Rect({
          x: 0,
          y: 0,
          width: (stage as any).width(),
          height: (stage as any).height(),
          fill: '#0A0A0B',
          listening: false,
        })
        layer.add(bgRect)
        bgRect.moveToBottom()
        layer.draw()
        
        const dataUrl = stage.toDataURL({ pixelRatio: 2 })
        
        bgRect.destroy()
        layer.draw()
        
        return dataUrl
      }
      
      return stage.toDataURL({ pixelRatio: 2 })
    },

    exportAsJson: () => JSON.stringify(get().regions),

    importFromJson: (json) => {
      try {
        const regions = JSON.parse(json) as Region[]
        const visibility: Record<string, boolean> = {}
        regions.forEach(r => { visibility[r.id] = true })
        set({ regions, selectedRegionIds: [], visibility })
        pushHistory()
      } catch (e) {
        console.error('Failed to import canvas JSON:', e)
      }
    },
  }
})
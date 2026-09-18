import { create } from 'zustand'
import type { Region, RegionGeometry, RegionGroup, CanvasData, CanvasTool } from '@/types'
import { generateUUID } from '@/lib/utils'

interface StageExporter {
  toDataURL(config?: { pixelRatio?: number }): string
}

interface HistoryEntry {
  regions: Region[]
  groups: RegionGroup[]
}

let _history: HistoryEntry[] = [{ regions: [], groups: [] }]
let _historyIndex = 0

interface CanvasStore {
  regions: Region[]
  groups: RegionGroup[]
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
  setCanvasData: (data: CanvasData) => void

  // Groups
  groupSelection: (name?: string) => string | null
  ungroup: (groupId: string) => void
  updateGroupIntent: (groupId: string, intent: string) => void
  renameGroup: (groupId: string, name: string) => void

  // Visibility actions
  toggleVisibility: (id: string) => void
  setVisibility: (id: string, visible: boolean) => void

  undo: () => void
  redo: () => void

  exportToPng: () => string | null
  exportAsJson: () => string
  importFromJson: (json: string) => void
}

/**
 * Reads persisted canvas state. Projects saved before groups existed hold a
 * bare `Region[]`, so both shapes have to keep working.
 */
export function parseCanvasData(raw: unknown): CanvasData {
  if (Array.isArray(raw)) return { regions: raw as Region[], groups: [] }
  if (raw && typeof raw === 'object') {
    const data = raw as Partial<CanvasData>
    if (Array.isArray(data.regions)) {
      return { regions: data.regions, groups: Array.isArray(data.groups) ? data.groups : [] }
    }
  }
  return { regions: [], groups: [] }
}

/** The members of a group, in region order. */
export function regionsInGroup(regions: Region[], groupId: string): Region[] {
  return regions.filter(r => r.groupId === groupId)
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
    const { regions, groups } = get()
    _history = _history.slice(0, _historyIndex + 1)
    _history.push(JSON.parse(JSON.stringify({ regions, groups })) as HistoryEntry)
    if (_history.length > 50) _history = _history.slice(-50)
    _historyIndex = _history.length - 1
    syncHistoryFlags()
  }

  /** Restores a history entry, rebuilding the derived visibility map. */
  const restore = (entry: HistoryEntry) => {
    const { regions, groups } = JSON.parse(JSON.stringify(entry)) as HistoryEntry
    const visibility: Record<string, boolean> = {}
    regions.forEach(r => { visibility[r.id] = true })
    set({ regions, groups, selectedRegionIds: [], visibility })
    syncHistoryFlags()
  }

  /** Groups with no remaining members are noise in the UI and the prompt. */
  const dropEmptyGroups = (regions: Region[], groups: RegionGroup[]): RegionGroup[] =>
    groups.filter(g => regions.some(r => r.groupId === g.id))

  const renumber = (regions: Region[]): Region[] =>
    regions.map((r, i) => ({ ...r, regionNumber: i + 1 }))

  // Normalize a geometry so x/y is ALWAYS the top-left of the bounding box
  // and width/height are the full bbox span. Freeform/arrow paths stay
  // relative to that origin. This keeps every downstream consumer
  // (layout analyzer, intent classifier, prompt builders) consistent.
  const normalizeGeometry = (geometry: RegionGeometry): RegionGeometry => {
    if ((geometry.type === 'freeform' || geometry.type === 'arrow') && geometry.path && geometry.path.length > 0) {
      const xs = geometry.path.map(p => p.x)
      const ys = geometry.path.map(p => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs)
      const maxY = Math.max(...ys)
      return {
        ...geometry,
        x: geometry.x + minX,
        y: geometry.y + minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        path: geometry.path.map(p => ({ x: p.x - minX, y: p.y - minY })),
      }
    }
    return geometry
  }

  return {
    regions: [],
    groups: [],
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
        geometry: normalizeGeometry(geometry),
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
            ? { ...r, geometry: normalizeGeometry({ ...r.geometry, ...updates }), updatedAt: new Date().toISOString() }
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

      set((state) => {
        const regions = renumber(state.regions.filter((r) => !ids.includes(r.id)))
        return {
          regions,
          groups: dropEmptyGroups(regions, state.groups),
          selectedRegionIds: selectedRegionIds.filter(id => !ids.includes(id)),
          visibility: newVisibility,
        }
      })
      pushHistory()
    },

    clearRegions: () => {
      set({ regions: [], groups: [], selectedRegionIds: [], visibility: {} })
      pushHistory()
    },

    setRegions: (regions) => {
      const visibility: Record<string, boolean> = {}
      regions.forEach(r => { visibility[r.id] = true })
      set({ regions, visibility })
    },

    setCanvasData: ({ regions, groups }) => {
      const visibility: Record<string, boolean> = {}
      regions.forEach(r => { visibility[r.id] = true })
      set({ regions, groups: dropEmptyGroups(regions, groups), visibility })
    },

    groupSelection: (name) => {
      const { selectedRegionIds, regions, groups } = get()
      if (selectedRegionIds.length < 2) return null

      const now = new Date().toISOString()
      const group: RegionGroup = {
        id: generateUUID(),
        name: name?.trim() || `Group ${groups.length + 1}`,
        intent: '',
        createdAt: now,
        updatedAt: now,
      }

      const nextRegions = regions.map(r =>
        selectedRegionIds.includes(r.id) ? { ...r, groupId: group.id, updatedAt: now } : r
      )
      set({
        regions: nextRegions,
        // A region belongs to one group, so re-grouping can empty its old one.
        groups: dropEmptyGroups(nextRegions, [...groups, group]),
      })
      pushHistory()
      return group.id
    },

    ungroup: (groupId) => {
      set((state) => ({
        regions: state.regions.map(r => (r.groupId === groupId ? { ...r, groupId: null } : r)),
        groups: state.groups.filter(g => g.id !== groupId),
      }))
      pushHistory()
    },

    updateGroupIntent: (groupId, intent) => {
      set((state) => ({
        groups: state.groups.map(g =>
          g.id === groupId ? { ...g, intent, updatedAt: new Date().toISOString() } : g
        ),
      }))
    },

    renameGroup: (groupId, name) => {
      set((state) => ({
        groups: state.groups.map(g =>
          g.id === groupId ? { ...g, name, updatedAt: new Date().toISOString() } : g
        ),
      }))
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
      restore(_history[_historyIndex])
    },

    redo: () => {
      if (_historyIndex >= _history.length - 1) return
      _historyIndex++
      restore(_history[_historyIndex])
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

    exportAsJson: () => JSON.stringify({ regions: get().regions, groups: get().groups }),

    importFromJson: (json) => {
      try {
        const { regions, groups } = parseCanvasData(JSON.parse(json))
        const visibility: Record<string, boolean> = {}
        regions.forEach(r => { visibility[r.id] = true })
        set({ regions, groups, selectedRegionIds: [], visibility })
        pushHistory()
      } catch (e) {
        console.error('Failed to import canvas JSON:', e)
      }
    },
  }
})
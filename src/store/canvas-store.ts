import { create } from 'zustand'
import type { Region, RegionGeometry, RegionGroup, RegionTag, CanvasData, CanvasTool } from '@/types'
import { generateUUID } from '@/lib/utils'

import type Konva from 'konva'

/** The Konva stage, as far as exporting needs it. */
type StageExporter = Pick<Konva.Stage, 'toDataURL' | 'getLayers' | 'position' | 'find'>

/**
 * The scale the drawing is exported at for vision models — roughly what the
 * old full-width canvas produced, and independent of the editor's zoom, so
 * the same drawing always reaches the model the same size.
 */
const EXPORT_SCALE = 0.8

/** How far a duplicate lands from its original, in canvas units. */
const DUPLICATE_OFFSET = 24

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
  /** Several shapes moved or resized at once (a drag, a transform) — one undo step. */
  setRegionGeometries: (updates: Array<{ id: string; geometry: Partial<RegionGeometry> }>) => void
  /** Move shapes by a distance in canvas units (arrow-key nudges) — one undo step. */
  translateRegions: (ids: string[], dx: number, dy: number) => void
  /** Copies the shapes a little down and to the right, and selects the copies. */
  duplicateRegions: (ids: string[]) => string[]
  selectAll: () => void
  updateRegionIntent: (id: string, intent: string) => void
  /** The user's one-click answer to "what is this, and where does it go?" — null clears it. */
  setRegionTag: (regionNumbers: number[], tag: RegionTag | null) => void
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

// Region label colours — the one place the interface allows a second hue.
export const REGION_COLORS = ['#FACC15', '#7DD3A0', '#F08A6B', '#7FB2E5', '#C3A6F0', '#E9C46A']

/** A region's colour, by its number. */
export function regionColor(regionNumber: number): string {
  return REGION_COLORS[(Math.max(1, regionNumber) - 1) % REGION_COLORS.length]
}

/** Shapes shifted by (dx, dy). Paths are relative to x/y, so they move with it. */
export function translated(regions: Region[], ids: string[], dx: number, dy: number, now = new Date().toISOString()): Region[] {
  return regions.map((r) =>
    ids.includes(r.id)
      ? { ...r, geometry: { ...r.geometry, x: r.geometry.x + dx, y: r.geometry.y + dy }, updatedAt: now }
      : r
  )
}

/**
 * Copies of the given shapes, offset so they don't sit exactly on top of the
 * originals, numbered after every existing region. Copies keep the description
 * and tag but not the group — a copy is a new thing until the user says so.
 */
export function duplicates(regions: Region[], ids: string[], newId: () => string, now = new Date().toISOString()): Region[] {
  let next = regions.length
  return regions
    .filter((r) => ids.includes(r.id))
    .map((r) => ({
      ...r,
      id: newId(),
      regionNumber: ++next,
      geometry: {
        ...r.geometry,
        x: r.geometry.x + DUPLICATE_OFFSET,
        y: r.geometry.y + DUPLICATE_OFFSET,
        path: r.geometry.path?.map((p) => ({ ...p })),
      },
      groupId: null,
      tag: r.tag ? { ...r.tag } : undefined,
      generatedCode: null,
      createdAt: now,
      updatedAt: now,
    }))
}

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

    setRegionGeometries: (updates) => {
      const byId = new Map(updates.map((u) => [u.id, u.geometry]))
      let changed = false
      const now = new Date().toISOString()
      const regions = get().regions.map((r) => {
        const patch = byId.get(r.id)
        if (!patch) return r
        const geometry = normalizeGeometry({ ...r.geometry, ...patch })
        if (JSON.stringify(geometry) === JSON.stringify(r.geometry)) return r
        changed = true
        return { ...r, geometry, updatedAt: now }
      })
      // A drag ends once per dragged shape; only the first carries a change.
      if (!changed) return
      set({ regions })
      pushHistory()
    },

    translateRegions: (ids, dx, dy) => {
      if (ids.length === 0 || (dx === 0 && dy === 0)) return
      set((state) => ({ regions: translated(state.regions, ids, dx, dy) }))
      pushHistory()
    },

    duplicateRegions: (ids) => {
      const { regions, visibility } = get()
      const copies = duplicates(regions, ids, generateUUID)
      if (copies.length === 0) return []
      const nextVisibility = { ...visibility }
      copies.forEach((c) => { nextVisibility[c.id] = true })
      set({ regions: [...regions, ...copies], visibility: nextVisibility, selectedRegionIds: copies.map((c) => c.id) })
      pushHistory()
      return copies.map((c) => c.id)
    },

    selectAll: () => {
      const { regions, visibility } = get()
      set({ selectedRegionIds: regions.filter((r) => visibility[r.id] !== false).map((r) => r.id) })
    },

    updateRegionIntent: (id, intent) => {
      set((state) => ({
        regions: state.regions.map((r) =>
          r.id === id ? { ...r, intent, updatedAt: new Date().toISOString() } : r
        ),
      }))
    },

    setRegionTag: (regionNumbers, tag) => {
      set((state) => ({
        regions: state.regions.map((r) => {
          if (!regionNumbers.includes(r.regionNumber)) return r
          const next = tag ? { ...r.tag, ...tag } : undefined
          const empty = !next || (!next.kind && !next.anchor)
          return { ...r, tag: empty ? undefined : next, updatedAt: new Date().toISOString() }
        }),
      }))
      pushHistory()
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
      const nextGroups = dropEmptyGroups(regions, groups)
      set({ regions, groups: nextGroups, visibility, selectedRegionIds: [] })

      // History is module-level and survives navigation. Without this reset,
      // loading a project and pressing undo restored the *previous* project's
      // shapes onto this canvas — and auto-save then persisted them.
      _history = [JSON.parse(JSON.stringify({ regions, groups: nextGroups })) as HistoryEntry]
      _historyIndex = 0
      syncHistoryFlags()
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
      const { regions } = get()
      const layer = stage.getLayers()[0]
      if (!layer) return null

      // The editor's stage is the size of the visible window and scrolls; the
      // export draws the whole drawing at a fixed scale, from the origin.
      const previousPosition = stage.position()
      const previousScale = layer.scale()
      const shownOnScreenOnly = stage.find('.screen-only')
      const shownInExportOnly = stage.find('.export-only')
      stage.position({ x: 0, y: 0 })
      layer.scale({ x: EXPORT_SCALE, y: EXPORT_SCALE })
      shownOnScreenOnly.forEach((n) => n.hide())
      shownInExportOnly.forEach((n) => n.show())

      // Only the drawn area. The canvas is several pages tall and mostly empty;
      // positions reach the model as text, the image only conveys how the
      // strokes look, so cropping loses nothing.
      const pad = 24
      const visible = regions.filter((r) => get().visibility[r.id] !== false)
      const drawn = visible.length > 0 ? visible : regions
      const minX = Math.min(...drawn.map((r) => r.geometry.x))
      const minY = Math.min(...drawn.map((r) => r.geometry.y))
      const maxX = Math.max(...drawn.map((r) => r.geometry.x + r.geometry.width))
      const maxY = Math.max(...drawn.map((r) => r.geometry.y + r.geometry.height))
      const crop =
        drawn.length > 0
          ? {
              x: Math.max(0, Math.floor(minX * EXPORT_SCALE - pad)),
              y: Math.max(0, Math.floor(minY * EXPORT_SCALE - pad)),
              width: Math.ceil((maxX - minX) * EXPORT_SCALE + pad * 2),
              height: Math.ceil((maxY - minY) * EXPORT_SCALE + pad * 2),
            }
          : { x: 0, y: 0, width: 1024, height: 640 }

      // A background so the image isn't transparent (dark strokes on
      // transparency read as nothing to a vision model).
      const KonvaGlobal = typeof window !== 'undefined'
        ? (window as unknown as { Konva?: typeof Konva }).Konva
        : undefined
      const bgRect = KonvaGlobal
        ? new KonvaGlobal.Rect({
            x: crop.x / EXPORT_SCALE,
            y: crop.y / EXPORT_SCALE,
            width: crop.width / EXPORT_SCALE,
            height: crop.height / EXPORT_SCALE,
            fill: '#0A0A0B',
            listening: false,
          })
        : null
      if (bgRect) {
        layer.add(bgRect)
        bgRect.moveToBottom()
      }

      let dataUrl: string | null = null
      try {
        dataUrl = stage.toDataURL({ pixelRatio: 1, ...crop })
      } finally {
        bgRect?.destroy()
        shownInExportOnly.forEach((n) => n.hide())
        shownOnScreenOnly.forEach((n) => n.show())
        layer.scale(previousScale)
        stage.position(previousPosition)
        layer.batchDraw()
      }
      return dataUrl
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
// Development-only handle for in-browser verification (e.g. checking what
// exportToPng sends a vision model) without spending generation quota.
// Compiled out of production builds.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __canvasStore?: typeof useCanvasStore }).__canvasStore = useCanvasStore
}

import { beforeEach, describe, expect, it } from 'vitest'
import { duplicates, regionColor, translated, useCanvasStore, REGION_COLORS } from './canvas-store'
import type { Region } from '@/types'

const region = (n: number, extra: Partial<Region> = {}): Region => ({
  id: `r${n}`,
  regionNumber: n,
  geometry: { type: 'rectangle', x: n * 10, y: n * 20, width: 100, height: 50 },
  intent: `shape ${n}`,
  lockState: { layout: false, style: false, animation: false },
  generatedCode: null,
  createdAt: 't',
  updatedAt: 't',
  ...extra,
})

describe('region colours', () => {
  it('cycles through the palette by region number', () => {
    expect(regionColor(1)).toBe(REGION_COLORS[0])
    expect(regionColor(REGION_COLORS.length + 1)).toBe(REGION_COLORS[0])
    expect(regionColor(0)).toBe(REGION_COLORS[0])
  })
})

describe('moving and copying shapes', () => {
  it('moves only the chosen shapes, paths included', () => {
    const stroke = region(2, { geometry: { type: 'freeform', x: 5, y: 5, width: 10, height: 10, path: [{ x: 0, y: 0 }, { x: 10, y: 10 }] } })
    const out = translated([region(1), stroke], ['r2'], 7, -3)
    expect(out[0].geometry).toEqual(region(1).geometry)
    expect(out[1].geometry.x).toBe(12)
    expect(out[1].geometry.y).toBe(2)
    // Paths are relative to x/y, so they don't change.
    expect(out[1].geometry.path).toEqual(stroke.geometry.path)
  })

  it('numbers copies after every existing shape and leaves them ungrouped', () => {
    let n = 0
    const regions = [region(1, { groupId: 'g1', tag: { kind: 'picture' } }), region(2), region(3)]
    const copies = duplicates(regions, ['r1', 'r3'], () => `new-${++n}`)
    expect(copies.map((c) => c.regionNumber)).toEqual([4, 5])
    expect(copies.map((c) => c.id)).toEqual(['new-1', 'new-2'])
    expect(copies[0].groupId).toBeNull()
    expect(copies[0].tag).toEqual({ kind: 'picture' })
    expect(copies[0].tag).not.toBe(regions[0].tag)
    expect(copies[0].geometry.x).toBeGreaterThan(regions[0].geometry.x)
    expect(copies[0].intent).toBe('shape 1')
  })
})

describe('store actions', () => {
  beforeEach(() => {
    useCanvasStore.getState().setCanvasData({ regions: [region(1), region(2)], groups: [] })
  })

  it('duplicates and selects the copies, as one undo step', () => {
    const ids = useCanvasStore.getState().duplicateRegions(['r1'])
    const state = useCanvasStore.getState()
    expect(state.regions).toHaveLength(3)
    expect(state.selectedRegionIds).toEqual(ids)
    state.undo()
    expect(useCanvasStore.getState().regions).toHaveLength(2)
  })

  it('records a multi-shape move once, and ignores a move that changes nothing', () => {
    const store = useCanvasStore.getState()
    store.setRegionGeometries([
      { id: 'r1', geometry: { x: 300 } },
      { id: 'r2', geometry: { x: 400 } },
    ])
    expect(useCanvasStore.getState().canUndo).toBe(true)
    // The second shape's drag-end repeats the same positions: no new step.
    useCanvasStore.getState().setRegionGeometries([{ id: 'r1', geometry: { x: 300 } }])
    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().regions.map((r) => r.geometry.x)).toEqual([10, 20])
  })

  it('selects every visible shape', () => {
    useCanvasStore.getState().setVisibility('r2', false)
    useCanvasStore.getState().selectAll()
    expect(useCanvasStore.getState().selectedRegionIds).toEqual(['r1'])
  })
})

import { describe, expect, it } from 'vitest'
import { EXAMPLE_IDS, exampleCanvas, isExampleId } from './examples'
import { PAGE_CONFIG } from './canvas/pages'

let n = 0
const id = () => `id-${++n}`

describe('example projects', () => {
  it('only accepts known example ids', () => {
    expect(isExampleId('alpine')).toBe(true)
    expect(isExampleId('nope')).toBe(false)
    expect(isExampleId(undefined)).toBe(false)
  })

  it.each(EXAMPLE_IDS)('%s becomes a valid drawing on the canvas page', (example) => {
    const { regions, groups } = exampleCanvas(example, id)
    expect(groups).toEqual([])
    expect(regions.length).toBeGreaterThan(3)
    regions.forEach((r, i) => {
      expect(r.regionNumber).toBe(i + 1)
      expect(r.intent.length).toBeGreaterThan(0)
      const g = r.geometry
      for (const v of [g.x, g.y, g.width, g.height]) expect(Number.isFinite(v)).toBe(true)
      expect(g.x).toBeGreaterThanOrEqual(0)
      expect(g.x + g.width).toBeLessThanOrEqual(PAGE_CONFIG.pageWidth)
      expect(g.width).toBeGreaterThan(0)
      expect(g.height).toBeGreaterThan(0)
      // Strokes keep the store's invariant: path relative to the bbox's top-left.
      if (g.path) {
        expect(Math.min(...g.path.map((p) => p.x))).toBe(0)
        expect(Math.min(...g.path.map((p) => p.y))).toBe(0)
      }
    })
  })

  it('scales the source page onto the canvas page', () => {
    // The alpine nav was drawn at x=50, y=42 on a 1000 × 640 page.
    const nav = exampleCanvas('alpine', id).regions[0].geometry
    expect(nav.type).toBe('rectangle')
    expect(nav.x).toBeCloseTo((50 * PAGE_CONFIG.pageWidth) / 1000, 0)
    expect(nav.y).toBeCloseTo((42 * PAGE_CONFIG.pageHeight) / 640, 0)
    // The river runs from page 1 into page 2, as drawn.
    const river = exampleCanvas('alpine', id).regions[5].geometry
    expect(river.type).toBe('freeform')
    expect(river.y + river.height).toBeGreaterThan(PAGE_CONFIG.pageHeight)
  })
})

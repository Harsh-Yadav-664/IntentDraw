import { describe, expect, it } from 'vitest'
import { PAGE_CONFIG, pageCountFor, pageIndexForRegion, pageIndexForY, type PageConfig } from './pages'

const at = (y: number, height = 50) => ({
  geometry: { type: 'rectangle' as const, x: 0, y, width: 100, height },
})

describe('PAGE_CONFIG', () => {
  it('keeps the page width in sync with the preview and canvas (1280)', () => {
    expect(PAGE_CONFIG.pageWidth).toBe(1280)
    expect(PAGE_CONFIG.pageHeight).toBe(800)
  })
})

describe('pageIndexForRegion', () => {
  it('puts a shape on the page its top edge falls on (0-based)', () => {
    expect(pageIndexForRegion(at(0))).toBe(0)
    expect(pageIndexForRegion(at(799))).toBe(0)
    expect(pageIndexForRegion(at(800))).toBe(1)
    expect(pageIndexForRegion(at(2500))).toBe(3)
  })

  it('treats negative or non-finite y as the first page', () => {
    expect(pageIndexForRegion(at(-40))).toBe(0)
    expect(pageIndexForY(Number.NaN)).toBe(0)
  })

  it('never reports a page beyond the cap', () => {
    expect(pageIndexForRegion(at(100_000))).toBe(PAGE_CONFIG.maxPages - 1)
  })

  it('respects a custom plan config', () => {
    const plan: PageConfig = { ...PAGE_CONFIG, pageHeight: 1000, maxPages: 20 }
    expect(pageIndexForRegion(at(1999), plan)).toBe(1)
    expect(pageIndexForRegion(at(15_000), plan)).toBe(15)
  })
})

describe('pageCountFor', () => {
  it('starts with the default page count on an empty canvas', () => {
    expect(pageCountFor([])).toBe(PAGE_CONFIG.defaultPages)
  })

  it('keeps the default while shapes fit inside it with a spare page', () => {
    expect(pageCountFor([at(100)])).toBe(3)
    expect(pageCountFor([at(1500, 100)])).toBe(3) // bottom 1600 → 2 pages + 1 spare
  })

  it('grows to the lowest shape plus one spare page', () => {
    expect(pageCountFor([at(1700, 100)])).toBe(4) // bottom 1800 → page 3 + spare
    expect(pageCountFor([at(100), at(3000, 300)])).toBe(6)
  })

  it('honours explicitly added pages', () => {
    expect(pageCountFor([], 5)).toBe(5)
    expect(pageCountFor([at(1700, 100)], 2)).toBe(4)
  })

  it('never exceeds the plan cap', () => {
    expect(pageCountFor([at(20_000)])).toBe(PAGE_CONFIG.maxPages)
    expect(pageCountFor([], 99)).toBe(PAGE_CONFIG.maxPages)
    expect(pageCountFor([], 99, { ...PAGE_CONFIG, maxPages: 12 })).toBe(12)
  })
})

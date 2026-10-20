import { describe, expect, it } from 'vitest'
import { toThumbnail } from './thumbnail'

const rect = (n: number, x: number, y: number) => ({ regionNumber: n, geometry: { type: 'rectangle', x, y, width: 100, height: 40 } })

describe('project thumbnails', () => {
  it('reads both the current and the old saved shape', () => {
    expect(toThumbnail({ regions: [rect(1, 10, 20)], groups: [] })?.shapes).toHaveLength(1)
    expect(toThumbnail([rect(1, 10, 20)])?.shapes).toHaveLength(1)
    expect(toThumbnail(null)).toBeNull()
    expect(toThumbnail({ regions: [] })).toBeNull()
  })

  it('skips malformed shapes instead of failing', () => {
    const t = toThumbnail([rect(1, 10, 20), { geometry: { type: 'rectangle', x: 'a' } }, { geometry: { type: 'blob', x: 1, y: 1, width: 1, height: 1 } }, null])
    expect(t?.shapes).toHaveLength(1)
    expect(t?.total).toBe(4)
  })

  it('thins a long stroke to a few absolute points, keeping both ends', () => {
    const path = Array.from({ length: 200 }, (_, i) => ({ x: i, y: i % 7 }))
    const t = toThumbnail([{ regionNumber: 3, geometry: { type: 'freeform', x: 500, y: 300, width: 199, height: 6, path } }])
    const s = t!.shapes[0]
    expect(s.n).toBe(3)
    expect(s.points!.length).toBeLessThanOrEqual(16)
    expect(s.points![0]).toEqual([500, 300])
    expect(s.points![s.points!.length - 1]).toEqual([699, 300 + (199 % 7)])
    expect(t!.bottom).toBe(306)
  })
})

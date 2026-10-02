import { describe, expect, it } from 'vitest'
import { perceiveDrawing } from './perception'
import type { Region } from '@/types'

function stroke(regionNumber: number, points: Array<[number, number]>): Region {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    id: `r${regionNumber}`,
    regionNumber,
    geometry: {
      type: 'freeform',
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y,
      path: points.map(([px, py]) => ({ x: px - x, y: py - y })),
    },
    intent: '',
    lockState: { layout: false, style: false, animation: false },
    generatedCode: null,
    createdAt: '',
    updatedAt: '',
  } as Region
}

/** Evenly sampled points along a polyline, so strokes look hand-drawn-dense. */
function dense(corners: Array<[number, number]>, perSegment = 8): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1]
    const [bx, by] = corners[i]
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t])
    }
  }
  out.push(corners[corners.length - 1])
  return out
}

// The upper half of a circle centred at (640, 400), r = 170 — a rising sun.
const sunArc = Array.from({ length: 30 }, (_, i): [number, number] => {
  const a = Math.PI + (i / 29) * Math.PI
  return [640 + 170 * Math.cos(a), 400 + 170 * Math.sin(a)]
})

// A zig-zag hugging that arc just outside it — how people draw rays in one stroke.
const rays = Array.from({ length: 21 }, (_, i): [number, number] => {
  const a = Math.PI + (i / 20) * Math.PI
  const r = i % 2 === 0 ? 195 : 250
  return [640 + r * Math.cos(a), 400 + r * Math.sin(a)]
})

describe('perceiveDrawing', () => {
  it('reads a rising sun as an arc, and a zig-zag around it as wrapping it', () => {
    const facts = perceiveDrawing([stroke(1, sunArc), stroke(2, rays)])
    expect(facts.get(1)).toMatch(/circular arc/)
    expect(facts.get(2)).toMatch(/zig-zag/)
    expect(facts.get(2)).toMatch(/wraps around R1/)
  })

  it('reads a single-peak stroke as a ridge', () => {
    const facts = perceiveDrawing([stroke(1, dense([[0, 600], [300, 150], [700, 600]]))])
    expect(facts.get(1)).toMatch(/ridge-like/)
  })

  it('pairs two banks of a river even when they spread apart toward the viewer', () => {
    const left = stroke(1, dense([[600, 100], [580, 400], [520, 700]]))
    const right = stroke(2, dense([[630, 100], [660, 400], [760, 700]]))
    const facts = perceiveDrawing([left, right])
    expect(facts.get(1)).toMatch(/alongside R2.*widening/)
  })

  it('never calls two mountains the edges of one band', () => {
    const facts = perceiveDrawing([
      stroke(1, dense([[0, 650], [300, 180], [800, 650]])),
      stroke(2, dense([[600, 460], [1000, 150], [1280, 470]])),
    ])
    expect(facts.get(1) ?? '').not.toMatch(/alongside/)
  })

  it('does not call a gently curving line an arc', () => {
    // A long shallow bend — a river bank, not a sun.
    const bank = Array.from({ length: 30 }, (_, i): [number, number] => [900 + 40 * Math.sin(i / 10), 100 + i * 20])
    const facts = perceiveDrawing([stroke(1, bank)])
    expect(facts.get(1) ?? '').not.toMatch(/arc/)
  })

  it('says nothing about rectangles, whose type and box already describe them', () => {
    const rect = { ...stroke(1, [[0, 0], [100, 100]]) }
    rect.geometry = { ...rect.geometry, type: 'rectangle', path: undefined }
    expect(perceiveDrawing([rect]).size).toBe(0)
  })
})

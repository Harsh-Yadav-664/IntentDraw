import { describe, expect, it } from 'vitest'
import { bandPath, buildSceneShape, fitCircle, silhouettePath } from './scene'
import type { Region } from '@/types'

/** A freeform region from absolute points (stored relative to its box, like the canvas does). */
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

const numbers = (d: string) => (d.match(/-?\d+/g) ?? []).map(Number)

describe('fitCircle', () => {
  it("recovers the whole circle from an upper arc, not the arc's bounding box", () => {
    // Top half of a circle centred at (500, 400), r = 150 — a sun on the horizon.
    const arc = Array.from({ length: 20 }, (_, i) => {
      const a = Math.PI + (i / 19) * Math.PI
      return { x: 500 + 150 * Math.cos(a), y: 400 + 150 * Math.sin(a) }
    })
    const fit = fitCircle(arc)!
    expect(fit.cx).toBeCloseTo(500, 0)
    expect(fit.cy).toBeCloseTo(400, 0)
    expect(fit.r).toBeCloseTo(150, 0)
  })

  it('gives up on collinear points instead of returning nonsense', () => {
    expect(fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull()
  })
})

describe('silhouettePath', () => {
  const ridge = stroke(1, [[100, 600], [300, 200], [500, 600]])

  it('closes a ridge down to the ground so it fills as a solid mountain', () => {
    const d = silhouettePath(ridge, 700)
    expect(d.endsWith('Z')).toBe(true)
    const ys = numbers(d).filter((_, i) => i % 2 === 1)
    expect(ys[0]).toBe(700)
    expect(ys[ys.length - 1]).toBe(700)
  })

  it('does not let a foot spread across the page', () => {
    // A long gentle slope: extended all the way to the ground it would reach far left.
    const gentle = stroke(2, [[600, 460], [1000, 150], [1280, 470]])
    const xs = numbers(silhouettePath(gentle, 700)).filter((_, i) => i % 2 === 0)
    expect(xs[0]).toBeGreaterThan(400)
  })
})

describe('bandPath', () => {
  it('encloses the area between two banks drawn in opposite directions', () => {
    const left = stroke(5, [[400, 100], [380, 400], [350, 700]])
    const right = stroke(6, [[550, 700], [520, 400], [500, 100]]) // drawn bottom-up
    const d = bandPath(left, right)
    expect(d.endsWith('Z')).toBe(true)
    // Down the left bank, then back up the right: it must not cross itself.
    const ys = numbers(d).filter((_, i) => i % 2 === 1)
    expect(ys).toEqual([100, 400, 700, 700, 400, 100])
  })
})

describe('buildSceneShape', () => {
  it('degrades a one-edged band to a stroke rather than emitting a broken fill', () => {
    const only = stroke(1, [[0, 0], [100, 100]])
    const shape = buildSceneShape({ name: 'River', form: 'band', regionNumbers: [1] }, [only], 700)
    expect(shape?.paint).toBe('stroke')
  })

  it('keeps a zig-zag grouped with a sun as rays instead of fitting it to a second disc', () => {
    const arc = Array.from({ length: 20 }, (_, i): [number, number] => {
      const a = Math.PI + (i / 19) * Math.PI
      return [500 + 150 * Math.cos(a), 400 + 150 * Math.sin(a)]
    })
    const zigzag = Array.from({ length: 15 }, (_, i): [number, number] => {
      const a = Math.PI + (i / 14) * Math.PI
      const r = i % 2 === 0 ? 170 : 220
      return [500 + r * Math.cos(a), 400 + r * Math.sin(a)]
    })
    const shape = buildSceneShape(
      { name: 'Sun', form: 'disc', regionNumbers: [1, 2] },
      [stroke(1, arc), stroke(2, zigzag)],
      700
    )!
    expect(shape.svg.match(/<circle/g)).toHaveLength(1)
    expect(shape.svg).toContain('data-part="rays"')
  })

  it('returns null when the element names no existing region', () => {
    expect(buildSceneShape({ name: 'Ghost', form: 'disc', regionNumbers: [9] }, [], 700)).toBeNull()
  })
})

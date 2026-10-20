/**
 * A project's drawing, reduced to what a dashboard card needs to draw it.
 *
 * A project list where every card looks the same is the wrong list for a
 * drawing tool — the drawing *is* how you recognise the project. Only geometry
 * travels (no intent text, no generated code), in canvas units rounded to whole
 * numbers, and each stroke is thinned to a handful of points.
 */

export interface ThumbnailShape {
  type: 'rectangle' | 'circle' | 'freeform' | 'arrow'
  x: number
  y: number
  w: number
  h: number
  /** The region number, which picks its colour. */
  n: number
  /** Stroke and arrow points, absolute, in canvas units. */
  points?: Array<[number, number]>
}

export interface ProjectThumbnail {
  shapes: ThumbnailShape[]
  /** How many shapes the drawing has (the thumbnail may show fewer). */
  total: number
  /** The bottom of the lowest shape — how much of the canvas the drawing uses. */
  bottom: number
}

const MAX_SHAPES = 24
const MAX_POINTS = 16
const TYPES = new Set(['rectangle', 'circle', 'freeform', 'arrow'])

/** Every k-th point, always keeping the last, so a stroke stays recognisable in ≤ max points. */
function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)])
}

/**
 * Older projects stored a bare `Region[]` rather than `{ regions, groups }`, so
 * both shapes are accepted; anything malformed is skipped, never thrown.
 */
export function toThumbnail(canvasData: unknown): ProjectThumbnail | null {
  const regions = Array.isArray(canvasData) ? canvasData : (canvasData as { regions?: unknown[] } | null)?.regions
  if (!Array.isArray(regions) || regions.length === 0) return null

  const shapes: ThumbnailShape[] = []
  for (const [i, region] of regions.slice(0, MAX_SHAPES).entries()) {
    const r = region as { regionNumber?: unknown; geometry?: Record<string, unknown> } | null
    const g = r?.geometry
    if (!g || !TYPES.has(String(g.type))) continue
    const x = Number(g.x)
    const y = Number(g.y)
    const w = Number(g.width)
    const h = Number(g.height)
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue
    const shape: ThumbnailShape = {
      type: g.type as ThumbnailShape['type'],
      x: Math.round(x),
      y: Math.round(y),
      w: Math.max(1, Math.round(w)),
      h: Math.max(1, Math.round(h)),
      n: Number.isInteger(r?.regionNumber) ? (r!.regionNumber as number) : i + 1,
    }
    if ((shape.type === 'freeform' || shape.type === 'arrow') && Array.isArray(g.path)) {
      const pts = (g.path as Array<{ x?: unknown; y?: unknown }>)
        .map((p) => [Math.round(x + Number(p?.x)), Math.round(y + Number(p?.y))] as [number, number])
        .filter(([px, py]) => Number.isFinite(px) && Number.isFinite(py))
      if (pts.length >= 2) shape.points = thin(pts, MAX_POINTS)
    }
    shapes.push(shape)
  }
  if (shapes.length === 0) return null
  return { shapes, total: regions.length, bottom: Math.max(...shapes.map((s) => s.y + s.h)) }
}

import type { Region } from '@/types'

/**
 * Freeform strokes and arrows carry their actual drawn shape in `geometry.path`.
 * Everything downstream used to see only the bounding box, so a hand-drawn wave
 * and a straight line were indistinguishable to the model. These helpers turn a
 * stroke into an SVG path string the model can render verbatim — which also
 * makes the stroke usable as a motion path.
 */

export interface ShapePath {
  /** `d` attribute in the region's own box space, viewBox "0 0 100 100". */
  d: string
  pointCount: number
  /** True when the stroke ends near where it started (a blob rather than a line). */
  closed: boolean
  /** Compass direction from first to last point, e.g. "right", "down-left". */
  direction: string
  /** Rough shape read used to describe the stroke in prose. */
  character: 'straight' | 'curved' | 'wavy' | 'loop'
}

type Point = { x: number; y: number }

/** Perpendicular distance from p to the line through a-b. */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)
  const clamped = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + clamped * dx), p.y - (a.y + clamped * dy))
}

/** Ramer-Douglas-Peucker: drop points that don't change the stroke's shape. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points

  let maxDist = 0
  let index = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      index = i
    }
  }

  if (maxDist <= tolerance) return [first, last]

  const left = simplify(points.slice(0, index + 1), tolerance)
  const right = simplify(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

/**
 * Reduces to at most maxPoints by raising the tolerance until it fits.
 * `scale` converts the normalized tolerance into the points' own pixel units.
 */
export function simplifyToBudget(points: Point[], maxPoints: number, scale: number): Point[] {
  if (points.length <= maxPoints) return points
  const maxTolerance = 25 * scale
  let tolerance = 0.5 * scale
  let result = points
  while (result.length > maxPoints && tolerance < maxTolerance) {
    result = simplify(points, tolerance)
    tolerance *= 1.6
  }
  return result.length > maxPoints
    ? result.filter((_, i) => i % Math.ceil(result.length / maxPoints) === 0)
    : result
}

function compassDirection(from: Point, to: Point): string {
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  if (angle > -22.5 && angle <= 22.5) return 'right'
  if (angle > 22.5 && angle <= 67.5) return 'down-right'
  if (angle > 67.5 && angle <= 112.5) return 'down'
  if (angle > 112.5 && angle <= 157.5) return 'down-left'
  if (angle > 157.5 || angle <= -157.5) return 'left'
  if (angle > -157.5 && angle <= -112.5) return 'up-left'
  if (angle > -112.5 && angle <= -67.5) return 'up'
  return 'up-right'
}

/**
 * Counts direction reversals along the stroke to tell a gentle curve from a
 * multi-crest wave. Waves are the case that matters — they're what users draw
 * for "flowing background".
 */
function readCharacter(points: Point[], closed: boolean): ShapePath['character'] {
  if (closed) return 'loop'
  if (points.length <= 2) return 'straight'

  let reversals = 0
  let lastSign = 0
  for (let i = 1; i < points.length - 1; i++) {
    const cross =
      (points[i].x - points[i - 1].x) * (points[i + 1].y - points[i].y) -
      (points[i].y - points[i - 1].y) * (points[i + 1].x - points[i].x)
    const sign = Math.sign(cross)
    if (sign !== 0 && lastSign !== 0 && sign !== lastSign) reversals++
    if (sign !== 0) lastSign = sign
  }

  if (reversals >= 2) return 'wavy'
  if (reversals >= 1) return 'curved'

  // No reversals: still curved if it bows away from the straight chord.
  const bow = points.reduce(
    (max, p) => Math.max(max, perpendicularDistance(p, points[0], points[points.length - 1])),
    0
  )
  return bow > 6 ? 'curved' : 'straight'
}

/**
 * Converts a region's drawn stroke into an SVG path normalized to a
 * "0 0 100 100" viewBox, so it can be dropped into an absolutely-positioned
 * <svg> sized by the region's own bounding box (which callers already emit as
 * page percentages).
 *
 * Returns null for shapes with no stroke data — rectangles and circles are
 * fully described by their bounding box and type.
 */
export function buildShapePath(
  region: Region,
  maxPoints = 14,
  /** When set, the path is emitted in whole-page coordinates instead of the
   *  region's own box — used when several strokes share one page-wide <svg>. */
  pageSpace?: { canvasWidth: number; canvasHeight: number }
): ShapePath | null {
  const { path, width, height, x, y, type } = region.geometry
  if (!path || path.length < 2) return null
  if (type !== 'freeform' && type !== 'arrow') return null

  const extent = Math.max(width, height, 1)
  const simplified = simplifyToBudget(path, maxPoints, extent / 100)

  const first = simplified[0]
  const last = simplified[simplified.length - 1]
  const closed =
    simplified.length > 3 && Math.hypot(last.x - first.x, last.y - first.y) < extent * 0.12

  // The shape read is always taken in the region's own box space so it doesn't
  // change with the output space. A straight horizontal or vertical stroke has
  // a zero-size axis, so collapse that axis instead of dividing by zero.
  const local = simplified.map(p => ({
    x: width > 1 ? (p.x / width) * 100 : 50,
    y: height > 1 ? (p.y / height) * 100 : 50,
  }))

  const projected = pageSpace
    ? simplified.map(p => ({
        x: ((x + p.x) / pageSpace.canvasWidth) * 100,
        y: ((y + p.y) / pageSpace.canvasHeight) * 100,
      }))
    : local

  const round = (n: number) => Math.round(n * 10) / 10
  const d =
    `M ${round(projected[0].x)} ${round(projected[0].y)} ` +
    projected
      .slice(1)
      .map(p => `L ${round(p.x)} ${round(p.y)}`)
      .join(' ') +
    (closed ? ' Z' : '')

  return {
    d,
    pointCount: projected.length,
    closed,
    direction: compassDirection(local[0], local[local.length - 1]),
    character: readCharacter(local, closed),
  }
}

/**
 * Stroke detail costs tokens, and free-tier providers count them tightly. Busy
 * drawings get coarser paths so a 12-shape canvas still fits in one call.
 */
export function pointBudget(regions: Region[]): number {
  const strokes = regions.filter(r => (r.geometry.path?.length ?? 0) > 1).length
  if (strokes > 10) return 7
  if (strokes > 5) return 10
  return 14
}

/** One-line prose description of a stroke, for the layout instructions. */
export function describeShapePath(shape: ShapePath): string {
  if (shape.closed) return `a closed ${shape.character === 'loop' ? 'blob/loop' : shape.character} outline`
  return `a ${shape.character} stroke running ${shape.direction}`
}

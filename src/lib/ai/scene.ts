import type { Region } from '@/types'
import { simplifyToBudget } from './shape-path'

/**
 * Turns strokes the user drew as a *picture* into exact SVG geometry.
 *
 * When someone draws two ridges, an arc with marks around it and two wavy lines
 * running down the page, they drew mountains, a rising sun and a river. Handing
 * a model those strokes as outlines produced exactly that — outlines, usually as
 * neon lines — because turning a ridge into a solid mountain, or two banks into
 * a body of water, is geometry, and models are unreliable at geometry.
 *
 * So the geometry happens here, in code, and the model is only asked to *style*
 * shapes that are already correct:
 *   - silhouette: a ridge/skyline — the area under the line, closed to the ground
 *   - band:       the area between two strokes (river, road, path)
 *   - disc:       a round body, circle-fitted so an arc becomes the full circle
 *   - shape:      a closed outline, filled
 *   - rays/line:  kept as strokes
 *
 * Coordinates stay in canvas pixels. The canvas is 1280 wide — the same logical
 * width as the preview — so a scene drawn in the top third lands in the top
 * third of the rendered page.
 */

export type SceneForm = 'silhouette' | 'band' | 'disc' | 'rays' | 'shape' | 'line' | 'sphere'

export const SCENE_FORMS: readonly SceneForm[] = ['silhouette', 'band', 'disc', 'rays', 'shape', 'line', 'sphere']

export const CANVAS_WIDTH = 1280

interface Point {
  x: number
  y: number
}

export interface SceneShape {
  /** Ready-to-paste SVG element with exact geometry, attributes left for styling. */
  svg: string
  /** How the model should treat it — fill vs stroke. */
  paint: 'fill' | 'stroke'
}

/** A region's drawn points in absolute canvas pixels. */
export function absolutePoints(region: Region): Point[] {
  const { path, x, y, width, height, type } = region.geometry

  if (path && path.length >= 2) {
    return path.map(p => ({ x: x + p.x, y: y + p.y }))
  }

  // Rectangles and circles have no stroke; their outline is their box.
  if (type === 'circle') {
    const cx = x + width / 2
    const cy = y + height / 2
    return Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2
      return { x: cx + (width / 2) * Math.cos(a), y: cy + (height / 2) * Math.sin(a) }
    })
  }
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

const r0 = (n: number) => Math.round(n)

function toPathData(points: Point[], close = false): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M${r0(first.x)} ${r0(first.y)}` + rest.map(p => ` L${r0(p.x)} ${r0(p.y)}`).join('') + (close ? ' Z' : '')
}

function simplified(region: Region, maxPoints: number): Point[] {
  const points = absolutePoints(region)
  const extent = Math.max(region.geometry.width, region.geometry.height, 1)
  return simplifyToBudget(points, maxPoints, extent / 100)
}

/**
 * Continues a stroke's end down to the ground along its own slope, so a ridge
 * that stops mid-air still reads as the foot of a mountain rather than ending
 * in a vertical cliff. Falls back to a straight drop when the stroke doesn't
 * head downward at that end.
 */
function extendToGround(end: Point, inward: Point, groundY: number, maxReach: number): Point {
  const dy = end.y - inward.y
  const dx = end.x - inward.x
  if (dy <= 0.5) return { x: end.x, y: groundY }
  const t = (groundY - end.y) / dy
  // A gentle slope extended all the way down can cross the whole page — the
  // right-hand mountain of a two-peak drawing ended up swallowing the left one.
  // A foot spreads a little; it doesn't become a new mountain.
  const reach = Math.max(-maxReach, Math.min(maxReach, dx * t))
  const x = Math.max(0, Math.min(CANVAS_WIDTH, end.x + reach))
  return { x, y: groundY }
}

/** The area under a ridge line, closed to the ground. */
export function silhouettePath(region: Region, groundY: number, maxPoints = 18): string {
  const points = simplified(region, maxPoints)
  if (points.length < 2) return ''

  // Draw left to right so the closing edge is always along the bottom.
  const ordered = points[0].x <= points[points.length - 1].x ? points : [...points].reverse()
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  // Slope sampled a little way in, not from the last two points, so a hand
  // wobble at the very tip doesn't send the foot off at a wild angle.
  const reach = Math.max(1, Math.floor(ordered.length * 0.2))
  const maxReach = Math.max(20, (last.x - first.x) * 0.2)
  const leftFoot = extendToGround(first, ordered[Math.min(reach, ordered.length - 1)], groundY, maxReach)
  const rightFoot = extendToGround(last, ordered[Math.max(ordered.length - 1 - reach, 0)], groundY, maxReach)

  return toPathData([leftFoot, ...ordered, rightFoot], true)
}

/**
 * The area between two strokes. Both edges are walked in the same direction,
 * so the second one is reversed to close the outline without the edges crossing.
 */
export function bandPath(a: Region, b: Region, maxPoints = 16): string {
  const edgeA = simplified(a, maxPoints)
  const edgeB = simplified(b, maxPoints)
  if (edgeA.length < 2 || edgeB.length < 2) return ''

  const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y)
  const aligned =
    dist(edgeA[0], edgeB[0]) + dist(edgeA[edgeA.length - 1], edgeB[edgeB.length - 1]) <=
    dist(edgeA[0], edgeB[edgeB.length - 1]) + dist(edgeA[edgeA.length - 1], edgeB[0])
  const sameWay = aligned ? edgeB : [...edgeB].reverse()

  return toPathData([...edgeA, ...[...sameWay].reverse()], true)
}

/**
 * Least-squares circle through the points (Kåsa fit). An arc drawn over a
 * horizon is a *partial* circle — the sun is rising — and the bounding box of
 * that arc puts the centre in the wrong place. The fit recovers the whole disc,
 * which then sits behind whatever is drawn in front of it.
 */
export function fitCircle(points: Point[]): { cx: number; cy: number; r: number } | null {
  const n = points.length
  if (n < 3) return null

  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0
  for (const { x, y } of points) {
    const z = x * x + y * y
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y
    sxz += x * z; syz += y * z; sz += z
  }

  // Solve [sxx sxy sx; sxy syy sy; sx sy n] · [A B C]ᵀ = [sxz syz sz]ᵀ
  const m = [
    [sxx, sxy, sx, sxz],
    [sxy, syy, sy, syz],
    [sx, sy, n, sz],
  ]
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) < 1e-9) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let row = 0; row < 3; row++) {
      if (row === col) continue
      const factor = m[row][col] / m[col][col]
      for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k]
    }
  }
  const A = m[0][3] / m[0][0]
  const B = m[1][3] / m[1][1]
  const C = m[2][3] / m[2][2]

  const cx = A / 2
  const cy = B / 2
  const r = Math.sqrt(C + cx * cx + cy * cy)
  if (!Number.isFinite(r) || r <= 0) return null
  return { cx, cy, r }
}

/**
 * Upward spikes: local minima of y (screen-up) that stand out from both
 * neighbouring valleys by a meaningful margin. Wobble below the threshold is
 * hand tremor, not a spike.
 */
export function countPeaks(points: Point[], minProminence: number): number {
  // Collapse to alternating turning points first.
  const turns: Point[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].y
    const cur = points[i].y
    const next = points[i + 1].y
    if ((cur < prev && cur <= next) || (cur > prev && cur >= next)) turns.push(points[i])
  }
  turns.push(points[points.length - 1])

  let peaks = 0
  for (let i = 1; i < turns.length - 1; i++) {
    const cur = turns[i].y
    const left = turns[i - 1].y
    const right = turns[i + 1].y
    if (cur < left && cur < right && Math.min(left - cur, right - cur) >= minProminence) peaks++
  }
  return peaks
}

/**
 * True when a stroke sits close to one circle — an arc or ring, not a zig-zag.
 * A zig-zag of rays drawn around a sun also hugs a circle, loosely enough to
 * pass a residual test on its own, and became a second, blank disc; so a round
 * stroke must also be free of spikes.
 */
export function isRound(region: Region): boolean {
  const points = absolutePoints(region)
  const fit = fitCircle(points)
  if (!fit) return false
  const residual =
    points.reduce((sum, p) => sum + Math.abs(Math.hypot(p.x - fit.cx, p.y - fit.cy) - fit.r), 0) / points.length / fit.r
  if (residual >= 0.09) return false
  // Spikes stand out radially, so measure them as distance from the centre.
  const radial = points.map(p => ({ x: 0, y: -Math.hypot(p.x - fit.cx, p.y - fit.cy) }))
  return countPeaks(radial, Math.max(8, fit.r * 0.08)) < 3
}

/** A round body. Drawn circles use their box; strokes are circle-fitted. */
export function discShape(region: Region): string {
  const g = region.geometry
  const boxDisc = { cx: g.x + g.width / 2, cy: g.y + g.height / 2, r: Math.max(g.width, g.height) / 2 }

  if (g.type === 'circle' || !g.path || g.path.length < 3) {
    return `<circle cx="${r0(boxDisc.cx)}" cy="${r0(boxDisc.cy)}" r="${r0(boxDisc.r)}" />`
  }

  const fit = fitCircle(absolutePoints(region))
  // A near-straight stroke fits a huge circle far away — that's not a disc the
  // user drew, so the box is the better read.
  const plausible = fit && fit.r < Math.max(g.width, g.height) * 1.5 && fit.r > 4
  const disc = plausible ? fit : boxDisc
  return `<circle cx="${r0(disc.cx)}" cy="${r0(disc.cy)}" r="${r0(disc.r)}" />`
}

export interface SceneElementInput {
  name: string
  form: SceneForm
  regionNumbers: number[]
}

/**
 * Exact geometry for one depicted element. Returns null when the element's
 * regions can't produce its form (e.g. a band with only one edge), so the
 * caller can fall back to plain strokes rather than emit a broken shape.
 */
export function buildSceneShape(
  element: SceneElementInput,
  regions: Region[],
  groundY: number
): SceneShape | null {
  const members = element.regionNumbers
    .map(n => regions.find(r => r.regionNumber === n))
    .filter((r): r is Region => !!r)
  if (members.length === 0) return null

  switch (element.form) {
    case 'silhouette': {
      const d = members.map(m => silhouettePath(m, groundY)).filter(Boolean)
      if (d.length === 0) return null
      return { svg: d.map(path => `<path d="${path}" />`).join(' '), paint: 'fill' }
    }
    case 'band': {
      if (members.length >= 2) {
        const d = bandPath(members[0], members[1])
        if (d) return { svg: `<path d="${d}" />`, paint: 'fill' }
      }
      // One edge only: it can't enclose anything, so keep it a stroke.
      const d = toPathData(simplified(members[0], 18))
      return d ? { svg: `<path d="${d}" />`, paint: 'stroke' } : null
    }
    case 'disc': {
      // A sun is often drawn as an arc plus a zig-zag of rays around it, and the
      // understanding pass rightly groups them as one element. Circle-fitting the
      // zig-zag too would turn the rays into a second, blank disc — so only the
      // member that really is round becomes the disc; the rest stay strokes.
      const round = members.filter(m => m.geometry.type === 'circle' || isRound(m))
      const discs = (round.length > 0 ? round : [members[0]]).map(discShape)
      const rays = members
        .filter(m => !(round.length > 0 ? round : [members[0]]).includes(m))
        .map(m => toPathData(simplified(m, 28)))
        .filter(Boolean)
        .map(d => `<path data-part="rays" d="${d}" />`)
      return { svg: [...discs, ...rays].join(' '), paint: 'fill' }
    }
    case 'shape': {
      const d = members.map(m => toPathData(simplified(m, 20), true)).filter(Boolean)
      return d.length ? { svg: d.map(path => `<path d="${path}" />`).join(' '), paint: 'fill' } : null
    }
    case 'rays':
    case 'line': {
      // Zig-zags and details need more points than a smooth ridge to survive.
      const budget = element.form === 'rays' ? 28 : 18
      const d = members.map(m => toPathData(simplified(m, budget))).filter(Boolean)
      return d.length ? { svg: d.map(path => `<path d="${path}" />`).join(' '), paint: 'stroke' } : null
    }
    case 'sphere': {
      // Rendered as a live 3D component (scene-render.ts); as a static shape it
      // is its body's disc.
      const geo = sphereGeometry(element.regionNumbers, regions)
      return geo ? { svg: `<circle cx="${r0(geo.cx)}" cy="${r0(geo.cy)}" r="${r0(geo.r)}" />`, paint: 'fill' } : null
    }
  }
}

/** A point on the unit sphere: x right, y down, z toward the viewer. */
export type SpherePoint = [number, number, number]

export interface SphereGeometry {
  cx: number
  cy: number
  r: number
  /** Each drawn mark, as points on the sphere's front face. */
  strokes: SpherePoint[][]
  /** Where marks start and end — the knots of a drawn network. */
  nodes: SpherePoint[]
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Adds points so no two neighbours are more than `step` apart — curves stay curved once wrapped round a sphere. */
function densify(points: Point[], step: number): Point[] {
  const out: Point[] = []
  points.forEach((p, i) => {
    if (i > 0) {
      const prev = points[i - 1]
      const n = Math.floor(Math.hypot(p.x - prev.x, p.y - prev.y) / step)
      for (let k = 1; k < n; k++) out.push({ x: prev.x + ((p.x - prev.x) * k) / n, y: prev.y + ((p.y - prev.y) * k) / n })
    }
    out.push(p)
  })
  return out
}

/**
 * A round body plus the marks drawn on it, mapped onto a 3D sphere.
 *
 * The body is the drawn circle (or the roundest member, or failing both the
 * group's bounds). Every other member is a mark: each of its points is lifted
 * onto the sphere's front face by inverse orthographic projection
 * (z = √(1 − u² − v²)), so at rest the sphere shows exactly what was drawn,
 * and as it turns the marks travel round it as if drawn on a globe.
 */
export function sphereGeometry(regionNumbers: number[], regions: Region[]): SphereGeometry | null {
  const members = regionNumbers
    .map(n => regions.find(r => r.regionNumber === n))
    .filter((r): r is Region => !!r)
  if (members.length === 0) return null

  const body = members.find(m => m.geometry.type === 'circle') ?? members.find(m => isRound(m))
  let cx: number
  let cy: number
  let r: number
  if (body?.geometry.type === 'circle') {
    const g = body.geometry
    cx = g.x + g.width / 2
    cy = g.y + g.height / 2
    r = (g.width + g.height) / 4
  } else {
    const fit = body ? fitCircle(absolutePoints(body)) : null
    if (fit) {
      ;({ cx, cy, r } = fit)
    } else {
      const xs = members.flatMap(m => [m.geometry.x, m.geometry.x + m.geometry.width])
      const ys = members.flatMap(m => [m.geometry.y, m.geometry.y + m.geometry.height])
      cx = (Math.min(...xs) + Math.max(...xs)) / 2
      cy = (Math.min(...ys) + Math.max(...ys)) / 2
      r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2
    }
  }
  if (!(r > 4)) return null

  const lift = (p: Point): SpherePoint => {
    let u = (p.x - cx) / r
    let v = (p.y - cy) / r
    const d = Math.hypot(u, v)
    // Marks drawn past the rim are pulled onto it rather than dropped.
    if (d > 0.97) {
      u *= 0.97 / d
      v *= 0.97 / d
    }
    return [round3(u), round3(v), round3(Math.sqrt(Math.max(0, 1 - u * u - v * v)))]
  }

  const strokes = members
    .filter(m => m !== body)
    .map(m => densify(simplified(m, 40), Math.max(4, r / 14)).map(lift))
    .filter(s => s.length >= 2)

  const nodes: SpherePoint[] = []
  for (const s of strokes) {
    for (const end of [s[0], s[s.length - 1]]) {
      if (!nodes.some(n => Math.hypot(n[0] - end[0], n[1] - end[1]) < 0.08)) nodes.push(end)
    }
  }
  return { cx: r0(cx), cy: r0(cy), r: r0(r), strokes, nodes }
}

/** The lowest point any scene member reaches — where the scene meets the ground. */
export function sceneGround(regions: Region[]): number {
  if (regions.length === 0) return 800
  const bottom = Math.max(...regions.map(r => r.geometry.y + r.geometry.height))
  return Math.max(200, Math.ceil(bottom))
}

import type { Region } from '@/types'
import { absolutePoints, countPeaks, fitCircle } from './scene'
import { simplifyToBudget } from './shape-path'

/**
 * Measured facts about a drawing, computed in code, for the understanding pass.
 *
 * Reading a rough sketch by eye is noisy. On the same drawing, two runs of the
 * same vision model read a zig-zag around a sun first as a mountain range and
 * then — after the prompt was sharpened — lumped a real mountain in with the
 * rays. Text-only providers can't see the drawing at all. What every one of
 * them CAN use reliably is a stated fact: "rises to one peak and falls",
 * "zig-zag with 9 spikes", "runs parallel to R6", "wraps around R3's circle".
 *
 * Each fact here is deliberately conservative — it is only stated when the
 * geometry clearly supports it, because a wrong measured fact would be trusted
 * over a correct visual read.
 */

interface Point {
  x: number
  y: number
}

interface Stroke {
  region: Region
  points: Point[]
  closed: boolean
  width: number
  height: number
  length: number
}

function toStroke(region: Region): Stroke | null {
  const g = region.geometry
  if (!g.path || g.path.length < 3 || (g.type !== 'freeform' && g.type !== 'arrow')) return null
  const extent = Math.max(g.width, g.height, 1)
  const points = simplifyToBudget(absolutePoints(region), 48, extent / 200)
  const first = points[0]
  const last = points[points.length - 1]
  let length = 0
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return {
    region,
    points,
    closed: points.length > 3 && Math.hypot(last.x - first.x, last.y - first.y) < extent * 0.15,
    width: g.width,
    height: g.height,
    length,
  }
}

function isRidge(s: Stroke): { peakX: number } | null {
  const { points } = s
  let minIdx = 0
  points.forEach((p, i) => { if (p.y < points[minIdx].y) minIdx = i })
  const edge = Math.max(1, Math.floor(points.length * 0.1))
  if (minIdx < edge || minIdx > points.length - 1 - edge) return null
  const peakY = points[minIdx].y
  const drop = s.height * 0.35
  // Both ends well below the summit, and wider than a spike.
  if (points[0].y - peakY < drop || points[points.length - 1].y - peakY < drop) return null
  if (s.width < s.height * 0.6) return null
  return { peakX: points[minIdx].x }
}

interface Arc {
  cx: number
  cy: number
  r: number
  spanDegrees: number
}

function asArc(s: Stroke): Arc | null {
  const fit = fitCircle(s.points)
  if (!fit || fit.r > Math.max(s.width, s.height) * 1.5) return null
  const residual =
    s.points.reduce((sum, p) => sum + Math.abs(Math.hypot(p.x - fit.cx, p.y - fit.cy) - fit.r), 0) /
    s.points.length /
    fit.r
  if (residual > 0.09) return null

  const angles = s.points.map(p => Math.atan2(p.y - fit.cy, p.x - fit.cx))
  let span = 0
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1]
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    span += d
  }
  const spanDegrees = Math.min(360, Math.abs((span * 180) / Math.PI))
  // A gently curving line fits a big circle over a short span — a river bank
  // read as a 90° "arc". A drawn sun or moon spans well over a third of a turn.
  return spanDegrees >= 120 ? { ...fit, spanDegrees } : null
}

function nearestDistance(p: Point, points: Point[]): number {
  let best = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)))
  }
  return best
}

/**
 * Two open strokes running the same general way side by side — the two edges of
 * one band (river, road, path). The gap may widen: a river drawn in perspective
 * spreads toward the viewer, so a strict constant-gap test misses exactly the
 * pair that matters. What rules a pair out is crossing, drifting far apart, or
 * heading different ways.
 */
function bandPartner(a: Stroke, b: Stroke): { mean: number; widening: boolean } | null {
  if (a.closed || b.closed) return null
  const chord = (s: Stroke) => {
    const f = s.points[0]
    const l = s.points[s.points.length - 1]
    return { x: l.x - f.x, y: l.y - f.y }
  }
  const ca = chord(a)
  const cb = chord(b)
  const la = Math.hypot(ca.x, ca.y)
  const lb = Math.hypot(cb.x, cb.y)
  if (la < 60 || lb < 60 || Math.max(la, lb) / Math.min(la, lb) > 1.6) return null
  // Undirected: a bank may be drawn top-down or bottom-up.
  const cos = Math.abs((ca.x * cb.x + ca.y * cb.y) / (la * lb))
  if (cos < Math.cos((45 * Math.PI) / 180)) return null

  const gaps = a.points.map(p => nearestDistance(p, b.points))
  const inner = gaps.slice(Math.floor(gaps.length * 0.1), Math.ceil(gaps.length * 0.9))
  if (inner.length === 0 || Math.min(...inner) < 4) return null // they cross
  const mean = gaps.reduce((x, y) => x + y, 0) / gaps.length
  if (mean > Math.min(la, lb) * 0.35) return null // too far apart to be one thing
  for (let i = 1; i < gaps.length; i++) {
    if (Math.abs(gaps[i] - gaps[i - 1]) > la * 0.25) return null // jumps — not side by side
  }
  const widening = Math.max(gaps[0], gaps[gaps.length - 1]) > 2 * Math.max(4, Math.min(gaps[0], gaps[gaps.length - 1]))
  return { mean, widening }
}

/** A stroke circling another stroke's arc at a slightly larger radius — rays or a halo. */
function wrapsAround(s: Stroke, arc: Arc): boolean {
  const dists = s.points.map(p => Math.hypot(p.x - arc.cx, p.y - arc.cy))
  const mean = dists.reduce((x, y) => x + y, 0) / dists.length
  if (mean < arc.r * 0.95 || mean > arc.r * 1.8) return false
  const angles = s.points.map(p => Math.atan2(p.y - arc.cy, p.x - arc.cx))
  const spread = (Math.max(...angles) - Math.min(...angles)) * (180 / Math.PI)
  return spread >= 70
}

/**
 * One line of measured facts per stroke, keyed by region number. Shapes with no
 * stroke (rectangles, circles) get nothing — their type and box already say it.
 */
/**
 * A single stroke that is probably a written word: dense, wide, many up-down
 * reversals (letters) with some backward travel (loops in a, e, o), and far
 * longer than it is wide. Measured on a real cursive "Name": 124 points, 17
 * vertical and 2 horizontal reversals, length 3.8× its width, 2.8:1 aspect.
 * Before this, the same stroke was reported as "zig-zag with 8 spikes" — a
 * fact that pushed models toward reading it as rays or a mountain range.
 */
export function looksHandwritten(region: Region): boolean {
  const g = region.geometry
  if (g.type !== 'freeform' || !g.path || g.path.length < 60) return false
  const points = absolutePoints(region)
  let xRev = 0
  let yRev = 0
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    if (i < 2) continue
    const dx1 = points[i - 1].x - points[i - 2].x
    const dx2 = points[i].x - points[i - 1].x
    const dy1 = points[i - 1].y - points[i - 2].y
    const dy2 = points[i].y - points[i - 1].y
    if (dx1 * dx2 < 0 && Math.abs(dx2) > 1) xRev++
    if (dy1 * dy2 < 0 && Math.abs(dy2) > 1) yRev++
  }
  const aspect = g.width / Math.max(1, g.height)
  return yRev >= 10 && xRev >= 1 && length >= g.width * 3 && aspect >= 1.4 && aspect <= 10 && g.height <= 220
}

/** Share of a region's points inside another (closed) region's outline, ellipse or box. */
function insideShare(inner: Region, outer: Region): number {
  const o = outer.geometry
  const points = absolutePoints(inner)
  if (points.length === 0) return 0
  const cx = o.x + o.width / 2
  const cy = o.y + o.height / 2
  const inside = points.filter(p =>
    o.type === 'circle'
      ? ((p.x - cx) / (o.width / 2)) ** 2 + ((p.y - cy) / (o.height / 2)) ** 2 <= 1.1
      : p.x >= o.x - 4 && p.x <= o.x + o.width + 4 && p.y >= o.y - 4 && p.y <= o.y + o.height + 4
  )
  return inside.length / points.length
}

export function perceiveDrawing(regions: Region[]): Map<number, string> {
  const strokes = regions.map(toStroke).filter((s): s is Stroke => !!s)
  const arcs = new Map<number, Arc>()
  strokes.forEach(s => {
    const arc = asArc(s)
    if (arc) arcs.set(s.region.regionNumber, arc)
  })

  const facts = new Map<number, string[]>()
  const add = (n: number, fact: string) => facts.set(n, [...(facts.get(n) ?? []), fact])

  // Things drawn inside a circle or box: a globe's markings, a card's contents.
  // Stated on both sides, because "R1 and everything inside it" is exactly how
  // people describe what they drew.
  const containers = regions.filter(r => r.geometry.type === 'circle' || r.geometry.type === 'rectangle')
  for (const outer of containers) {
    const inside = regions.filter(
      inner =>
        inner !== outer &&
        inner.geometry.width * inner.geometry.height < outer.geometry.width * outer.geometry.height &&
        insideShare(inner, outer) >= 0.85
    )
    if (inside.length === 0) continue
    add(outer.regionNumber, `contains ${inside.map(r => `R${r.regionNumber}`).join(', ')} — drawn inside it`)
    inside.forEach(r => add(r.regionNumber, `drawn inside R${outer.regionNumber}`))
  }

  const handwritten = new Set(regions.filter(looksHandwritten).map(r => r.regionNumber))
  for (const n of handwritten) {
    add(n, 'probably HANDWRITTEN TEXT (a word or short label, not a shape) — read the word from the image; it is text the user wants on the site at this spot, or the label of what goes here')
  }

  for (const s of strokes) {
    const n = s.region.regionNumber
    // Its letters would read as spikes, peaks or arcs — all wrong.
    if (handwritten.has(n)) continue
    const arc = arcs.get(n)
    if (s.closed) add(n, 'closed outline')
    if (arc) {
      add(n, `circular arc (centre ~${Math.round(arc.cx)},${Math.round(arc.cy)}, radius ~${Math.round(arc.r)}, spanning ~${Math.round(arc.spanDegrees / 10) * 10}°)`)
      continue
    }

    const spikes = countPeaks(s.points, Math.max(12, s.height * 0.08))
    const ridge = isRidge(s)
    if (spikes >= 4) add(n, `zig-zag with ${spikes} spikes`)
    else if (ridge && spikes <= 2) add(n, `rises to ${spikes === 2 ? 'two peaks' : 'a single peak'} and falls on both sides — ridge-like`)
    else if (s.width > s.height * 2.5) add(n, 'long and mostly horizontal')
    else if (s.height > s.width * 2.5) add(n, 'long and mostly vertical')

    for (const [other, otherArc] of arcs) {
      if (other !== n && wrapsAround(s, otherArc)) add(n, `wraps around R${other}'s arc just outside it`)
    }
  }

  for (let i = 0; i < strokes.length; i++) {
    for (let j = i + 1; j < strokes.length; j++) {
      const a = strokes[i].region.regionNumber
      const b = strokes[j].region.regionNumber
      // An arc and the stroke wrapped around it are already described as such,
      // and two ridges are two silhouettes, never the edges of one band.
      if (arcs.has(a) || arcs.has(b) || handwritten.has(a) || handwritten.has(b)) continue
      if (isRidge(strokes[i]) && isRidge(strokes[j])) continue
      const pair = bandPartner(strokes[i], strokes[j])
      if (!pair) continue
      const how = `runs alongside R%s (gap ~${Math.round(pair.mean)}px${pair.widening ? ', widening' : ''}) — the two could be the edges of one band`
      add(a, how.replace('%s', String(b)))
      add(b, how.replace('%s', String(a)))
    }
  }

  return new Map([...facts].map(([n, list]) => [n, list.join('; ')]))
}

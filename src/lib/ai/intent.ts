import type { IntentAnchor, IntentKind, Region, RegionTag } from '@/types'
import { PAGE_CONFIG, pageIndexForRegion } from '@/lib/canvas/pages'
import { insideShare, looksHandwritten } from './perception'

/**
 * The drawing intent engine's evidence layer: what each shape IS, WHERE it
 * goes and HOW it behaves — worked out in code, before and after the model.
 *
 * Users shouldn't need a ten-line prompt for the tool to understand a drawing
 * (owner, 2026-10-02). A real run had the right reading in the brief — "R1 is a
 * 3D interactive cube" — and still built the cube two sections away, because
 * nothing downstream knew what "a 3D object exactly here" meant. So intent is
 * decided from several layers of evidence, strongest first:
 *
 *   1. the user's one-click tags on a shape                 (final)
 *   2. the prompt, parsed in code ("region 1 … 3d cube")     (enforced)
 *   3. the model's reading of the image                      (understand.ts)
 *   4. geometry priors (size, position, repetition, …)       (hints)
 *
 * Layers 1–2 are enforced on the brief by `reconcile` in brief.ts; layer 4 is
 * shown to the model as a hint it may overrule with the image.
 */

export type { IntentKind, RegionTag }
export type Anchor = IntentAnchor
export type ObjectForm = 'cube' | 'sphere'

export const INTENT_KINDS: readonly IntentKind[] = ['content', 'text', 'picture', 'object', 'background', 'decoration', 'motion', 'connector']
export const ANCHORS: readonly Anchor[] = ['exact', 'anywhere', 'behind']

export interface IntentSignal {
  regions: number[]
  kind?: IntentKind
  anchor?: Anchor
  object?: ObjectForm
  interactive?: boolean
  animated?: boolean
  source: 'tag' | 'prompt' | 'geometry'
  /** Tags are 1, explicit prompt references 0.9, geometry priors ≤ 0.6. */
  confidence: number
  why: string
}

export const KIND_LABEL: Record<IntentKind, string> = {
  content: 'content',
  text: 'text',
  picture: 'picture',
  object: '3D object',
  background: 'background',
  decoration: 'decoration',
  motion: 'motion path',
  connector: 'arrow',
}

export const ANCHOR_LABEL: Record<Anchor, string> = {
  exact: 'exactly where drawn',
  anywhere: 'anywhere in its part of the page',
  behind: 'behind the content',
}

// =============================================================================
// Layer 1 — the user's tags
// =============================================================================

export function tagSignals(regions: Region[]): IntentSignal[] {
  return regions
    .filter(r => r.tag && (r.tag.kind || r.tag.anchor))
    .map(r => ({
      regions: [r.regionNumber],
      kind: r.tag!.kind,
      anchor: r.tag!.anchor ?? (r.tag!.kind === 'background' ? 'behind' : undefined),
      object: r.tag!.kind === 'object' ? (r.geometry.type === 'circle' ? 'sphere' : 'cube') : undefined,
      source: 'tag' as const,
      confidence: 1,
      why: `the user tagged it${r.tag!.kind ? ` "${KIND_LABEL[r.tag!.kind]}"` : ''}${r.tag!.anchor ? `, "${ANCHOR_LABEL[r.tag!.anchor]}"` : ''}`,
    }))
}

// =============================================================================
// Layer 2 — the prompt, parsed
// =============================================================================

// "r11", "region 1", "regions 2-4", "R3 and R5", "region 1,2 & 3"
const REFERENCE = /\b(?:r|region|regions|shape|shapes)\s*#?\s*(\d{1,2})((?:\s*(?:,|and|&|to|-|–|through)\s*(?:r|region)?\s*#?\s*\d{1,2}\b)*)/gi

const WORDS = {
  object: /\b3d\b|three[- ]?d(?:imensional)?|\bcube\b|\bsphere\b|\bglobe\b|\bball\b|\bplanet\b|\borb\b|\bobject\b|\bmodel\b|\brotating\b|\bspinning\b/,
  cube: /\bcube\b|\bdice\b|\bblock\b/,
  sphere: /\bsphere\b|\bglobe\b|\bball\b|\bplanet\b|\borb\b/,
  background: /\bbackground\b|\bbehind\b|\bbackdrop\b|\bwallpaper\b|\bbg\b/,
  motion: /\bpath\b|\btravel|\bmoves? along\b|\bfollow(?:s|ing)? the line\b/,
  decoration: /\bdecorat|\bornament|\bswoosh|\bflourish/,
  content: /\bshow|\bdisplay|\blist\b|\btext\b|\bheading|\btitle\b|\bname\b|\bcards?\b|\bgrid\b|\bform\b|\bnav|\bmenu\b|\bfooter\b|\bgallery\b|\btestimonial|\bpoints?\b|\bwordings?\b|\bstats?\b|\bsection\b|\bbutton|\bcta\b|\blogo\b|\bprojects?\b|\bpricing\b/,
  picture: /\bdrawing\b|\bpicture\b|\billustrat|\bscene\b|\blandscape\b|\bmountains?\b|\bsun\b|\briver\b|\btrees?\b|\bsky\b/,
  animated: /\banimat|\bmoving\b|\bmotion\b|\brotat|\bspin|\bfloat|\bpulse|\bglow/,
  interactive: /\binteractive\b|\bclick|\bhover|\bdrag|\bmouse\b|\bcursor\b|\btouch\b|\bscroll|\breacts?\b/,
  anywhere: /\banywhere\b|\bsomewhere\b|\bwherever\b/,
  inside: /\b(?:all|every|everything|regions?|shapes?)\b[^.]{0,30}\b(?:inside|within|in)\s+(?:it|that|this|them)\b/,
}

function expand(first: string, rest: string): number[] {
  const out = [Number(first)]
  const parts = rest.match(/(,|and|&|to|-|–|through)\s*(?:r|region)?\s*#?\s*(\d{1,2})/gi) ?? []
  for (const part of parts) {
    const m = part.match(/(,|and|&|to|-|–|through)\s*(?:r|region)?\s*#?\s*(\d{1,2})/i)!
    const n = Number(m[2])
    if (/to|-|–|through/i.test(m[1]) && n > out[out.length - 1] && n - out[out.length - 1] <= 30) {
      for (let k = out[out.length - 1] + 1; k <= n; k++) out.push(k)
    } else out.push(n)
  }
  return out
}

/**
 * Every place the prompt talks about a shape by number, with what it says
 * about it. Only what is said in the clause attached to the reference counts —
 * "make R1 a 3d cube and show my projects" doesn't make R1 a project list.
 */
export function promptSignals(prompt: string, regions: Region[]): IntentSignal[] {
  const known = new Set(regions.map(r => r.regionNumber))
  const matches = [...prompt.matchAll(REFERENCE)]
  const signals: IntentSignal[] = []

  matches.forEach((m, i) => {
    let numbers = expand(m[1], m[2] ?? '').filter(n => known.has(n))
    if (numbers.length === 0) return
    const start = m.index ?? 0
    const nextRef = matches[i + 1]?.index ?? prompt.length
    const stop = prompt.slice(start).search(/[.!?\n]/)
    const end = Math.min(nextRef, stop === -1 ? prompt.length : start + stop, start + 220)
    // A few words before the reference too: "a 3d cube in region 4".
    const clause = prompt.slice(Math.max(0, start - 40), end).toLowerCase()
    const own = prompt.slice(start, end).toLowerCase()

    // "region 1 and all regions inside it" → everything drawn inside R1 too.
    if (WORDS.inside.test(own)) {
      const outer = regions.filter(r => numbers.includes(r.regionNumber))
      const inner = regions.filter(r => !numbers.includes(r.regionNumber) && outer.some(o => insideShare(r, o) >= 0.85))
      numbers = [...numbers, ...inner.map(r => r.regionNumber)]
    }

    const has = (k: keyof typeof WORDS) => WORDS[k].test(own) || (k === 'object' && WORDS.object.test(clause))
    let kind: IntentKind | undefined
    if (has('object')) kind = 'object'
    else if (has('background')) kind = 'background'
    else if (has('motion')) kind = 'motion'
    else if (has('decoration')) kind = 'decoration'
    else if (has('content')) kind = 'content'
    else if (has('picture')) kind = 'picture'

    let object: ObjectForm | undefined
    if (kind === 'object') {
      if (WORDS.cube.test(clause)) object = 'cube'
      else if (WORDS.sphere.test(clause)) object = 'sphere'
      else {
        const main = regions.find(r => r.regionNumber === numbers[0])
        object = main?.geometry.type === 'circle' ? 'sphere' : main?.geometry.type === 'rectangle' ? 'cube' : undefined
      }
    }

    signals.push({
      regions: [...new Set(numbers)],
      kind,
      anchor: WORDS.anywhere.test(own) ? 'anywhere' : kind === 'background' ? 'behind' : 'exact',
      object,
      interactive: WORDS.interactive.test(own) || undefined,
      animated: WORDS.animated.test(own) || undefined,
      source: 'prompt',
      confidence: kind ? 0.9 : 0.6,
      why: `the prompt says: "${prompt.slice(start, end).trim().slice(0, 140)}"`,
    })
  })
  return signals
}

// =============================================================================
// Layer 4 — geometry priors
// =============================================================================

/**
 * What a shape most likely is from its size, position and neighbours alone.
 * Deliberately modest: shown to the model as a hint, never enforced.
 */
export function geometrySignals(regions: Region[]): IntentSignal[] {
  const { pageWidth: W, pageHeight: H } = PAGE_CONFIG
  const signals: IntentSignal[] = []
  const lastPage = Math.max(0, ...regions.map(r => pageIndexForRegion(r)))
  const inside = (r: Region) => regions.some(o => o !== r && (o.geometry.type === 'circle' || o.geometry.type === 'rectangle') && insideShare(r, o) >= 0.85 && o.geometry.width * o.geometry.height > r.geometry.width * r.geometry.height)

  for (const r of regions) {
    const g = r.geometry
    const page = pageIndexForRegion(r)
    const top = g.y - page * H
    const n = [r.regionNumber]
    if (looksHandwritten(r)) {
      signals.push({ regions: n, kind: 'text', anchor: 'exact', source: 'geometry', confidence: 0.7, why: 'handwritten word' })
      continue
    }
    if (g.type === 'arrow') {
      signals.push({ regions: n, kind: 'connector', source: 'geometry', confidence: 0.5, why: 'an arrow' })
      continue
    }
    if (inside(r)) continue // described by what contains it
    const closed = g.type === 'rectangle' || g.type === 'circle'
    const contains = regions.filter(o => o !== r && closed && insideShare(o, r) >= 0.85).length
    if (g.type === 'rectangle' && page === 0 && top < H * 0.12 && g.width >= W * 0.75 && g.height <= H * 0.15) {
      signals.push({ regions: n, kind: 'content', anchor: 'exact', source: 'geometry', confidence: 0.6, why: 'a full-width strip across the top — a navigation bar' })
    } else if (g.type === 'rectangle' && page === lastPage && page > 0 && top > H * 0.75 && g.width >= W * 0.75) {
      signals.push({ regions: n, kind: 'content', anchor: 'exact', source: 'geometry', confidence: 0.5, why: 'a full-width strip at the bottom — a footer' })
    } else if (closed && g.width * g.height >= W * H * 0.55 && contains < 2) {
      signals.push({ regions: n, kind: 'background', anchor: 'behind', source: 'geometry', confidence: 0.55, why: 'covers most of its screen — a background' })
    } else if (g.type === 'circle' && contains > 0) {
      signals.push({ regions: n, kind: 'picture', anchor: 'exact', source: 'geometry', confidence: 0.45, why: 'a circle with marks drawn inside — a globe, emblem or badge' })
    } else if (g.type === 'freeform' && g.width >= W * 0.5 && g.height <= H * 0.25) {
      signals.push({ regions: n, kind: 'decoration', anchor: 'behind', source: 'geometry', confidence: 0.4, why: 'one long sweeping stroke' })
    } else if (closed) {
      signals.push({ regions: n, kind: 'content', anchor: 'exact', source: 'geometry', confidence: 0.4, why: 'a box with nothing said about it — something goes here' })
    }
  }

  // Three or more boxes of about the same size, lined up: a row or grid of cards.
  const boxes = regions.filter(r => r.geometry.type === 'rectangle')
  const seen = new Set<number>()
  for (const b of boxes) {
    if (seen.has(b.regionNumber)) continue
    const alike = boxes.filter(o =>
      Math.abs(o.geometry.width - b.geometry.width) <= b.geometry.width * 0.2 &&
      Math.abs(o.geometry.height - b.geometry.height) <= b.geometry.height * 0.2 &&
      (Math.abs(o.geometry.y - b.geometry.y) <= 40 || Math.abs(o.geometry.x - b.geometry.x) <= 40)
    )
    if (alike.length >= 3) {
      alike.forEach(o => seen.add(o.regionNumber))
      signals.push({ regions: alike.map(o => o.regionNumber), kind: 'content', anchor: 'exact', source: 'geometry', confidence: 0.6, why: `${alike.length} boxes of the same size lined up — a row or grid of cards` })
    }
  }
  return signals
}

// =============================================================================
// Putting it together
// =============================================================================

export function intentSignals(prompt: string, regions: Region[]): IntentSignal[] {
  const firm = [...tagSignals(regions), ...promptSignals(prompt, regions)].filter(s => s.kind || s.anchor)
  const settled = new Set(firm.filter(s => s.kind).flatMap(s => s.regions))
  // A geometry guess about a shape the user already explained is just noise.
  const guesses = geometrySignals(regions).filter(s => !s.regions.every(n => settled.has(n)))
  return [...firm, ...guesses]
}

const ids = (ns: number[]) => ns.map(n => `R${n}`).join('+')

/**
 * The block the understanding agent sees: what code already worked out.
 * USER items are final; PROMPT items are what the user wrote; GEOMETRY items
 * are hints the image may overrule.
 */
export function describeIntentSignals(signals: IntentSignal[]): string {
  if (signals.length === 0) return ''
  const lines = signals.map(s => {
    const what = [
      s.kind ? KIND_LABEL[s.kind] + (s.object ? ` (${s.object})` : '') : 'see the prompt',
      s.anchor ? ANCHOR_LABEL[s.anchor] : null,
      s.interactive ? 'interactive' : null,
      s.animated ? 'animated' : null,
    ].filter(Boolean).join(', ')
    const label = s.source === 'tag' ? 'USER' : s.source === 'prompt' ? 'PROMPT' : 'GEOMETRY'
    return `- ${ids(s.regions)} → ${what} [${label}: ${s.why}]`
  })
  return `WHAT CODE ALREADY WORKED OUT (USER items are final; PROMPT items are what the user wrote — follow them; GEOMETRY items are likely but the image may show otherwise):\n${lines.join('\n')}`
}

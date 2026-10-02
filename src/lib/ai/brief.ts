import type { Region, RegionGroup } from '@/types'
import { PRESETS, resolveByKeywords, stablePresetFor } from './design-tokens'
import { sanitizeUserPrompt } from './prompt-rules'
import { simplifyToBudget } from './shape-path'
import { looksHandwritten, perceiveDrawing } from './perception'
import { PAGE_CONFIG, pageIndexForRegion } from '@/lib/canvas/pages'
import { CANVAS_WIDTH, SCENE_FORMS, absolutePoints, type SceneForm } from './scene'
import { CORNERS, DENSITIES, HEADINGS, SURFACES, describeDesign, fontMenu, normalizeDesign, type SiteDesign } from './site-design'
import { PRODUCT_PRINCIPLE } from './principle'

/**
 * The design brief: what the understanding pass (understand.ts) produces, and
 * how the build stages consume it.
 *
 * Kept free of provider imports on purpose — prompts.ts renders briefs, and
 * provider.ts imports prompts.ts, so pulling the provider in here would make a
 * module cycle.
 *
 * The understanding pass is the first stage of every generation.
 *
 * Everything downstream used to receive the raw prompt plus shapes tagged
 * "layout" or "decorative". Nothing ever asked what the user *meant* — above
 * all, what their drawing was a picture of. Two ridges, a sun and a river came
 * out as neon streaks behind generic cards, because "decorative stroke" was the
 * only concept the pipeline had for a line that wasn't a box.
 *
 * This pass writes a brief the build stages follow literally:
 *   1. what the drawing depicts, element by element, with a form the geometry
 *      step can compute exactly (see scene.ts)
 *   2. what the site needs — audience, action, a section plan with specifics
 *   3. what makes it unlike a template — a concept, a signature element, the
 *      clichés to avoid, and a palette of its own
 *
 * It also replaces two older auxiliary calls (region classification and the
 * style-preset call), so a generation makes fewer model calls than before.
 */

export type ElementRole = 'layout' | 'illustration' | 'decoration' | 'motion' | 'connector'
export type Placement = 'page-background' | 'hero-background' | 'section-background' | 'inline'

const ROLES: readonly ElementRole[] = ['layout', 'illustration', 'decoration', 'motion', 'connector']
const PLACEMENTS: readonly Placement[] = ['page-background', 'hero-background', 'section-background', 'inline']

export interface BriefElement {
  name: string
  regions: number[]
  role: ElementRole
  form: SceneForm | null
  depth: number
  placement: Placement
  render: string | null
  motion: string | null
  /** The planned section this element sits in — the section that builds or hosts it. */
  section: string | null
}

export interface BriefPalette {
  background: string
  surface: string
  text: string
  accent: string
  secondary: string
}

export interface DesignBrief {
  summary: string
  audience: string
  primaryAction: string
  tone: string[]
  concept: string
  signature: string
  /** The template version of this site, named so the build can steer away from it. */
  generic: string
  /** The one name the whole site uses — sections are built in separate calls and used to invent different ones. */
  brand: string
  avoid: string[]
  palette: BriefPalette | null
  styleId: string
  /** This site's own visual system — see site-design.ts. */
  design: SiteDesign
  sections: Array<{ name: string; purpose: string }>
  drawing: {
    reading: string
    kind: 'none' | 'layout' | 'illustration' | 'mixed'
    elements: BriefElement[]
  }
  /** 'fallback' when no model produced it — downstream stays on older heuristics. */
  source: 'model' | 'fallback'
}

// =============================================================================
// Prompt
// =============================================================================

export const UNDERSTAND_SYSTEM_PROMPT = `You are IntentDraw's creative director. Before anything is built, you work out what the user actually wants — including what their drawing is a picture of — and write a brief that a separate build step follows literally.

${PRODUCT_PRINCIPLE}

You receive the user's prompt and, when they drew something, every shape as data: its number, type, PAGE, box in canvas pixels, freeform strokes as SVG paths, and MEASURED facts — often with an image of the drawing. The canvas is a stack of pages, each ${PAGE_CONFIG.pageWidth}×${PAGE_CONFIG.pageHeight}: page 1 is the first screen of the site, page 2 the next screen down, and so on.

THE USER'S OWN WORDS WIN
When the prompt says what a shape is or should do ("region 1 and everything inside it is a 3D object", "R4 is the pricing table"), that IS the answer — follow it exactly, including which shapes it covers. A shape the user refers to is never "decoration".

READING THE DRAWING — the most important part of your job
Each shape is one of:
- LAYOUT: a box or area meaning "put this content here" — a nav, a card, a row of key points, a form. Usually a rectangle.
- TEXT: a handwritten word. It is content or a label: "Name" written where a heading would go means "the person's name goes here"; "Shop" inside a box means that box is the shop. Read the word from the image. A shape MEASURED as handwritten text is TEXT — role "layout", named for what it holds — never a picture or decoration.
- A PICTURE: strokes depicting something — an object, symbol, logo, globe, face, product, scene or landscape. The user wants exactly that picture in the site, as finished art.
- DECORATION: marks that depict nothing (swooshes, scribbles, glow lines).
- A MOTION PATH, or an ARROW relating two things.
Rules:
- Never invent subject matter. If you can't tell what strokes depict, describe them literally ("a circle with a network of connected lines inside it"). Do not turn them into mountains, suns, rivers or anything else the drawing doesn't clearly show.
- MEASURED facts are exact — trust them over your visual impression of a rough sketch ("drawn inside R1", "probably handwritten text", "rises to a single peak", "runs alongside R6", "wraps around R3's arc").
- Shapes drawn inside a circle or box usually belong to it — one element.
- Familiar reads, ONLY when the shapes really look like this: a line rising to a peak and falling = a ridge (mountain, hill); a circle high up with separate or zig-zag marks around it = a sun and its rays; two roughly parallel strokes = the edges of one band (river, road, path); a circle with marks inside = a globe, planet, ball or emblem.
Every shape number belongs to exactly one element.

For each element:
- role: "layout" | "illustration" | "decoration" | "motion" (a path something travels along) | "connector" (an arrow relating two things). Text is "layout".
- form, illustration only: "sphere" (a round body carrying the marks drawn on it, shown as a slowly turning 3D globe that follows the pointer, touch and scroll — use it when the user asks for 3D or for a globe, planet, ball or orb, or when marks inside a circle should wrap around it), "silhouette" (the solid area below a ridge or skyline), "band" (the area between two strokes), "disc" (a flat round body), "rays", "shape" (a closed outline to fill), "line" (keep as a drawn line)
- depth, illustration only: 0 = farthest back … higher = nearer the viewer
- placement: "page-background" | "hero-background" | "section-background" | "inline"
- render: one sentence on how it should LOOK in this site's style — materials, fills, light. For text, what the words are.
- motion: a short phrase if it should move or react, else null
- section: the name of the planned section (from "sections" below) this element sits in
Name a layout element by its purpose ("Navigation", "Key achievements row") and put what goes in it in render.

THE SITE AND ITS SECTIONS
Work out who it is for, what they must be able to do, and the content it really needs — real specifics (actual product categories, believable names, concrete numbers), never "Feature 1".
Plan 5-8 sections as PascalCase component names in page order, each with a one-line purpose naming its actual content.
- The drawn pages are the top of the site, in order: what is drawn on page 1 belongs to the first section (the hero), page 2 to the next, and so on. Set each element's "section" that way.
- The site does NOT end where the drawing ends. After the drawn pages, plan the rest of what this site needs (work, about, pricing, testimonials, contact, footer …).
- A navigation bar, when the site needs one, is its own first section; the footer its own last section.

MAKING IT UNLIKE ANY TEMPLATE
- brand: the name shown on the site — the person's or business's name, exactly as the user gave it; if they didn't, invent one believable, specific name (never "Your Name", "John Doe", "Creator's Name", "Company"). Every section uses this same name.
- generic: first, one sentence describing the template version of this site — what any AI site builder would produce for this prompt (its usual palette, fonts and hero). Every choice below must differ from it.
- concept: one sentence — the idea the whole site is built around, tied to this business and, if there is one, to the drawing. An idea, not a style adjective.
- signature: one specific element no template has.
- avoid: 3 clichés this kind of site usually falls into.
- palette: 5 hex colours that belong to the concept. Don't default to Tailwind's stock blue/purple/slate unless the concept demands them.
- styleId: the closest base style, used only to pick structural references — "neosleek" (stark, sharp), "playful_pop" (rounded, bright), "elegant_serif" (editorial, refined), "glassmorphism" (dark, luminous).
Unless the user asked for one of them, never land in these — they are what AI-generated sites look like right now:
  1. a warm cream background with a high-contrast serif display and a terracotta or clay accent
  2. a near-black background with a single acid-green, vermilion or neon accent (a dark site is fine — give it a real palette)
  3. the newspaper look: hairline rules, zero radius, dense columns
  4. the SaaS-card kit: identical rounded cards with soft grey shadows and gradient washes; purple/indigo gradients
  5. template chrome: tracked-out ALL-CAPS labels above headings, "A · B · C" meta strings, monospace small labels, "→" after button text, one word of a headline in a different colour or italic

THIS SITE'S DESIGN — you design it; there is no default theme
Choose each independently, from the concept, the audience and the drawing — never from habit. The build follows these exactly.
- design.displayFont: the face for headings, logo and big numbers. design.bodyFont: the face for everything else. Pick from:
${fontMenu()}
  Pair for contrast (a serif with a grotesk, a poster face with a quiet text face, a mono with a humanist). Never use the same face twice.
- design.corners: ${CORNERS.map(c => `"${c}"`).join(' | ')}
- design.surfaces: ${SURFACES.map(c => `"${c}"`).join(' | ')} — how cards and panels separate from the page
- design.density: ${DENSITIES.map(c => `"${c}"`).join(' | ')}
- design.headings: ${HEADINGS.map(c => `"${c}"`).join(' | ')}
If the user lists designs from their recent sites, do NOT reuse those typefaces, and don't repeat the same combination of corners and surfaces.
The message may name a DESIGN LENS — a craft to borrow a way of seeing from. Let it shape the palette, type and layout only — never the concept's vocabulary or any copy, and never mention it on the site.

drawing.reading is ONE plain sentence naming what the drawing shows and where, in the user's terms. No region numbers, no reasoning.

Respond with JSON only, no markdown, exactly this shape:
{"brand":"","generic":"","summary":"","audience":"","primaryAction":"","tone":[""],"concept":"","signature":"","avoid":["","",""],"palette":{"background":"#","surface":"#","text":"#","accent":"#","secondary":"#"},"styleId":"","design":{"displayFont":"","bodyFont":"","corners":"","surfaces":"","density":"","headings":""},"sections":[{"name":"","purpose":""}],"drawing":{"reading":"","elements":[{"name":"","regions":[1],"role":"","form":null,"depth":0,"placement":"","render":"","motion":null,"section":""}]}}`

/**
 * Ordinary crafts with their own way of seeing, one handed to the understanding
 * agent per request. Deliberately ordinary — not "a world-famous designer",
 * which collapses back to the same few looks.
 */
export const DESIGN_LENSES = [
  'a letterpress printer', 'a museum exhibition designer', 'a botanical illustrator', 'a transit-map cartographer',
  'a ceramicist', 'a 1970s record-sleeve designer', 'a hand sign painter', 'a theatre poster designer',
  'a Swiss-style typographer', 'a photocopied-zine maker', 'a landscape architect', 'a bookbinder',
  'a ski-resort trail-map illustrator', 'a textile weaver', 'a darkroom photographer', 'a stage lighting designer',
  'a field-guide editor', 'a tea-packaging designer', 'a furniture maker', 'a newspaper infographics editor',
  'an architect drawing elevations', 'a tile maker', 'a gallery catalogue designer', 'a marine-chart maker',
  'a vintage travel-poster artist', "a children's-book illustrator", 'a watchmaker', 'a perfume-label designer',
  'a film title-sequence designer', 'a florist', 'a weather-map designer', 'a calligrapher',
  'an industrial designer of radios', 'a skate-deck artist', 'a hotel wayfinding designer', 'a jazz-club flyer designer',
  'a star-chart cartographer', 'a brutalist-architecture photographer', 'a mid-century airline brochure designer',
  'a seed-catalogue printer', 'a cyclist mapping routes', 'a lab-equipment manual illustrator',
] as const

function pickLens(): string {
  return DESIGN_LENSES[Math.floor(Math.random() * DESIGN_LENSES.length)]
}

/** Stroke detail for reading — enough to tell a ridge from a wave, cheap enough for free tiers. */
function readingBudget(strokes: number): number {
  if (strokes > 12) return 8
  if (strokes > 6) return 12
  return 16
}

function shapeLine(region: Region, budget: number, measured?: string): string {
  const g = region.geometry
  const box = `x=${Math.round(g.x)}..${Math.round(g.x + g.width)} y=${Math.round(g.y)}..${Math.round(g.y + g.height)}`
  const label = `R${region.regionNumber} ${g.type} page ${pageIndexForRegion(region) + 1} ${box}`
  const userNote = region.intent?.trim() ? ` — user's note: "${sanitizeUserPrompt(region.intent.trim()).slice(0, 200)}"` : ''
  const note = (measured ? ` — MEASURED: ${measured}` : '') + userNote

  if (!g.path || g.path.length < 2) return label + note
  const extent = Math.max(g.width, g.height, 1)
  const points = simplifyToBudget(absolutePoints(region), budget, extent / 100)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x)} ${Math.round(p.y)}`).join(' ')
  return `${label} path: ${d}${note}`
}

export function buildUnderstandUserMessage(
  prompt: string,
  regions: Region[],
  groups: RegionGroup[],
  hasImage: boolean,
  recentDesigns: SiteDesign[] = [],
  lens: string = pickLens()
): string {
  const parts: string[] = []
  if (recentDesigns.length > 0) {
    parts.push(
      "THE USER'S RECENT SITES — this one must not look related to any of them:\n" +
        recentDesigns.map(d => `- ${describeDesign(d)}`).join('\n')
    )
  }
  const keywordStyle = resolveByKeywords(prompt)
  if (keywordStyle) {
    parts.push(`STYLE SIGNAL: the prompt's own words point to "${keywordStyle.id}" — prefer it unless the concept clearly needs another.`)
  }

  if (regions.length === 0) {
    parts.push('DRAWING: none — the user wrote a prompt only. Return drawing.elements as [] and drawing.reading as "".')
  } else {
    const height = Math.max(...regions.map(r => r.geometry.y + r.geometry.height), 1)
    const strokes = regions.filter(r => (r.geometry.path?.length ?? 0) > 1).length
    const budget = readingBudget(strokes)
    parts.push(
      `DRAWING: ${regions.length} shapes on a ${CANVAS_WIDTH} x ${Math.ceil(height)} px canvas (origin top-left, y grows downward).` +
        (hasImage ? ' An image of the drawing is attached.' : '')
    )
    const measured = perceiveDrawing(regions)
    parts.push(regions.map(r => shapeLine(r, budget, measured.get(r.regionNumber))).join('\n'))

    const populated = groups.filter(g => regions.some(r => r.groupId === g.id))
    if (populated.length > 0) {
      parts.push(
        'USER GROUPS (the user said these shapes belong together):\n' +
          populated
            .map(g => {
              const members = regions.filter(r => r.groupId === g.id).map(r => `R${r.regionNumber}`).join(', ')
              const intent = g.intent.trim() ? ` — "${sanitizeUserPrompt(g.intent.trim()).slice(0, 300)}"` : ''
              return `"${g.name}": ${members}${intent}`
            })
            .join('\n')
      )
    }
  }

  parts.push(`USER PROMPT:\n${sanitizeUserPrompt(prompt)}`)
  // A different way of seeing on every request — research (arXiv 2602.20408)
  // found ordinary personas, used as sampling cues, are what pulls a model out
  // of its one default. Last, so the stable part of the message comes first.
  parts.push(`DESIGN LENS for this site: ${lens}`)
  return parts.join('\n\n')
}

// =============================================================================
// Parsing + validation
// =============================================================================

/**
 * The first balanced top-level object in the text. The shared `extractJson`
 * helper tries `[...]` before `{...}`, which cuts any object containing an
 * array down to that array — every brief contains several.
 */
export function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const source = fenced ? fenced[1] : text
  const start = source.indexOf('{')
  if (start === -1) throw new Error('no JSON object in response')

  let depth = 0
  let inString = false
  for (let i = start; i < source.length; i++) {
    const c = source[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return JSON.parse(source.slice(start, i + 1))
  }
  throw new Error('unterminated JSON object in response')
}

const str = (v: unknown, max: number, fallback = ''): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : fallback

const strList = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.map(item => str(item, maxLen)).filter(Boolean).slice(0, maxItems) : []

const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i

function palette(v: unknown): BriefPalette | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  const keys: Array<keyof BriefPalette> = ['background', 'surface', 'text', 'accent', 'secondary']
  const out = {} as BriefPalette
  for (const key of keys) {
    const value = str(p[key], 9)
    if (!HEX.test(value)) return null
    out[key] = value.toUpperCase()
  }
  return out
}

/** "Hero section" / "hero-section" → "HeroSection". Anything that can't be a component name is dropped. */
export function toComponentName(raw: string): string | null {
  const name = raw
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join('')
  if (!name || !/^[A-Z]/.test(name) || name === 'App' || name.length > 40) return null
  return name
}

function sections(v: unknown): Array<{ name: string; purpose: string }> {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: Array<{ name: string; purpose: string }> = []
  for (const item of v) {
    const entry = item as Record<string, unknown>
    const name = toComponentName(str(entry?.name, 60))
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({ name, purpose: str(entry?.purpose, 240) })
    if (out.length === 8) break
  }
  return out
}

function defaultRole(region: Region, pictureDrawing: boolean): ElementRole {
  const { type } = region.geometry
  if (type === 'arrow') return 'connector'
  if (type === 'freeform') return pictureDrawing ? 'illustration' : 'decoration'
  return 'layout'
}

const NAV_SECTION = /^(nav|navigation|navbar|header|topbar|menu)/i
const THREE_D = /\b3d\b|three[- ]?d(imensional)?|\bglobe\b|\bsphere\b|\bplanet\b|\borb\b/i

/**
 * The section a drawn page belongs to: page 1 is the first content section
 * (after a navigation bar, if the plan starts with one), page 2 the next, and
 * anything drawn past the plan's end goes to its last content section.
 */
export function sectionForPage(page: number, names: string[]): string | null {
  if (names.length === 0) return null
  const content = names.length > 1 && NAV_SECTION.test(names[0]) ? names.slice(1) : names
  return content[Math.max(0, Math.min(page, content.length - 1))]
}

function elements(v: unknown, regions: Region[], sectionNames: string[] = [], prompt = ''): BriefElement[] {
  const known = new Set(regions.map(r => r.regionNumber))
  const claimed = new Set<number>()
  const out: BriefElement[] = []

  for (const item of Array.isArray(v) ? v : []) {
    const e = item as Record<string, unknown>
    const role = ROLES.includes(e?.role as ElementRole) ? (e.role as ElementRole) : null
    if (!role) continue

    // Each shape belongs to one element; a model that lists R3 twice gets the first.
    const members = (Array.isArray(e.regions) ? e.regions : [])
      .map(n => (typeof n === 'string' ? parseInt(n.replace(/^R/i, ''), 10) : Number(n)))
      .filter(n => Number.isInteger(n) && known.has(n) && !claimed.has(n))
    if (members.length === 0) continue
    members.forEach(n => claimed.add(n))

    const form = role === 'illustration' || role === 'motion'
      ? (SCENE_FORMS.includes(e.form as SceneForm) ? (e.form as SceneForm) : 'line')
      : null

    const memberRegions = regions.filter(r => members.includes(r.regionNumber))
    const page = Math.min(...memberRegions.map(r => pageIndexForRegion(r)))
    const named = toComponentName(str(e.section, 60))
    let finalRole: ElementRole = role
    let finalForm = form
    // Handwriting is text, whatever a model that couldn't read it decided.
    if ((role === 'decoration' || role === 'illustration') && memberRegions.length > 0 && memberRegions.every(looksHandwritten)) {
      finalRole = 'layout'
      finalForm = null
    }
    // "a 3D object" + a circle with marks inside: that is a sphere, even when a
    // weaker model picked a flat form.
    if (
      finalRole === 'illustration' && finalForm !== 'sphere' && THREE_D.test(prompt) &&
      memberRegions.some(r => r.geometry.type === 'circle') && memberRegions.length > 1
    ) {
      finalForm = 'sphere'
    }

    out.push({
      name: str(e.name, 60, `Element ${out.length + 1}`),
      regions: members,
      role: finalRole,
      form: finalForm,
      depth: Number.isFinite(Number(e.depth)) ? Math.max(0, Math.min(20, Math.round(Number(e.depth)))) : 0,
      placement: PLACEMENTS.includes(e.placement as Placement) ? (e.placement as Placement) : 'page-background',
      render: str(e.render, 280) || null,
      motion: str(e.motion, 160) || null,
      section: named && sectionNames.includes(named) ? named : sectionForPage(page, sectionNames),
    })
  }

  // Anything the model skipped still has to go somewhere, or it would vanish
  // from the build. A drawing that is mostly picture keeps strays as picture.
  const pictureDrawing = out.filter(e => e.role === 'illustration').length > out.length / 2
  for (const region of regions) {
    if (claimed.has(region.regionNumber)) continue
    const role = defaultRole(region, pictureDrawing)
    out.push({
      name: `R${region.regionNumber}`,
      regions: [region.regionNumber],
      role,
      form: role === 'illustration' ? 'line' : null,
      depth: out.length,
      placement: role === 'layout' ? 'inline' : 'page-background',
      render: null,
      motion: null,
      section: sectionForPage(pageIndexForRegion(region), sectionNames),
    })
  }
  return keepPagesTogether(out, regions, sectionNames)
}

/**
 * Everything drawn on one page is one screen of the site, so it all goes to
 * one section — the one most of that page's elements were assigned to.
 *
 * A real run put the name and the globe in Hero but moved the key-points box
 * drawn under them into a section of its own: it would have rendered 56% of the
 * way down an otherwise empty screen. Pages also keep their order — page 2
 * never lands in a section above page 1's.
 */
function keepPagesTogether(els: BriefElement[], regions: Region[], names: string[]): BriefElement[] {
  if (names.length === 0) return els
  const pageOf = (e: BriefElement) =>
    Math.min(...regions.filter(r => e.regions.includes(r.regionNumber)).map(r => pageIndexForRegion(r)))

  const byPage = new Map<number, BriefElement[]>()
  for (const e of els) {
    const page = pageOf(e)
    if (Number.isFinite(page)) byPage.set(page, [...(byPage.get(page) ?? []), e])
  }

  const chosen = new Map<number, string>()
  let floor = -1
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const votes = new Map<string, number>()
    for (const e of byPage.get(page)!) if (e.section) votes.set(e.section, (votes.get(e.section) ?? 0) + 1)
    let pick: string | undefined = [...votes].sort((a, b) => b[1] - a[1] || names.indexOf(a[0]) - names.indexOf(b[0]))[0]?.[0]
    if (!pick || names.indexOf(pick) <= floor) pick = sectionForPage(page, names) ?? undefined
    if (pick && names.indexOf(pick) <= floor) pick = names[floor + 1]
    if (!pick) continue
    chosen.set(page, pick)
    floor = names.indexOf(pick)
  }
  return els.map(e => {
    const section = chosen.get(pageOf(e))
    return section ? { ...e, section } : e
  })
}

function drawingKind(els: BriefElement[]): DesignBrief['drawing']['kind'] {
  if (els.length === 0) return 'none'
  const layout = els.some(e => e.role === 'layout')
  const art = els.some(e => e.role !== 'layout')
  if (layout && art) return 'mixed'
  return layout ? 'layout' : 'illustration'
}

/**
 * Coerces anything — a model's JSON, or a brief the client sent back — into a
 * well-formed brief. It runs on every brief that crosses a trust boundary, so
 * lengths are capped and every enum is checked rather than trusted.
 */
export function normalizeBrief(raw: unknown, regions: Region[], prompt: string): DesignBrief {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const drawing = (b.drawing && typeof b.drawing === 'object' ? b.drawing : {}) as Record<string, unknown>
  const plan = sections(b.sections)
  const els = elements(drawing.elements, regions, plan.map(s => s.name), prompt)

  const styleId =
    typeof b.styleId === 'string' && PRESETS[b.styleId]
      ? b.styleId
      : (resolveByKeywords(prompt) ?? stablePresetFor(prompt)).id

  return {
    summary: str(b.summary, 200),
    audience: str(b.audience, 160),
    primaryAction: str(b.primaryAction, 120),
    tone: strList(b.tone, 5, 30),
    concept: str(b.concept, 320),
    signature: str(b.signature, 280),
    generic: str(b.generic, 240),
    brand: str(b.brand, 60),
    avoid: strList(b.avoid, 4, 140),
    palette: palette(b.palette),
    styleId,
    design: normalizeDesign(b.design, prompt, styleId),
    sections: plan,
    drawing: {
      reading: str(drawing.reading, 400),
      kind: drawingKind(els),
      elements: els,
    },
    source: b.source === 'fallback' ? 'fallback' : 'model',
  }
}

/** What the build gets when no model could write a brief: the old heuristics. */
export function fallbackBrief(prompt: string, regions: Region[]): DesignBrief {
  const brief = normalizeBrief({ source: 'fallback' }, regions, prompt)
  return { ...brief, source: 'fallback' }
}

// =============================================================================
// Applying it
// =============================================================================

/**
 * Writes the brief's reading back onto the regions as the tags the existing
 * layout code understands. Illustration and motion become `illustration`, which
 * the skeleton builder leaves out — they are painted by the scene block instead.
 */
export function applyBriefToRegions(regions: Region[], brief: DesignBrief): Region[] {
  if (brief.source === 'fallback') {
    return regions.map(r => ({
      ...r,
      classificationTag:
        r.geometry.type === 'arrow' ? 'relational' : r.geometry.type === 'freeform' ? 'decorative' : 'exact-placement',
    }))
  }

  const byRegion = new Map<number, BriefElement>()
  brief.drawing.elements.forEach(e => e.regions.forEach(n => byRegion.set(n, e)))

  return regions.map(r => {
    const e = byRegion.get(r.regionNumber)
    if (!e) return r
    switch (e.role) {
      case 'layout':
        return { ...r, classificationTag: 'exact-placement', backgroundScope: undefined }
      case 'connector':
        return { ...r, classificationTag: 'relational', backgroundScope: undefined }
      case 'decoration':
        return {
          ...r,
          classificationTag: 'decorative',
          backgroundScope: e.placement === 'page-background' ? 'full' : 'region',
        }
      default:
        return { ...r, classificationTag: 'illustration', backgroundScope: undefined }
    }
  })
}

const PLACEMENT_TEXT: Record<Placement, string> = {
  'page-background':
    'Fixed behind the WHOLE page. The FIRST child of the root wrapper is exactly <div className="fixed inset-0 z-0 pointer-events-none"><IntentScene /></div>, and every content section sits inside a sibling <div className="relative z-10">. The root wrapper itself gets NO background colour — the scene is the page background. Sections over it are transparent or translucent (the first one always transparent).',
  'hero-background':
    'Behind the FIRST section only: <div className="relative min-h-[85vh]"><div className="absolute inset-0 z-0 overflow-hidden pointer-events-none"><IntentScene /></div><div className="relative z-10">{the first section}</div></div>. That first section keeps a transparent background.',
  'section-background':
    'Behind the section at the drawn position: wrapped like a hero background — an absolute inset-0 z-0 layer holding <IntentScene />, the section in a relative z-10 wrapper with a transparent background.',
  inline: 'Inline, inside the section it belongs to, at roughly the drawn size: <div className="w-full aspect-[16/9]"><IntentScene /></div>.',
}

/**
 * The drawing as a picture. The picture itself is rendered in code
 * (scene-render.ts) and supplied to the file as `<IntentScene />`; this block
 * tells the shell what it depicts and where to put it. Returns '' when nothing
 * in the brief is an illustration.
 */
export function describeScene(brief: DesignBrief, regions: Region[]): string {
  const art = brief.drawing.elements.filter(e => e.role === 'illustration' || e.role === 'motion')
  if (art.length === 0 || !regions.some(r => art.some(e => e.regions.includes(r.regionNumber)))) return ''

  const placements = art.map(e => e.placement)
  const placement = (['page-background', 'hero-background', 'section-background', 'inline'] as Placement[])
    .map(p => ({ p, n: placements.filter(x => x === p).length }))
    .sort((a, b) => b.n - a.n)[0].p

  const moving = art.filter(e => e.motion).map(e => `${e.name} (${e.motion})`)

  return `ILLUSTRATED SCENE — THE USER DREW A PICTURE, NOT A LAYOUT
What it depicts: ${brief.drawing.reading || art.map(e => e.name).join(', ')}

It is ALREADY BUILT: a component named <IntentScene /> renders the user's drawing exactly — geometry, layering, colour${moving.length > 0 ? ` and motion (${moving.join('; ')})` : ''}. It is supplied in the final file.
- Do NOT define, import, restyle, recolour or redraw it, and do not add a second version of the drawing (no SVG mountains, suns, rivers of your own).
- Reference it exactly as <IntentScene /> — optionally with a className prop for sizing.

Placement: ${PLACEMENT_TEXT[placement]}

Designing around it:
- It is the centrepiece: leave it visible. NEVER lay a full-bleed overlay over it — no element with "absolute inset-0" carrying a background colour, gradient or backdrop-blur in any section that sits over the scene. For legibility, put the text on a panel sized to the text (max-w-2xl, rounded, 70-85% opacity of the palette surface) or give it a text shadow.
- Its colours come from the brief's palette, so use that same palette everywhere else — the page and the picture must look like one piece.`
}

/** Ends a phrase with exactly one full stop — briefs often arrive with their own. */
const stop = (text: string) => text.replace(/[.!?s]+$/, '') + '.'

/** The brief as build instructions. The shell gets the plan; sections get what concerns them. */
export function renderBrief(brief: DesignBrief, mode: 'shell' | 'section'): string {
  if (brief.source === 'fallback') return ''

  const lines: string[] = ['DESIGN BRIEF — from the understanding pass. Build exactly this; it outranks your own defaults.']
  const site = [
    brief.summary && `Site: ${stop(brief.summary)}`,
    brief.audience && `For: ${stop(brief.audience)}`,
    brief.primaryAction && `Primary action: ${stop(brief.primaryAction)}`,
    brief.tone.length > 0 && `Tone: ${brief.tone.join(', ')}.`,
  ].filter(Boolean)
  if (site.length > 0) lines.push(site.join(' '))
  if (brief.brand) lines.push(`Name on the site: ${brief.brand} — use exactly this wherever a name appears (logo, headings, footer, copy).`)
  lines.push('Write real content only: no placeholder names or text ("Your Name", "John Doe", "Creator\'s Name", "Lorem ipsum", "Company"), no generic filler lines.')
  if (brief.concept) lines.push(`Concept: ${brief.concept}`)
  if (brief.signature) lines.push(`Signature element (must appear, executed well): ${brief.signature}`)
  if (brief.avoid.length > 0) lines.push(`Avoid these clichés: ${brief.avoid.join('; ')}`)
  if (brief.generic) lines.push(`The template version of this site — do NOT build this: ${brief.generic}`)

  if (brief.palette) {
    const p = brief.palette
    lines.push(
      `Palette — use these exact values through arbitrary classes (e.g. bg-[${p.background}] text-[${p.text}]); only tints and shades of them, no other hues:\n` +
        `  background ${p.background} · surface ${p.surface} · text ${p.text} · accent ${p.accent} · secondary ${p.secondary}`
    )
  }

  const hasLayout = brief.drawing.elements.some(e => e.role === 'layout')
  if (mode === 'shell' && brief.sections.length > 0 && !hasLayout) {
    lines.push(
      'Section plan — use these exact component names, in this order, in the SECTIONS manifest:\n' +
        brief.sections.map(s => `  ${s.name} — ${s.purpose}`).join('\n')
    )
  }

  if (brief.drawing.elements.length > 0) {
    lines.push(`The drawing, as understood: ${brief.drawing.reading}`)
    const layout = brief.drawing.elements.filter(e => e.role === 'layout')
    if (layout.length > 0) {
      lines.push(
        'Drawn layout areas:\n' +
          layout
            .map(e => `  ${e.regions.map(n => `R${n}`).join('+')} → ${e.name}${e.render ? ` — ${e.render}` : ''}`)
            .join('\n')
      )
    }
  }

  if (mode === 'section' && brief.drawing.elements.some(e => e.role !== 'layout' && e.role !== 'connector')) {
    // Which section it sits behind, and what that section must do about it, is
    // in the per-section drawing block (page-shell.ts describeDrawnSections).
    lines.push("The user's drawing is supplied as <IntentScene /> and painted by IntentDraw — never define, import or redraw it, and never add your own version of it.")
  }

  return lines.join('\n')
}

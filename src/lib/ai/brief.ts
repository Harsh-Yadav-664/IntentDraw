import type { Region, RegionGroup } from '@/types'
import { PRESETS, resolveByKeywords, stablePresetFor } from './design-tokens'
import { sanitizeUserPrompt } from './prompt-rules'
import { simplifyToBudget } from './shape-path'
import { perceiveDrawing } from './perception'
import { CANVAS_WIDTH, SCENE_FORMS, absolutePoints, type SceneForm } from './scene'

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
  avoid: string[]
  palette: BriefPalette | null
  styleId: string
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

You receive the user's prompt and, when they drew something, every shape as data (number, type, box in canvas pixels on a 1280px-wide canvas, and freeform strokes as SVG paths in those pixels), often with an image of the drawing.

READING THE DRAWING — the most important part of your job
A drawing is usually one of two things, often mixed:
- LAYOUT: boxes and areas meaning "put a section/card/nav here". Mostly rectangles, sometimes circles.
- A PICTURE: strokes depicting real things — mountains, a sun, a river, waves, a skyline, trees, an animal, a product. When the user draws a picture they want THAT picture in the site as art — never reduce it to abstract lines.
Read strokes by their shape AND by how they relate:
- a line rising to a peak and falling = a mountain or hill ridge
- an arc or circle high up = a sun or moon
- marks around a sun — separate strokes radiating out, OR one continuous zig-zag or spiky line that follows its outline — are its RAYS (form "rays"), not mountains
- two roughly parallel strokes running the same way = the two edges of ONE band: a river, road or path
- a long wavy horizontal line low down = water; a jagged flat-topped line = a city skyline
- the prompt confirms or overrides your read ("the sun and the river" means those strokes ARE a sun and a river)
Call strokes "decoration" only when they genuinely depict nothing (scribbles, swooshes, glow lines) or the user says they are decoration.
Some shapes carry MEASURED facts computed from the stroke itself (peaks, arcs, zig-zags, which strokes run side by side, which wrap around an arc). They are exact — trust them over your visual impression of a rough sketch, then decide what the thing IS from them and the prompt.
Put shapes that together depict one thing into one element. Every shape number belongs to exactly one element.

For each element:
- role: "layout" | "illustration" | "decoration" | "motion" (a path something should travel along) | "connector" (an arrow relating two things)
- form, for illustration only: "silhouette" (a ridge or skyline — the solid area BELOW the line), "band" (the area BETWEEN two strokes), "disc" (a round body — an arc is part of a circle), "rays", "shape" (a closed outline to fill), "line" (keep as a drawn line)
- depth, for illustration only: 0 = farthest back (sky, sun) … higher = nearer the viewer
- placement: "page-background" | "hero-background" | "section-background" | "inline"
- render: one sentence on how it should LOOK in this site's style — materials, fills, light. Not "neon lines" unless asked.
- motion: a short phrase if it should move (e.g. "light shimmer flowing downstream"), else null
For a layout element, name it by its purpose ("Navigation", "Product grid") and put what goes in it in render.

THE SITE
Work out who it is for, what they must be able to do, and the content it really needs — real specifics (actual product categories, believable names, concrete numbers), never "Feature 1".
Plan 4-7 sections as PascalCase component names in page order, each with a one-line purpose naming its actual content.

MAKING IT UNLIKE ANY TEMPLATE
- concept: one sentence — the idea the whole site is built around, tied to this business and, if there is one, to the drawing. An idea, not a style adjective.
- signature: one specific element no template has.
- avoid: 3 clichés this kind of site usually falls into.
- palette: 5 hex colours that belong to the concept. Don't default to Tailwind's stock blue/purple/slate unless the concept demands them.
- styleId: the closest base style — "neosleek" (stark, sharp, brutalist), "playful_pop" (rounded, bright, friendly), "elegant_serif" (editorial, refined), "glassmorphism" (dark, luminous, translucent).

drawing.reading is ONE plain sentence naming what the drawing shows ("A sun rising between two mountains, with a river flowing toward the viewer."). No region numbers, no reasoning.

Respond with JSON only, no markdown, exactly this shape:
{"summary":"","audience":"","primaryAction":"","tone":[""],"concept":"","signature":"","avoid":["","",""],"palette":{"background":"#","surface":"#","text":"#","accent":"#","secondary":"#"},"styleId":"","sections":[{"name":"","purpose":""}],"drawing":{"reading":"","elements":[{"name":"","regions":[1],"role":"","form":null,"depth":0,"placement":"","render":"","motion":null}]}}`

/** Stroke detail for reading — enough to tell a ridge from a wave, cheap enough for free tiers. */
function readingBudget(strokes: number): number {
  if (strokes > 12) return 8
  if (strokes > 6) return 12
  return 16
}

function shapeLine(region: Region, budget: number, measured?: string): string {
  const g = region.geometry
  const box = `x=${Math.round(g.x)}..${Math.round(g.x + g.width)} y=${Math.round(g.y)}..${Math.round(g.y + g.height)}`
  const label = `R${region.regionNumber} ${g.type} ${box}`
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
  hasImage: boolean
): string {
  const parts: string[] = []
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

function elements(v: unknown, regions: Region[]): BriefElement[] {
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

    out.push({
      name: str(e.name, 60, `Element ${out.length + 1}`),
      regions: members,
      role,
      form,
      depth: Number.isFinite(Number(e.depth)) ? Math.max(0, Math.min(20, Math.round(Number(e.depth)))) : 0,
      placement: PLACEMENTS.includes(e.placement as Placement) ? (e.placement as Placement) : 'page-background',
      render: str(e.render, 280) || null,
      motion: str(e.motion, 160) || null,
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
    })
  }
  return out
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
  const els = elements(drawing.elements, regions)

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
    avoid: strList(b.avoid, 4, 140),
    palette: palette(b.palette),
    styleId,
    sections: sections(b.sections),
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
    'Behind the FIRST section only: <div className="relative min-h-[85vh]"><div className="absolute inset-0 z-0 overflow-hidden pointer-events-none"><IntentScene /></div><div className="relative z-10"><FirstSection /></div></div>. That first section keeps a transparent background.',
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

/** The brief as build instructions. The shell gets the plan; sections get what concerns them. */
export function renderBrief(brief: DesignBrief, mode: 'shell' | 'section'): string {
  if (brief.source === 'fallback') return ''

  const lines: string[] = ['DESIGN BRIEF — from the understanding pass. Build exactly this; it outranks your own defaults.']
  const site = [
    brief.summary && `Site: ${brief.summary}.`,
    brief.audience && `For: ${brief.audience}.`,
    brief.primaryAction && `Primary action: ${brief.primaryAction}.`,
    brief.tone.length > 0 && `Tone: ${brief.tone.join(', ')}.`,
  ].filter(Boolean)
  if (site.length > 0) lines.push(site.join(' '))
  if (brief.concept) lines.push(`Concept: ${brief.concept}`)
  if (brief.signature) lines.push(`Signature element (must appear, executed well): ${brief.signature}`)
  if (brief.avoid.length > 0) lines.push(`Avoid these clichés: ${brief.avoid.join('; ')}`)

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

  if (mode === 'section' && brief.drawing.elements.some(e => e.role === 'illustration' && e.placement !== 'inline')) {
    lines.push(
      'The page shows the user\'s drawing (<IntentScene />, supplied — never redraw it) behind the content. Sections over it keep transparent backgrounds (always the first section) and NEVER add a full-bleed overlay — no "absolute inset-0" element with a background colour, gradient or backdrop-blur. For legibility, put text on a panel sized to the text (max-w-2xl, rounded, 70-85% opacity of the palette surface) or give it a text shadow.'
    )
  }

  return lines.join('\n')
}

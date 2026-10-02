import type { DesignTokenSet } from './design-tokens'
import { BODY_FONT_NAMES, FONT_NAMES, FONTS, findFont, type FontCharacter, type SiteFonts } from '@/lib/design/fonts'

/**
 * Each site's own visual system, chosen by the understanding agent.
 *
 * It replaces the four fixed presets as the source of a site's look. The
 * presets gave every site one of four shape languages, recoloured — a default
 * theme in all but name. A site's design is now a combination of independent
 * choices (two typefaces from ~48, corners, surfaces, density, heading style),
 * which the code turns into exact classes and banned classes below. The
 * principle stays the one CLAUDE.md insists on: the model chooses, the code
 * enforces — never a prose plea to "be unique".
 */

export const CORNERS = ['sharp', 'subtle', 'soft', 'round', 'pill'] as const
export const SURFACES = ['flat', 'outlined', 'hard-shadow', 'soft-shadow', 'glass', 'layered'] as const
export const DENSITIES = ['airy', 'balanced', 'dense'] as const
export const HEADINGS = ['oversized', 'editorial', 'compact', 'uppercase'] as const

export type Corners = (typeof CORNERS)[number]
export type Surfaces = (typeof SURFACES)[number]
export type Density = (typeof DENSITIES)[number]
export type HeadingStyle = (typeof HEADINGS)[number]

export interface SiteDesign {
  displayFont: string
  bodyFont: string
  corners: Corners
  surfaces: Surfaces
  density: Density
  headings: HeadingStyle
}

// =============================================================================
// What the understanding agent is offered
// =============================================================================

const CHARACTER_LABEL: Record<FontCharacter, string> = {
  'editorial-serif': 'editorial serifs',
  grotesk: 'characterful grotesks',
  poster: 'condensed poster faces (headings only)',
  friendly: 'friendly / rounded',
  technical: 'technical / mono',
  handwritten: 'handwritten (headings only, sparingly)',
  text: 'text faces',
}

/** The font menu for the understanding prompt, grouped by character. */
export function fontMenu(): string {
  const groups = new Map<FontCharacter, string[]>()
  for (const name of FONT_NAMES) {
    const c = FONTS[name].character
    groups.set(c, [...(groups.get(c) ?? []), name])
  }
  const lines = [...groups].map(([c, names]) => `  ${CHARACTER_LABEL[c]}: ${names.join(', ')}`)
  return `${lines.join('\n')}\n  bodyFont must be one of: ${BODY_FONT_NAMES.join(', ')}`
}

// =============================================================================
// Validation and fallback
// =============================================================================

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function pick<T>(list: readonly T[], seed: string): T {
  return list[hash(seed) % list.length]
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null

/** What a brief without a usable design falls back to: the old preset's shape, with varied fonts. */
const FROM_STYLE: Record<string, { corners: Corners; surfaces: Surfaces; density: Density; headings: HeadingStyle; display: FontCharacter[] }> = {
  neosleek: { corners: 'sharp', surfaces: 'hard-shadow', density: 'balanced', headings: 'oversized', display: ['grotesk', 'poster'] },
  playful_pop: { corners: 'pill', surfaces: 'soft-shadow', density: 'airy', headings: 'oversized', display: ['friendly'] },
  elegant_serif: { corners: 'subtle', surfaces: 'outlined', density: 'airy', headings: 'editorial', display: ['editorial-serif'] },
  glassmorphism: { corners: 'round', surfaces: 'glass', density: 'balanced', headings: 'compact', display: ['grotesk'] },
}

function fontsOf(characters: FontCharacter[]): string[] {
  return FONT_NAMES.filter(n => characters.includes(FONTS[n].character))
}

/**
 * Coerces a model's (or client's) design into a valid one. Anything missing or
 * unknown is filled from the brief's style, with fonts picked by a stable hash
 * of `seed`, so the same prompt keeps its look but different prompts differ.
 */
export function normalizeDesign(raw: unknown, seed: string, styleId: string): SiteDesign {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = FROM_STYLE[styleId] ?? FROM_STYLE.neosleek

  const displayFont = findFont(d.displayFont) ?? pick(fontsOf(base.display), `${seed}:display`)
  let bodyFont = findFont(d.bodyFont)
  if (!bodyFont || !FONTS[bodyFont].body) bodyFont = pick(BODY_FONT_NAMES.filter(n => n !== displayFont), `${seed}:body`)

  return {
    displayFont,
    bodyFont,
    corners: oneOf(CORNERS, d.corners) ?? base.corners,
    surfaces: oneOf(SURFACES, d.surfaces) ?? base.surfaces,
    density: oneOf(DENSITIES, d.density) ?? base.density,
    headings: oneOf(HEADINGS, d.headings) ?? base.headings,
  }
}

/**
 * Makes sure a new site doesn't reuse the typeface of one the user made
 * recently. The agent is shown its recent designs and told not to repeat them;
 * this is the guarantee for when it does anyway. A repeated display face is
 * swapped for an unused one of the same character, so the concept's feel
 * survives; a body face that collides with the new display face is swapped too.
 */
export function freshDesign(design: SiteDesign, recent: SiteDesign[], seed: string): SiteDesign {
  const usedDisplay = new Set(recent.map(r => r.displayFont))
  if (!usedDisplay.has(design.displayFont)) return design

  const character = FONTS[design.displayFont].character
  const unused = (names: string[]) => names.filter(n => !usedDisplay.has(n))
  const sameCharacter = unused(fontsOf([character]))
  const candidates = sameCharacter.length > 0 ? sameCharacter : unused(FONT_NAMES)
  if (candidates.length === 0) return design

  const displayFont = pick(candidates, `${seed}:fresh`)
  const bodyFont = design.bodyFont === displayFont
    ? pick(BODY_FONT_NAMES.filter(n => n !== displayFont), `${seed}:fresh-body`)
    : design.bodyFont
  return { ...design, displayFont, bodyFont }
}

export function siteFonts(design: SiteDesign): SiteFonts {
  return { display: design.displayFont, body: design.bodyFont }
}

/** One line for the "already used" list the understanding agent sees. */
export function describeDesign(d: SiteDesign): string {
  return `${d.displayFont} + ${d.bodyFont}, ${d.corners} corners, ${d.surfaces} surfaces, ${d.density}, ${d.headings} headings`
}

// =============================================================================
// Design → concrete tokens
// =============================================================================

const CORNER_RULES: Record<Corners, { rule: string; banned: string[] }> = {
  sharp: {
    rule: 'rounded-none everywhere — every card, button, input and image has square corners.',
    banned: ['rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'],
  },
  subtle: {
    rule: 'rounded-[3px] on cards, buttons and inputs; images square.',
    banned: ['rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'],
  },
  soft: {
    rule: 'rounded-[14px] on cards and images, rounded-[10px] on buttons and inputs.',
    banned: ['rounded-none', 'rounded-full', 'rounded-3xl'],
  },
  round: {
    rule: 'rounded-[28px] on cards and images, rounded-[18px] on buttons and inputs.',
    banned: ['rounded-none', 'rounded-sm', 'rounded-md'],
  },
  pill: {
    rule: 'rounded-full on every button, tag and input; rounded-[36px] on cards and images.',
    banned: ['rounded-none', 'rounded-sm', 'rounded-md', 'rounded-lg'],
  },
}

const SURFACE_RULES: Record<Surfaces, { rule: string; banned: string[] }> = {
  flat: {
    rule: 'No shadows and no borders. Areas are separated by solid blocks of the palette colours.',
    banned: ['shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'backdrop-blur', 'backdrop-blur-md', 'backdrop-blur-xl'],
  },
  outlined: {
    rule: 'Hairline borders (border, in the text colour at 15-25% opacity) define every card and divide sections. No shadows.',
    banned: ['shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'backdrop-blur-md', 'backdrop-blur-xl'],
  },
  'hard-shadow': {
    rule: 'Raised elements get border-2 in the text colour and a hard offset shadow, e.g. shadow-[6px_6px_0_0_<text colour>]; hover shifts it (translate-x-[2px] translate-y-[2px], smaller shadow). No blur anywhere.',
    banned: ['shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'backdrop-blur-md', 'backdrop-blur-xl'],
  },
  'soft-shadow': {
    rule: 'Raised elements float on ONE large diffuse shadow tinted with the palette, e.g. shadow-[0_30px_80px_-24px_<accent>55]; nothing else has a shadow. No visible borders.',
    banned: ['shadow-sm', 'shadow-md', 'border-gray-200', 'border-gray-300'],
  },
  glass: {
    rule: 'Panels are translucent palette surface (bg-[<surface>]/60) with backdrop-blur-xl and a 1px border at white/10; strong colour or the drawing must sit behind them for the glass to read.',
    banned: ['shadow-sm', 'shadow-md', 'bg-white', 'bg-gray-50'],
  },
  layered: {
    rule: 'Depth comes from overlap: panels and images offset over each other (negative margins / translate) in alternating palette colours. No drop shadows.',
    banned: ['shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl'],
  },
}

const DENSITY_RULES: Record<Density, string> = {
  airy: 'Generous: sections py-24, content max-w-6xl, gaps of 12-16, few items per row.',
  balanced: 'Sections py-16 to py-20, content max-w-7xl, gaps of 8-10.',
  dense: 'Information-rich: sections py-12 to py-16, content max-w-7xl, gaps of 4-6, more items per row, smaller supporting text.',
}

const HEADING_RULES: Record<HeadingStyle, string> = {
  oversized: 'Headings are huge and tight — hero text-7xl to text-9xl, leading-[0.9], tracking-tight — and dominate their section.',
  // No accented word inside a heading: one italic or coloured word in a headline is
  // one of the commonest tells of a generated page (frontend-design / avoid-ai-design, SD5).
  editorial: 'Headings are refined: text-5xl to text-7xl, normal tracking, in one weight and one colour; hierarchy comes from size and generous space, not from accenting a word.',
  compact: 'Headings are restrained (hero text-5xl, sections text-3xl); hierarchy comes from weight and colour, not size.',
  // Uppercase headings, but no tracked-out ALL-CAPS labels above them — that
  // template chrome reads as AI-made (SD4/T5).
  uppercase: 'Headings are uppercase with slight tracking (tracking-[0.04em]); every other line of text is sentence case — no small ALL-CAPS labels or eyebrows.',
}

/** Classes no site may use, whatever its design: the generic-template signature. */
const ALWAYS_BANNED = [
  'font-sans', 'font-serif', 'font-mono',
  'bg-gray-50', 'bg-slate-50', 'bg-gray-100', 'text-gray-500', 'text-gray-600',
]

export function designTokens(design: SiteDesign, styleId: string): DesignTokenSet {
  const corners = CORNER_RULES[design.corners]
  const surfaces = SURFACE_RULES[design.surfaces]
  return {
    // The id stays the brief's base style: the reference sketches key their
    // affinity on it.
    id: styleId,
    name: `${design.displayFont} / ${design.bodyFont}, ${design.corners} corners, ${design.surfaces} surfaces, ${design.density}`,
    borderRadius: corners.rule,
    colorPalette: 'The brief\'s palette.',
    typography:
      `Display face "${design.displayFont}" — EVERY heading (h1-h3, big numbers, the logo) uses className "font-display". ` +
      `Body face "${design.bodyFont}" is already applied to the page; body text needs no font class. ` +
      `Never name any other typeface. ${HEADING_RULES[design.headings]}`,
    shadowTreatment: surfaces.rule,
    bannedClasses: [...new Set([...corners.banned, ...surfaces.banned, ...ALWAYS_BANNED])],
    specialInstructions: DENSITY_RULES[design.density],
  }
}

// =============================================================================
// Enforcement on generated code
// =============================================================================

const NAMED_SHADOW = /^shadow(?:-(?:sm|md|lg|xl|2xl|inner))?$/
const ANY_SHADOW = /^shadow(?:-(?:sm|md|lg|xl|2xl|inner)|-\[.+\])?$/
const ANY_ROUNDING = /^rounded(?:-(?:t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee))?(?:-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[.+\]))?$/

function removes(design: SiteDesign): (base: string) => boolean {
  return base => {
    if (base === 'font-sans' || base === 'font-serif' || base === 'font-mono') return true
    if (design.corners === 'sharp' && ANY_ROUNDING.test(base)) return true
    if (design.surfaces === 'flat' && ANY_SHADOW.test(base)) return true
    if ((design.surfaces === 'outlined' || design.surfaces === 'layered' || design.surfaces === 'hard-shadow') && NAMED_SHADOW.test(base)) {
      return true
    }
    return false
  }
}

/** The extent of each className value: "…", '…', or a brace-matched {…}. */
function classNameRanges(code: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const re = /\bclassName\s*=\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    const start = m.index + m[0].length
    const open = code[start]
    if (open === '"' || open === "'") {
      const end = code.indexOf(open, start + 1)
      if (end !== -1) ranges.push([start + 1, end])
    } else if (open === '{') {
      let depth = 0
      for (let i = start; i < code.length; i++) {
        if (code[i] === '{') depth++
        else if (code[i] === '}' && --depth === 0) {
          ranges.push([start + 1, i])
          break
        }
      }
    }
  }
  return ranges
}

/**
 * Removes classes the site's design rules out, from className values only.
 *
 * The prompt lists banned classes, but a model still reaches for `font-mono`
 * or `rounded-xl` out of habit — and one stray class is enough to make a sharp
 * brutalist site look like every other template. Only removals that can't hurt
 * are made: a font class (the page's own faces apply instead), rounding on a
 * sharp design, and drop shadows on designs that have none. `drop-shadow-*`
 * (text legibility over the drawing) and `shadow-none` are never touched.
 */
export function enforceDesign(code: string, design: SiteDesign): string {
  const shouldRemove = removes(design)
  const token = /(^|[\s"'`])([^\s"'`]+)(?=$|[\s"'`])/g
  let out = ''
  let last = 0
  for (const [start, end] of classNameRanges(code)) {
    out += code.slice(last, start)
    const original = code.slice(start, end)
    let removed = false
    let value = original.replace(token, (whole, lead: string, cls: string) => {
      const base = cls.slice(cls.lastIndexOf(':', cls.indexOf('[') === -1 ? cls.length : cls.indexOf('[')) + 1)
      if (!shouldRemove(base)) return whole
      removed = true
      return lead
    })
    if (removed) {
      // Tidy the gap a removal leaves. Inside {…} only doubled spaces go: a
      // space at a string's edge there may be what separates two classes
      // joined with `+`.
      value = value.replace(/ {2,}/g, ' ')
      if (code[start - 1] !== '{') value = value.trim()
    }
    out += value
    last = end
  }
  return out + code.slice(last)
}

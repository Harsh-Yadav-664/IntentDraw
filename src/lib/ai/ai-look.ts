/**
 * A zero-token check for the code-certain signs that a page was made by AI, run
 * on every section as it arrives.
 *
 * The owner's bar is that a new user's first site must not look generated. The
 * prompts already forbid these patterns; models still reach for them out of
 * habit, and nothing checked. Tells and IDs follow the MIT-licensed
 * avoid-ai-design catalogue (github.com/ungspirit/avoid-ai-design,
 * references/ai-tells-catalog.md) — ideas ported, no code copied. Only tells
 * that are certain from source are here; anything that needs eyes (palette
 * weight, rhythm, hierarchy) belongs to a visual review.
 *
 * Severity follows the catalogue: P0 a layperson notices, P1 a designer
 * notices, P2 polish. Mechanical ones are fixed in place (`fixAiLook`); the
 * rest become a short note for rebuilding the section (`aiLookNote`).
 */

export interface AiTell {
  id: string
  severity: 'P0' | 'P1' | 'P2'
  /** What was found, in plain words. */
  what: string
  /** What to do instead — written to the model in a rebuild note. */
  instead: string
}

/** Every className value's text (string literals and template text inside className={…}). */
function classValues(code: string): string[] {
  const out: string[] = []
  const re = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{([^}]*)\})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) out.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '')
  return out
}

/** Visible text between JSX tags. */
function jsxText(code: string): string[] {
  return [...code.matchAll(/>([^<>{}]+)</g)].map(m => m[1].trim()).filter(t => t.length > 0)
}

const has = (classes: string, re: RegExp) => re.test(` ${classes} `)

export function scanAiLook(code: string): AiTell[] {
  const tells: AiTell[] = []
  const classes = classValues(code)
  const text = jsxText(code)
  const add = (t: AiTell) => {
    if (!tells.some(x => x.id === t.id)) tells.push(t)
  }

  // C1 — the purple/indigo-to-blue gradient.
  if (classes.some(c => has(c, /\sfrom-(?:purple|indigo|violet|fuchsia)-\d+/) && has(c, /\sto-(?:blue|indigo|purple|violet|cyan|pink)-\d+/))) {
    add({ id: 'C1', severity: 'P0', what: 'a purple/indigo-to-blue gradient', instead: 'use the palette colours — a solid field or a gradient between two of its own colours' })
  }
  // C6 — gradient headline text.
  if (classes.some(c => has(c, /\sbg-clip-text\s/) && has(c, /\stext-transparent\s/))) {
    add({ id: 'C6', severity: 'P0', what: 'gradient-filled headline text', instead: 'set headlines in one solid palette colour' })
  }
  // C2 — indigo/violet buttons that aren't the palette.
  if (/<(?:button|a)\b[^>]*className\s*=\s*["'{`][^>]*\bbg-(?:indigo|violet|purple)-[4-7]00\b/.test(code)) {
    add({ id: 'C2', severity: 'P1', what: 'an indigo/violet button colour', instead: "colour buttons with the palette's accent" })
  }
  // K2 — rounded-2xl + big shadow on every surface.
  const softCards = classes.filter(c => has(c, /\srounded-(?:2xl|3xl)\s/) && has(c, /\sshadow-(?:lg|xl|2xl)\s/)).length
  if (softCards >= 3) {
    add({ id: 'K2', severity: 'P1', what: `${softCards} soft rounded cards with big shadows`, instead: 'vary surfaces: hairline rules, flat colour fields, or one raised element — not a shadowed card for everything' })
  }
  // K6 / L2 — icons in tinted rounded-square chips, the three-feature-card look.
  const chips = classes.filter(
    c => has(c, /\s(?:w|h|size)-(?:10|11|12|14)\s/) && has(c, /\srounded-(?:lg|xl|2xl|full)\s/) && has(c, /\sbg-[^\s]+\/(?:5|10|15|20)\s/) && has(c, /\s(?:items-center|place-items-center)\s/)
  ).length
  if (chips >= 3) {
    add({ id: 'K6', severity: 'P1', what: `${chips} icons sitting in tinted rounded-square chips`, instead: 'drop the chip: set the icon (or a number, or a small image) directly beside or above the text, or lose the icons' })
  }
  // SD6 — decorative 01 / 02 / 03.
  const numbered = text.filter(t => /^0[1-9]\.?$/.test(t)).length + (code.match(/['"]0[1-9]['"]/g)?.length ?? 0)
  if (numbered >= 3) {
    add({ id: 'SD6', severity: 'P1', what: 'decorative 01 / 02 / 03 markers', instead: 'only number things that are a real sequence; otherwise let the content carry the order' })
  }
  // CP1 — vague aspirational headline copy.
  const vague = /\b(?:elevate|unlock|unleash|empower|supercharge|revolutioni[sz]e|transform|reimagine)\s+your\b|\bseamless(?:ly)?\b|\bcutting[- ]edge\b|\bnext[- ]level\b|\bgame[- ]chang/i
  const vagueLine = text.find(t => vague.test(t))
  if (vagueLine) {
    add({ id: 'CP1', severity: 'P1', what: `vague marketing copy ("${vagueLine.slice(0, 50)}")`, instead: 'say the concrete thing this business does, for whom, with a specific detail' })
  }
  // CP3 — arrow glyphs stapled to text.
  const arrows = text.filter(t => /(?:→|->|⟶|↗)\s*$/.test(t) || /^\s*(?:→|⟶)/.test(t)).length
  if (arrows >= 2) {
    add({ id: 'CP3', severity: 'P1', what: `${arrows} labels with an arrow glyph stapled on`, instead: 'let the label stand on its own; use an arrow only where it means direction' })
  }
  // I2 — emoji as bullets or icons.
  const emoji = text.filter(t => /\p{Extended_Pictographic}/u.test(t)).length
  if (emoji >= 2) {
    add({ id: 'I2', severity: 'P1', what: 'emoji used as icons or bullets', instead: 'use lucide icons, numbers or nothing' })
  }
  // IM4 — placeholder identities. P0 here, above the catalogue: a "Jane Doe"
  // on a first site is the clearest sign nobody wrote it.
  const placeholder = text.find(t => /\b(?:john|jane) doe\b|\blorem ipsum\b|\bacme\b|\byour (?:name|company|brand)\b|\bcompany name\b/i.test(t))
  if (placeholder) {
    add({ id: 'IM4', severity: 'P0', what: `placeholder content ("${placeholder.slice(0, 40)}")`, instead: 'write real, specific names and content for this business' })
  }
  // CP6 — generic CTA labels.
  const generic = text.filter(t => /^(?:get started|learn more|sign up|click here|read more|submit)$/i.test(t)).length
  if (generic >= 2) {
    add({ id: 'CP6', severity: 'P2', what: 'generic button labels ("Get started", "Learn more")', instead: 'name the action: what happens when it is pressed' })
  }
  // M4 — bounce / elastic easing.
  if (/ease\s*:\s*['"`](?:bounce|elastic|back)[\w.()]*['"`]/.test(code) || /\banimate-bounce\b/.test(code)) {
    add({ id: 'M4', severity: 'P2', what: 'bounce or elastic easing', instead: 'ease out smoothly (power2/power3.out)' })
  }
  return tells
}

/**
 * Fixes the tells that have exactly one right answer, in place: gradient text
 * becomes solid (the text keeps its own colour classes, or inherits the
 * page's), and bouncy easing becomes a smooth ease-out.
 */
export function fixAiLook(code: string): { code: string; fixed: string[] } {
  const fixed: string[] = []
  let out = code.replace(/className\s*=\s*(["'`])([^"'`]*)\1/g, (whole, quote: string, value: string) => {
    const tokens = value.split(/\s+/).filter(Boolean)
    if (!tokens.includes('bg-clip-text') || !tokens.includes('text-transparent')) return whole
    const kept = tokens.filter(t => !/^(?:bg-clip-text|text-transparent|bg-gradient-to-[a-z]+|bg-linear-to-[a-z]+|from-\S+|via-\S+|to-\S+)$/.test(t))
    if (!fixed.includes('C6')) fixed.push('C6')
    return `className=${quote}${kept.join(' ')}${quote}`
  })
  const eased = out.replace(/(ease\s*:\s*)(['"`])(?:bounce|elastic|back)[\w.()]*\2/g, (_m, lead: string, q: string) => `${lead}${q}power3.out${q}`)
  if (eased !== out) fixed.push('M4')
  out = eased
  return { code: out, fixed }
}

/** A rebuild note for what is left: worst first, short enough for a section note. */
export function aiLookNote(tells: AiTell[], max = 300): string {
  if (tells.length === 0) return ''
  const order = { P0: 0, P1: 1, P2: 2 }
  const lines = [...tells].sort((a, b) => order[a.severity] - order[b.severity]).map(t => `${t.what} → ${t.instead}`)
  let note = 'Looks generated: '
  for (const line of lines) {
    if ((note + line).length > max) break
    note += `${line}; `
  }
  return note.replace(/; $/, '.')
}

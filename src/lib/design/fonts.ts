/**
 * The typefaces a generated site may use, and how the preview loads them.
 *
 * Before this, nothing loaded a font: presets *said* "Playfair Display" and the
 * iframe rendered system-ui regardless, so every site shared one typeface —
 * the single biggest reason output looked alike. Each site now gets a display
 * and a body face from this list (chosen by the understanding agent), and the
 * preview, exported HTML and share page load exactly those.
 *
 * Every name and weight here was checked against the live Google Fonts css2 API
 * (2026-10-02). css2 rejects the WHOLE request if any one weight is missing, so
 * never add an entry or weight without checking it.
 *
 * Deliberately absent: Inter, Roboto, Open Sans, Poppins, Montserrat, Lato —
 * the faces that make a page read as "generated".
 *
 * Client-safe: imported by the preview runtime as well as the AI pipeline.
 */

export type FontCharacter =
  | 'editorial-serif'
  | 'grotesk'
  | 'poster'
  | 'friendly'
  | 'technical'
  | 'handwritten'
  | 'text'

export interface FontSpec {
  character: FontCharacter
  fallback: 'serif' | 'sans-serif' | 'monospace' | 'cursive'
  weights: number[]
  /** Comfortable for paragraphs, not only headings. */
  body: boolean
}

export const FONTS: Record<string, FontSpec> = {
  // Editorial serifs
  'Fraunces': { character: 'editorial-serif', fallback: 'serif', weights: [400, 700], body: false },
  'Instrument Serif': { character: 'editorial-serif', fallback: 'serif', weights: [400], body: false },
  'DM Serif Display': { character: 'editorial-serif', fallback: 'serif', weights: [400], body: false },
  'Playfair Display': { character: 'editorial-serif', fallback: 'serif', weights: [400, 700], body: false },
  'Cormorant Garamond': { character: 'editorial-serif', fallback: 'serif', weights: [500, 700], body: false },
  'Bodoni Moda': { character: 'editorial-serif', fallback: 'serif', weights: [400, 700], body: false },
  'Young Serif': { character: 'editorial-serif', fallback: 'serif', weights: [400], body: false },
  'Gloock': { character: 'editorial-serif', fallback: 'serif', weights: [400], body: false },
  // Characterful grotesks
  'Bricolage Grotesque': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: false },
  'Syne': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: false },
  'Space Grotesk': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: true },
  'Unbounded': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: false },
  'Familjen Grotesk': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: true },
  'Schibsted Grotesk': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: true },
  'Darker Grotesque': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: false },
  'Epilogue': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: true },
  'Archivo': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: true },
  'Red Hat Display': { character: 'grotesk', fallback: 'sans-serif', weights: [400, 700], body: false },
  // Condensed / poster
  'Bebas Neue': { character: 'poster', fallback: 'sans-serif', weights: [400], body: false },
  'Anton': { character: 'poster', fallback: 'sans-serif', weights: [400], body: false },
  'Big Shoulders Display': { character: 'poster', fallback: 'sans-serif', weights: [400, 800], body: false },
  'Archivo Black': { character: 'poster', fallback: 'sans-serif', weights: [400], body: false },
  // Friendly / rounded
  'Fredoka': { character: 'friendly', fallback: 'sans-serif', weights: [400, 600], body: false },
  'Nunito': { character: 'friendly', fallback: 'sans-serif', weights: [400, 700], body: true },
  'Baloo 2': { character: 'friendly', fallback: 'sans-serif', weights: [400, 700], body: false },
  'Rubik': { character: 'friendly', fallback: 'sans-serif', weights: [400, 700], body: true },
  // Technical / mono
  'JetBrains Mono': { character: 'technical', fallback: 'monospace', weights: [400, 700], body: true },
  'IBM Plex Mono': { character: 'technical', fallback: 'monospace', weights: [400, 600], body: true },
  'Space Mono': { character: 'technical', fallback: 'monospace', weights: [400, 700], body: true },
  'Major Mono Display': { character: 'technical', fallback: 'monospace', weights: [400], body: false },
  'Silkscreen': { character: 'technical', fallback: 'monospace', weights: [400, 700], body: false },
  // Handwritten
  'Caveat': { character: 'handwritten', fallback: 'cursive', weights: [400, 700], body: false },
  // Text faces — bodies first, some carry headings too
  'Manrope': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Hanken Grotesk': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Figtree': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Onest': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'DM Sans': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Work Sans': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'IBM Plex Sans': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Sora': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Plus Jakarta Sans': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Libre Franklin': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Chivo': { character: 'text', fallback: 'sans-serif', weights: [400, 700], body: true },
  'Geist': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Instrument Sans': { character: 'text', fallback: 'sans-serif', weights: [400, 600], body: true },
  'Newsreader': { character: 'text', fallback: 'serif', weights: [400, 600], body: true },
  'Source Serif 4': { character: 'text', fallback: 'serif', weights: [400, 600], body: true },
  'Literata': { character: 'text', fallback: 'serif', weights: [400, 600], body: true },
}

export const FONT_NAMES = Object.keys(FONTS)
export const BODY_FONT_NAMES = FONT_NAMES.filter(n => FONTS[n].body)

const BY_KEY = new Map(FONT_NAMES.map(n => [fontKey(n), n]))

function fontKey(name: string): string {
  return name.toLowerCase().replace(/[_\s-]+/g, ' ').trim()
}

/** The canonical name for "fraunces" / "Space_Grotesk" / "Space Grotesk", or null if not in the list. */
export function findFont(name: unknown): string | null {
  if (typeof name !== 'string') return null
  return BY_KEY.get(fontKey(name.replace(/['"]/g, ''))) ?? null
}

export interface SiteFonts {
  display: string
  body: string
}

/**
 * The comment the pipeline writes into a generated file naming its fonts. It
 * lives in the code itself, so a saved, shared or exported file always knows
 * its own typefaces without the brief that chose them.
 */
export function fontMarker(fonts: SiteFonts): string {
  return `/* SITE-FONTS: display=${fonts.display}; body=${fonts.body} */`
}

const MARKER = /\/\*\s*SITE-FONTS:\s*display=([^;*]+);\s*body=([^*]+?)\s*\*\//

export function readFontMarker(code: string): SiteFonts | null {
  const m = code.match(MARKER)
  if (!m) return null
  const display = findFont(m[1])
  const body = findFont(m[2])
  return display && body ? { display, body } : null
}

/** One Google Fonts css2 URL for every named face, each with its verified weights. */
export function fontStylesheetUrl(names: string[]): string {
  const families = [...new Set(names.map(findFont).filter((n): n is string => !!n))]
    .map(n => `family=${n.replace(/ /g, '+')}:wght@${FONTS[n].weights.join(';')}`)
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

function stack(name: string): string {
  return `'${name}', ${FONTS[name].fallback}`
}

/**
 * The <head> markup that loads a file's fonts.
 *
 * With the marker: both faces load, the body face is applied to the page, and
 * `font-display` is defined for headings. Without it (files generated earlier),
 * any listed face the code names — e.g. `font-['Playfair_Display']` — is still
 * loaded so that class finally renders as written.
 */
export function fontHead(code: string): string {
  const fonts = readFontMarker(code)
  if (fonts) {
    return [
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      `<link rel="stylesheet" href="${fontStylesheetUrl([fonts.display, fonts.body])}">`,
      `<style>body{font-family:${stack(fonts.body)}}.font-display{font-family:${stack(fonts.display)}}.font-body{font-family:${stack(fonts.body)}}</style>`,
    ].join('\n  ')
  }

  const named = FONT_NAMES.filter(n => {
    const pattern = n.replace(/ /g, '[ _]')
    return new RegExp(`['"\`]${pattern}['"\`,]`).test(code)
  })
  if (named.length === 0) return ''
  return `<link rel="stylesheet" href="${fontStylesheetUrl(named)}">`
}

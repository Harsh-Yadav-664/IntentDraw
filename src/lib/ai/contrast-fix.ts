/**
 * Text that can't be read on its own background, fixed in the class list.
 *
 * Models pair a bright accent with white text by habit — a real run put white
 * on orange (2.6:1) on every button of the site. When one className sets both
 * a solid background and a text colour, the pair's contrast is known without
 * rendering anything; below WCAG AA the text colour is swapped for the first of
 * the palette's own ink, white or near-black that passes. Zero tokens, and the
 * design keeps its colours — only the ink changes.
 *
 * What it can't see (text over a parent's background, images, gradients) is
 * left to the layout audit in the preview.
 */
import { contrastRatio } from '@/lib/utils/page-audit'

const NAMED: Record<string, string> = { white: '#FFFFFF', black: '#000000' }

// Base utilities only: a variant (hover:, md:) or an opacity (/80) changes
// what is actually on screen, so those pairs are left alone.
const BG = /^bg-(?:\[(#[0-9a-f]{3}|#[0-9a-f]{6})\]|(white|black))$/i
const TEXT = /^text-(?:\[(#[0-9a-f]{3}|#[0-9a-f]{6})\]|(white|black))$/i
const LARGE = /^text-(?:[2-9]xl)$/
const BOLD_XL = /^text-xl$/

function rgb(hex: string): number[] {
  const h = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1)
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

const textClass = (hex: string) => (hex === '#FFFFFF' ? 'text-white' : `text-[${hex}]`)

/** One class list, fixed — or null when it needs nothing. */
function fixClasses(classes: string, inks: string[]): { classes: string; fix: string } | null {
  const tokens = classes.split(/\s+/)
  let bg: string | null = null
  let textAt = -1
  let text: string | null = null
  tokens.forEach((token, i) => {
    const b = BG.exec(token)
    if (b) bg = b[1] ?? NAMED[b[2].toLowerCase()]
    const t = TEXT.exec(token)
    if (t) {
      text = t[1] ?? NAMED[t[2].toLowerCase()]
      textAt = i
    }
  })
  if (!bg || !text || textAt < 0) return null
  const large = tokens.some(t => LARGE.test(t)) || (tokens.some(t => BOLD_XL.test(t)) && tokens.includes('font-bold'))
  const need = large ? 3 : 4.5
  const back = rgb(bg)
  const ratio = contrastRatio(rgb(text), back)
  if (ratio >= need) return null

  const candidates = [...inks, '#FFFFFF', '#111111'].map(c => c.toUpperCase())
  const best =
    candidates.find(c => contrastRatio(rgb(c), back) >= need) ??
    candidates.reduce((a, b) => (contrastRatio(rgb(b), back) > contrastRatio(rgb(a), back) ? b : a))
  if (contrastRatio(rgb(best), back) <= ratio) return null
  tokens[textAt] = textClass(best)
  return { classes: tokens.join(' '), fix: `${text} on ${bg} (${ratio.toFixed(1)}:1) → ${best}` }
}

/**
 * Fixes every className whose own background and text colour fail contrast.
 * `inks` are the palette's text colours to prefer (its text, then background).
 */
export function fixContrast(code: string, inks: string[] = []): { code: string; fixes: string[] } {
  const fixes: string[] = []
  const palette = inks.filter(c => /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(c))
  const next = code.replace(/className\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (whole, dq: string | undefined, sq: string | undefined) => {
    const fixed = fixClasses(dq ?? sq ?? '', palette)
    if (!fixed) return whole
    fixes.push(fixed.fix)
    return dq !== undefined ? `className="${fixed.classes}"` : `className='${fixed.classes}'`
  })
  return { code: next, fixes }
}

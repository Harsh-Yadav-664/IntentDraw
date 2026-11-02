/**
 * Images drawn in code, in the site's own palette — what a generated page shows
 * where it asked for a photo.
 *
 * The owner's rule (2026-10-19): no third-party stock photos on our pages while
 * the product is free; the paid hosted tier will generate real images. Until
 * then a keyword image is a composition — an arch, a horizon, a still life, a
 * field of forms — chosen and varied by the keyword and lock, so cards differ
 * from each other but every one belongs to the site. Generated code keeps the
 * portable keyword URL (`loremflickr.com/{w}/{h}/{keyword}?lock=n`): that URL is
 * the hook an image generator will replace later, so nothing else changes then.
 *
 * `artFromUrl` and `artImage` are embedded into the sandboxed preview as source
 * text (`.toString()`), so each must stay self-contained: no imports, and no
 * references to anything outside its own body.
 */

/** Five palette colours, in BriefPalette order: background, surface, text, accent, secondary. */
export type ArtPalette = [string, string, string, string, string]

export const NEUTRAL_ART_PALETTE: ArtPalette = ['#efe9df', '#e2d8c9', '#2f2a24', '#b5654a', '#7d8a6a']

const MARKER = /\/\*\s*SITE-PALETTE:\s*(#[0-9a-fA-F]{6}(?:\s*,\s*#[0-9a-fA-F]{6}){4})\s*\*\//

/** Carried in the shell, like the font marker, so the preview can paint in the site's colours. */
export function paletteMarker(p: { background: string; surface: string; text: string; accent: string; secondary: string }): string {
  return `/* SITE-PALETTE: ${[p.background, p.surface, p.text, p.accent, p.secondary].join(',')} */`
}

export function readPaletteMarker(code: string): ArtPalette | null {
  const m = MARKER.exec(code)
  return m ? (m[1].split(',').map(s => s.trim()) as ArtPalette) : null
}

/** An SVG data URL: a composition for `keyword`, `w`×`h`, varied by `seed`. */
export function artImage(keyword: string, w: number, h: number, seed: number, palette: string[]): string {
  // Indexed, not destructured: a compiler helper for destructuring would be a
  // reference outside this body, and the body is all the preview gets.
  const bg = palette[0], surface = palette[1], ink = palette[2], accent = palette[3], second = palette[4]
  let state = 2166136261
  const key = `${String(keyword).toLowerCase()}#${seed}`
  for (let i = 0; i < key.length; i++) state = Math.imul(state ^ key.charCodeAt(i), 16777619) >>> 0
  const rand = () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0
    return ((state ^= state >>> 16) >>> 0) / 4294967296
  }
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]
  const mix = (a: string, b: string, t: number) => {
    const ca = parseInt(a.slice(1), 16)
    const cb = parseInt(b.slice(1), 16)
    const ch = (s: number) => Math.round(((ca >> s) & 255) * (1 - t) + ((cb >> s) & 255) * t)
    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`
  }
  const W = Math.max(40, Math.min(2400, Math.round(w) || 800))
  const H = Math.max(40, Math.min(2400, Math.round(h) || 600))
  const n = (x: number) => Math.round(x * 10) / 10
  const ground = pick([surface, mix(bg, second, 0.25), mix(bg, accent, 0.15), mix(surface, ink, 0.08)])
  const shapes: string[] = []
  const kind = Math.floor(rand() * 5)

  if (kind === 0) {
    // An arch — a doorway or window — with a low sun inside it.
    const aw = W * (0.34 + rand() * 0.22)
    const ax = W * (0.2 + rand() * 0.6) - aw / 2
    const top = H * (0.16 + rand() * 0.14)
    shapes.push(`<path d="M${n(ax)} ${H}V${n(top + aw / 2)}A${n(aw / 2)} ${n(aw / 2)} 0 0 1 ${n(ax + aw)} ${n(top + aw / 2)}V${H}Z" fill="${mix(second, bg, 0.35)}"/>`)
    shapes.push(`<circle cx="${n(ax + aw * (0.3 + rand() * 0.4))}" cy="${n(top + aw * 0.75)}" r="${n(aw * 0.17)}" fill="${accent}"/>`)
    shapes.push(`<rect x="0" y="${n(H * 0.8)}" width="${W}" height="${n(H * 0.2)}" fill="${mix(ground, ink, 0.12)}"/>`)
  } else if (kind === 1) {
    // A horizon: layered bands under a sun.
    const bands = 3 + Math.floor(rand() * 3)
    shapes.push(`<circle cx="${n(W * (0.2 + rand() * 0.6))}" cy="${n(H * (0.3 + rand() * 0.15))}" r="${n(Math.min(W, H) * (0.1 + rand() * 0.08))}" fill="${accent}"/>`)
    for (let i = 0; i < bands; i++) {
      const y = H * (0.45 + (i / bands) * 0.45 + rand() * 0.04)
      const lift = H * (0.04 + rand() * 0.08)
      const cx = W * rand()
      shapes.push(`<path d="M0 ${n(y)}Q${n(cx)} ${n(y - lift * 2)} ${W} ${n(y + lift * (rand() - 0.5))}V${H}H0Z" fill="${mix(second, ink, (i + 1) / (bands + 2))}"/>`)
    }
  } else if (kind === 2) {
    // A still life: vessels standing on a ledge.
    const ledge = H * (0.7 + rand() * 0.1)
    shapes.push(`<rect x="0" y="${n(ledge)}" width="${W}" height="${n(H - ledge)}" fill="${mix(ground, ink, 0.18)}"/>`)
    const count = 2 + Math.floor(rand() * 3)
    let x = W * (0.12 + rand() * 0.1)
    for (let i = 0; i < count && x < W * 0.9; i++) {
      const vw = W * (0.1 + rand() * 0.12)
      const vh = H * (0.22 + rand() * 0.3)
      const fill = pick([accent, second, mix(accent, ink, 0.3), mix(second, bg, 0.3), ink])
      if (rand() < 0.5) shapes.push(`<rect x="${n(x)}" y="${n(ledge - vh)}" width="${n(vw)}" height="${n(vh)}" rx="${n(vw * 0.45)}" fill="${fill}"/>`)
      else shapes.push(`<ellipse cx="${n(x + vw / 2)}" cy="${n(ledge - vh * 0.4)}" rx="${n(vw * 0.6)}" ry="${n(vh * 0.4)}" fill="${fill}"/><rect x="${n(x + vw * 0.3)}" y="${n(ledge - vh)}" width="${n(vw * 0.4)}" height="${n(vh * 0.3)}" fill="${fill}"/>`)
      x += vw + W * (0.04 + rand() * 0.08)
    }
  } else if (kind === 3) {
    // A field of forms: a loose grid of circles and squares, one picked out.
    const cols = 3 + Math.floor(rand() * 3)
    const size = W / (cols + 1)
    const rows = Math.max(2, Math.round(H / size) - 1)
    const lit = Math.floor(rand() * cols * rows)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 1) * (W / (cols + 1))
        const cy = (r + 1) * (H / (rows + 1))
        const s = size * (0.28 + rand() * 0.14)
        const fill = r * cols + c === lit ? accent : mix(second, ground, 0.35 + rand() * 0.3)
        shapes.push(rand() < 0.5 ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(s)}" fill="${fill}"/>` : `<rect x="${n(cx - s)}" y="${n(cy - s)}" width="${n(s * 2)}" height="${n(s * 2)}" fill="${fill}"/>`)
      }
    }
  } else {
    // Overlapping planes and a single line — a quiet abstract.
    for (let i = 0; i < 3; i++) {
      const x = W * rand() * 0.7
      const y = H * rand() * 0.6
      shapes.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(W * (0.3 + rand() * 0.4))}" height="${n(H * (0.3 + rand() * 0.4))}" fill="${pick([second, accent, mix(second, bg, 0.4)])}" fill-opacity="${n(0.55 + rand() * 0.35)}"/>`)
    }
    shapes.push(`<path d="M${n(W * 0.08)} ${n(H * (0.2 + rand() * 0.6))}C${n(W * 0.4)} ${n(H * rand())} ${n(W * 0.6)} ${n(H * rand())} ${n(W * 0.92)} ${n(H * (0.2 + rand() * 0.6))}" fill="none" stroke="${ink}" stroke-width="${n(Math.max(2, W / 200))}" stroke-linecap="round"/>`)
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${ground}"/>${shapes.join('')}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * The keyword, size and lock of a keyword-image URL, or null for any other URL.
 * Self-contained for the same reason as `artImage`.
 */
export function keywordImage(url: string): { keyword: string; w: number; h: number; seed: number } | null {
  const m = /^https?:\/\/loremflickr\.com\/(\d+)\/(\d+)\/([^/?#]+)(?:\/(?:all|any))?(?:\?(?:[^#]*&)?lock=(\d+))?/.exec(url)
  if (!m) return null
  let keyword = m[3]
  try {
    keyword = decodeURIComponent(m[3])
  } catch {
    // keep the raw segment
  }
  return { keyword: keyword.split(',')[0].trim(), w: Number(m[1]), h: Number(m[2]), seed: Number(m[4] || 0) }
}

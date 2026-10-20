/**
 * A zero-token look at the page as it actually rendered, run inside the
 * sandboxed preview: the faults a reader sees but source code can't show.
 *
 * The owner's bar is a first site that impresses; a VLM critic per page (R7)
 * costs quota the free tier doesn't have. Most of what a critic would say about
 * a broken layout is measurable from the rendered DOM: text the reader can't
 * read, a page wider than the window, text sitting on text, screens of empty
 * background. Each finding names its section (the shell wraps every section in
 * `data-section`), so the editor can offer that section's rebuild with the
 * finding as its note — the same path as ai-look.ts.
 *
 * Rules that keep it honest:
 *   - Animations are ignored, not waited for: opacity is not read and the
 *     check runs once things settle, because a ScrollTrigger reveal keeps
 *     content below the fold transparent until it is scrolled to.
 *   - Text over a background image, a gradient or the user's drawing is
 *     skipped for contrast (unknowable from CSS; the drawing has its own halo).
 *
 * `auditPage` and `contrastRatio` are embedded into the preview as source text
 * (`.toString()`), so they stay self-contained: no imports, no outside
 * references, no destructuring.
 */

export interface AuditFinding {
  kind: 'contrast' | 'overflow' | 'overlap' | 'empty' | 'tiny-text'
  /** The section it is in, when known. */
  section: string | null
  /** Plain words, written to the model in a rebuild note. */
  detail: string
}

/** WCAG contrast of two `[r, g, b]` colours (0–255). */
export function contrastRatio(a: number[], b: number[]): number {
  const lum = (c: number[]) => {
    const ch = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])
  }
  const la = lum(a)
  const lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Runs in the frame. `ratio` is `contrastRatio`, passed in because each is embedded on its own. */
export function auditPage(ratio: (a: number[], b: number[]) => number): AuditFinding[] {
  const findings: AuditFinding[] = []
  const seen: Record<string, number> = {}
  const add = (kind: AuditFinding['kind'], el: Element | null, detail: string) => {
    const host = el ? el.closest('[data-section]') : null
    const section = host ? host.getAttribute('data-section') : null
    const key = `${kind}:${section}`
    seen[key] = (seen[key] || 0) + 1
    // One finding of a kind per section is enough for a rebuild note.
    if (seen[key] === 1) findings.push({ kind: kind, section: section, detail: detail })
  }
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight || 800
  const parse = (c: string) => {
    const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(c)
    if (!m) return null
    let alpha = m[4] === undefined ? 1 : parseFloat(m[4])
    if (m[4] && m[4].indexOf('%') > 0) alpha = alpha / 100
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), alpha]
  }
  const shown = (el: Element) => {
    const s = getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden'
  }
  const snippet = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)

  // Elements that carry their own visible text.
  const texts: Array<{ el: Element; rect: DOMRect }> = []
  document.querySelectorAll('body *').forEach(el => {
    if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|TITLE)$/i.test(el.tagName) || el.closest('svg, [aria-hidden="true"], .sr-only')) return
    let own = false
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i]
      if (node.nodeType === 3 && (node.textContent || '').trim().length > 1) own = true
    }
    if (!own || !shown(el)) return
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return
    texts.push({ el: el, rect: rect })
  })

  // 1. Contrast against the colour actually behind the text.
  texts.forEach(t => {
    const s = getComputedStyle(t.el)
    if (s.textShadow && s.textShadow !== 'none') return
    const fg = parse(s.color)
    if (!fg) return
    let bg = [0, 0, 0, 0]
    let unknown = false
    for (let node: Element | null = t.el; node; node = node.parentElement) {
      const ns = getComputedStyle(node)
      if ((ns.backgroundImage && ns.backgroundImage !== 'none') || node.classList.contains('intent-scene') || node.querySelector(':scope > .intent-scene')) {
        unknown = true
        break
      }
      const c = parse(ns.backgroundColor)
      if (c && c[3] > 0) {
        // Composite what has been seen so far over this layer.
        const a = bg[3] + c[3] * (1 - bg[3])
        bg = [0, 1, 2].map(i => (bg[i] * bg[3] + c[i] * c[3] * (1 - bg[3])) / (a || 1)).concat([a])
        if (a > 0.99) break
      }
    }
    if (unknown) return
    if (bg[3] < 0.99) bg = [0, 1, 2].map(i => bg[i] * bg[3] + 255 * (1 - bg[3])).concat([1])
    const text = [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
    const size = parseFloat(s.fontSize) || 16
    const large = size >= 24 || (size >= 18.6 && (parseInt(s.fontWeight, 10) || 400) >= 700)
    const r = ratio(text, bg)
    if (r < (large ? 3 : 4.5) - 0.05) add('contrast', t.el, `text "${snippet(t.el)}" is hard to read (contrast ${r.toFixed(1)}:1 — needs ${large ? 3 : 4.5}:1)`)
    if (size < 12 && snippet(t.el).length > 20) add('tiny-text', t.el, `body text set at ${Math.round(size)}px — use at least 14px`)
  })

  // 2. A page wider than the window (scrolls sideways).
  if (document.documentElement.scrollWidth > vw + 2) {
    const wide = Array.prototype.slice.call(document.querySelectorAll('body *')).find((el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.right > vw + 2 && shown(el)
    }) as Element | undefined
    add('overflow', wide || null, `the page is ${document.documentElement.scrollWidth - vw}px wider than the window — something overflows sideways`)
  }

  // 3. Text drawn over other text.
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]
      const b = texts[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const w = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left)
      const h = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top)
      if (w <= 0 || h <= 0) continue
      const smaller = Math.min(a.rect.width * a.rect.height, b.rect.width * b.rect.height)
      if (w * h > smaller * 0.3) {
        // Either side may be the one out of place: both sections hear about it.
        add('overlap', a.el, `"${snippet(a.el)}" overlaps "${snippet(b.el)}"`)
        if (a.el.closest('[data-section]') !== b.el.closest('[data-section]')) add('overlap', b.el, `"${snippet(b.el)}" overlaps "${snippet(a.el)}"`)
      }
    }
  }

  // 4. Long stretches with nothing on them.
  const content = texts.slice()
  document.querySelectorAll('img, video, canvas, svg, button, input, textarea, iframe').forEach(el => {
    const r = el.getBoundingClientRect()
    if (r.width > 8 && r.height > 8 && shown(el) && !el.closest('.intent-scene')) content.push({ el: el, rect: r })
  })
  content.sort((a, b) => a.rect.top - b.rect.top)
  // The section an empty stretch belongs to is the one spanning its middle —
  // not the next one with content (a collapsed section is the usual cause).
  const spans: Array<{ el: Element; top: number; bottom: number }> = []
  document.querySelectorAll('[data-section]').forEach(marker => {
    let top = Infinity
    let bottom = -Infinity
    for (let i = 0; i < marker.children.length; i++) {
      const r = marker.children[i].getBoundingClientRect()
      top = Math.min(top, r.top)
      bottom = Math.max(bottom, r.bottom)
    }
    if (bottom > top) spans.push({ el: marker, top: top, bottom: bottom })
  })
  let reach = content.length ? content[0].rect.bottom : 0
  for (let i = 1; i < content.length; i++) {
    const gap = content[i].rect.top - reach
    if (gap > vh * 1.1) {
      const middle = reach + gap / 2
      const owner = spans.find(s => s.top <= middle && s.bottom >= middle)
      add('empty', owner ? owner.el : content[i].el, `${Math.round((gap / vh) * 10) / 10} screens with nothing visible on them — something in this section collapsed or is missing`)
    }
    reach = Math.max(reach, content[i].rect.bottom)
  }
  return findings.slice(0, 12)
}

const KINDS = ['contrast', 'overflow', 'overlap', 'empty', 'tiny-text']

/**
 * The frame's report, made safe and grouped into one rebuild note per section.
 * The frame runs model-written code, so nothing in its message is trusted: only
 * this page's own section names, known kinds and short plain text survive.
 */
export function auditBySection(raw: unknown, sections: string[]): Record<string, string> {
  if (!Array.isArray(raw)) return {}
  const grouped: Record<string, AuditFinding[]> = {}
  for (const f of raw.slice(0, 40)) {
    if (!f || typeof f !== 'object') continue
    const { kind, section, detail } = f as Record<string, unknown>
    if (typeof kind !== 'string' || !KINDS.includes(kind)) continue
    if (typeof section !== 'string' || !sections.includes(section)) continue
    if (typeof detail !== 'string' || !detail.trim()) continue
    const clean = detail.replace(/[<>{}`]/g, '').slice(0, 160)
    ;(grouped[section] ??= []).push({ kind: kind as AuditFinding['kind'], section, detail: clean })
  }
  const out: Record<string, string> = {}
  for (const [section, findings] of Object.entries(grouped)) out[section] = auditNote(findings)
  return out
}

// Findings that mean the layout is broken, not just weak: worth a rebuild on
// the audit's own say-so.
const BROKEN = ['overflow', 'overlap', 'empty']

/** Sections whose layout is broken, in the order the audit met them (untrusted input, validated). */
export function brokenSections(raw: unknown, sections: string[]): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const f of raw.slice(0, 40)) {
    if (!f || typeof f !== 'object') continue
    const { kind, section } = f as Record<string, unknown>
    if (typeof kind === 'string' && BROKEN.includes(kind) && typeof section === 'string' && sections.includes(section) && !out.includes(section)) out.push(section)
  }
  return out
}

/** A rebuild note for one section from what the audit found there. */
export function auditNote(findings: AuditFinding[], max = 300): string {
  if (findings.length === 0) return ''
  const order = { overflow: 0, overlap: 1, contrast: 2, empty: 3, 'tiny-text': 4 }
  let note = 'Layout check: '
  for (const f of [...findings].sort((a, b) => order[a.kind] - order[b.kind])) {
    if ((note + f.detail).length > max) break
    note += `${f.detail}; `
  }
  return note.replace(/; $/, '.')
}

import { normalizeImports } from '@/lib/ai/assemble'
import { softenSceneOverlays } from '@/lib/ai/repair'
import { wrapReactForPreview } from '@/lib/utils/sanitize'
import { imageKey } from '@/lib/images/slots'

/**
 * What a user takes away from IntentDraw.
 *
 * Both formats get the same render-time repairs the preview applies, so a
 * download never contains a collision the preview had quietly fixed.
 */

/** "My Tiles Co. — Catalogue" → "my-tiles-co-catalogue". */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents left by NFKD
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'website'
}

/** What a published page says about itself: the site's own name and the brief's one-line summary. */
export interface SiteMeta {
  brand?: string | null
  summary?: string | null
}

/**
 * A single HTML file that runs in any browser: open it, or upload it to any
 * static host. Titled with the site's own name when the brief has one (the
 * project name is the user's working title), with a description and link
 * preview tags from the brief's summary.
 */
export function exportHtml(code: string, projectName: string, appOrigin?: string, meta: SiteMeta = {}): string {
  const brand = typeof meta.brand === 'string' ? meta.brand.trim() : ''
  const summary = typeof meta.summary === 'string' ? meta.summary.trim() : ''
  return wrapReactForPreview(code, { export: { title: brand || projectName, description: summary || undefined }, appOrigin })
}

/**
 * The page as one React component, for a real project. The header says what it
 * needs, because the preview supplies React, Tailwind and GSAP invisibly.
 */
export function exportSource(code: string, projectName: string): string {
  const { code: withPictures, unresolved } = resolvePictures(softenSceneOverlays(normalizeImports(code)))
  const repaired = withPictures.trim()
  const pictures = unresolved.length > 0
    ? ` * Pictures chosen in IntentDraw for URLs the code builds at runtime — map them in:\n${unresolved
        .slice(0, 40)
        .map(([key, url]) => ` *   ${key.replace(/\*\//g, '')}  →  ${url.replace(/\*\//g, '')}`)
        .join('\n')}\n`
    : ''
  const header = `/**
 * ${projectName.replace(/\*\//g, '')} — generated with IntentDraw.
 *
 * A single React component (default export). To use it in a project:
 *   - React 18+ and Tailwind CSS (the page is styled entirely with utility classes)
 *   - npm install gsap lucide-react
 * Any picture still on a keyword URL (loremflickr.com) is a placeholder: swap in your own before publishing.
${pictures} */
`
  return `${header}\n${repaired}\n`
}

// The maps blocks carry: generated pictures (lib/images/slots.ts) and the
// user's own (lib/edit/user-images.ts). Only the preview runtime reads them.
const PICTURE_MAP = /\/\* intentdraw:(site|user)-images \*\/\s*Object\.assign\(\(globalThis\.\w+ = globalThis\.\w+ \|\| \{\}\), (\{[^\n]*\})\);\n?/g
const SAFE_URL = /^https:\/\/[^"'`\s\\<>]+$/

/**
 * The exported source with every picture the preview would show written in:
 * a URL in a plain string becomes its final picture (the user's own first,
 * then the generated one), and the maps — which only IntentDraw's runtime
 * reads — are removed. Pictures for URLs the code builds at runtime can't be
 * written in; they are returned for the header.
 */
export function resolvePictures(code: string): { code: string; unresolved: Array<[string, string]> } {
  const generated: Record<string, string> = {}
  const mine: Record<string, string> = {}
  for (const m of code.matchAll(PICTURE_MAP)) {
    try {
      const map = JSON.parse(m[2]) as Record<string, unknown>
      for (const [key, url] of Object.entries(map)) if (typeof url === 'string' && SAFE_URL.test(url)) (m[1] === 'user' ? mine : generated)[key] = url
    } catch {
      // a malformed map is ignored, as the runtime would
    }
  }
  const all = { ...generated, ...mine }
  if (Object.keys(all).length === 0) return { code, unresolved: [] }
  const used = new Set<string>()
  const pick = (url: string): string | null => {
    const key = imageKey(url)
    const found = mine[url] ?? (key ? mine[key] : undefined) ?? (key ? generated[key] : undefined) ?? generated[url]
    if (!found) return null
    used.add(mine[url] ? url : key ?? url)
    return found
  }
  const out = code
    .replace(PICTURE_MAP, '')
    .replace(/(["'`])(https?:\/\/[^"'`\s$]+)\1/g, (whole, quote: string, url: string) => {
      const found = pick(url)
      return found ? `${quote}${found}${quote}` : whole
    })
  const unresolved = Object.entries(all).filter(([key]) => !used.has(key))
  return { code: out, unresolved }
}

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/**
 * A page that shows a generated site full-window inside a sandboxed frame.
 *
 * SECURITY — a blob: URL made by the app has the app's own origin, so opening
 * the generated page directly as a blob ran model-written JavaScript with
 * access to the app's storage and APIs. The wrapper is inert markup; the site
 * runs only inside `sandbox="allow-scripts"` (an opaque origin), exactly like
 * the editor's preview. Never add allow-same-origin here.
 */
export function sandboxedPage(html: string, title: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(title)}</title>
<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100%}</style></head>
<body><iframe sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms" title="${escapeAttribute(title)}" srcdoc="${escapeAttribute(html)}"></iframe></body></html>`
}

/** Opens the generated site in a new tab, sandboxed (see `sandboxedPage`). */
export function openInNewTab(code: string, projectName: string): void {
  const page = sandboxedPage(exportHtml(code, projectName), projectName)
  const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Starts a browser download of a text file. */
export function downloadFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

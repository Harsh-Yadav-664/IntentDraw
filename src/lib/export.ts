import { normalizeImports } from '@/lib/ai/assemble'
import { softenSceneOverlays } from '@/lib/ai/repair'
import { wrapReactForPreview } from '@/lib/utils/sanitize'

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

/** A single HTML file that runs in any browser: open it, or upload it to any static host. */
export function exportHtml(code: string, projectName: string, appOrigin?: string): string {
  return wrapReactForPreview(code, { export: { title: projectName }, appOrigin })
}

/**
 * The page as one React component, for a real project. The header says what it
 * needs, because the preview supplies React, Tailwind and GSAP invisibly.
 */
export function exportSource(code: string, projectName: string): string {
  const repaired = softenSceneOverlays(normalizeImports(code)).trim()
  const header = `/**
 * ${projectName.replace(/\*\//g, '')} — generated with IntentDraw.
 *
 * A single React component (default export). To use it in a project:
 *   - React 18+ and Tailwind CSS (the page is styled entirely with utility classes)
 *   - npm install gsap lucide-react
 * Photos use keyword URLs (loremflickr.com); swap in your own images before publishing.
 */
`
  return `${header}\n${repaired}\n`
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

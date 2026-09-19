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

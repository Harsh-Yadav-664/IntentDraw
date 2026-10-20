import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { exportHtml, exportSource, sandboxedPage, slugify } from './export'
import { wrapReactForPreview } from './utils/sanitize'

// A page with the collision the render-time repair fixes, so export must fix it too.
const PAGE = `import React from 'react';
import gsap from 'gsap';
import { gsap } from 'gsap';
export default function App() {
  return <main><a href="#about">About</a></main>;
}`

function syntaxErrors(tsx: string): string[] {
  const out = ts.transpileModule(tsx, {
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020 },
    fileName: 'page.tsx',
  })
  return (out.diagnostics ?? []).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('export', () => {
  it('names files after the project', () => {
    expect(slugify('Tiles Co — Catalogue')).toBe('tiles-co-catalogue')
    expect(slugify('Café Été')).toBe('cafe-ete')
    expect(slugify('***')).toBe('website')
  })

  it('exports source that compiles, with the preview’s repairs applied', () => {
    const source = exportSource(PAGE, 'Tiles Co')
    expect(source).toContain('generated with IntentDraw')
    expect(source.match(/from 'gsap'/g)).toHaveLength(1)
    expect(syntaxErrors(source)).toEqual([])
  })

  it('exports a website whose links work, unlike the preview', () => {
    const site = exportHtml(PAGE, 'Tiles <Co>')
    expect(site).toContain('<title>Tiles Co</title>')
    expect(site).not.toContain('e.preventDefault(); e.stopPropagation();')

    const preview = wrapReactForPreview(PAGE)
    expect(preview).toContain('e.preventDefault(); e.stopPropagation();')
  })
})

describe('opening a site in a new tab', () => {
  it('runs the generated page only inside a sandboxed frame', () => {
    const page = sandboxedPage(exportHtml(PAGE, 'Café "Sol" & co'), 'Café "Sol" & co')
    expect(page).toContain('sandbox="allow-scripts')
    expect(page).not.toContain('allow-same-origin')
    // The whole site is one attribute value: no raw quote can end it early.
    const srcdoc = page.slice(page.indexOf('srcdoc="') + 8)
    expect(srcdoc.indexOf('"')).toBe(srcdoc.lastIndexOf('"'))
    // No script runs in the wrapper itself.
    expect(page.slice(0, page.indexOf('srcdoc='))).not.toContain('<script')
  })
})

import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { exportHtml, exportSource, slugify } from './export'
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

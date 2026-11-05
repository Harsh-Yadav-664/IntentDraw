import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { exportHtml, exportSource, resolvePictures, sandboxedPage, slugify } from './export'
import { withImageMap } from '@/lib/images/slots'
import { setUserImage } from '@/lib/edit/user-images'
import { findSyntaxProblem } from '@/lib/ai/validate'
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
    // Escaped, so the name shows as written and can't inject markup.
    expect(site).toContain('<title>Tiles &lt;Co&gt;</title>')
    expect(site).not.toContain('<Co>')
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


const GEN = 'https://x.supabase.co/storage/v1/object/public/site-images/gen/abc.jpg'
const MINE = 'https://x.supabase.co/storage/v1/object/public/site-images/user/u1/me.webp'
const PICTURE_PAGE = `function Hero() {
  const items = [{ k: 'bread', n: 2 }];
  return <section>
    <img src="https://loremflickr.com/800/600/espresso?lock=1" alt="Espresso" />
    <img src="https://loremflickr.com/400/400/croissant?lock=5" alt="Croissant" />
    {items.map(i => <img key={i.k} src={\`https://loremflickr.com/300/200/\${i.k}?lock=\${i.n}\`} alt="" />)}
  </section>
}
export default function App() { return <Hero /> }`

describe('the .tsx export carries the pictures the preview shows', () => {
  const code = setUserImage(withImageMap(PICTURE_PAGE, { '800x600/espresso/1': GEN, '400x400/croissant/5': GEN, '300x200/bread/2': GEN }), '800x600/espresso/1', MINE)

  it('writes the final picture into plain URLs (the user own first) and drops the maps', () => {
    const { code: out, unresolved } = resolvePictures(code)
    expect(out).toContain(`src="${MINE}" alt="Espresso"`)
    expect(out).toContain(`src="${GEN}" alt="Croissant"`)
    expect(out).not.toMatch(/intentdraw:(site|user)-images|__intentdraw/)
    expect(findSyntaxProblem(out)).toBeNull()
    // Built at runtime from the item: listed, not rewritten.
    expect(unresolved).toEqual([['300x200/bread/2', GEN]])
  })

  it('lists the runtime-built ones in the header, and leaves a page with no pictures alone', () => {
    const out = exportSource(code, 'Cafe')
    expect(out).toMatch(/300x200\/bread\/2 {2}→ {2}https:\/\/x\.supabase\.co/)
    expect(resolvePictures(PICTURE_PAGE)).toEqual({ code: PICTURE_PAGE, unresolved: [] })
  })
})

describe('a published page says what it is', () => {
  const page = 'export default function App() { return <h1>Hi</h1> }'

  it('is titled with the site name and carries a description and link-preview tags', () => {
    const html = exportHtml(page, 'cafe test 3', undefined, { brand: 'Marrow & Ash', summary: 'A twelve-seat wood-fire kitchen in Porto. "Book" tonight <now>.' })
    expect(html).toContain('<title>Marrow &amp; Ash</title>')
    expect(html).toContain('<meta name="description" content="A twelve-seat wood-fire kitchen in Porto. &quot;Book&quot; tonight &lt;now&gt;.">')
    expect(html).toContain('<meta property="og:title" content="Marrow &amp; Ash">')
    expect(html).toContain('<meta property="og:description"')
  })

  it('falls back to the project name, and the editor preview carries none of it', () => {
    expect(exportHtml(page, 'Tiles Co')).toContain('<title>Tiles Co</title>')
    expect(exportHtml(page, 'Tiles Co')).not.toContain('name="description"')
    expect(wrapReactForPreview(page)).not.toContain('og:title')
  })
})

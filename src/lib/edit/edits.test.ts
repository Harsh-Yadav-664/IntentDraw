import { describe, expect, it } from 'vitest'
import { findSyntaxProblem } from '@/lib/ai/validate'
import { assembleParts, replaceSection, type PageParts } from '@/lib/ai/page-parts'
import { applyPageEdit, applyTextEdit, cleanEditText, visibleText } from './edits'
import { setUserImage, userImagesOf, withUserImages, withoutUserImages } from './user-images'

const HERO = `function Hero() {
  const stats = [{ label: 'Peaks guided', value: '140+' }, { label: 'Book now', value: 'Seasons' }];
  return (
    <section className="min-h-screen px-16">
      <h1 className="font-display text-7xl">
        Silence at
        High Altitudes
      </h1>
      <p>Small groups &amp; slow days. <b>Since 2009</b> in the Alps.</p>
      <img src="https://loremflickr.com/1200/800/glacier?lock=3" alt="A glacier at dawn" />
      {stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
      <a href="#book" className="Book now">Book now</a>
      <p>{\`Season \${2026}\`}</p>
    </section>
  );
}`

describe('applyTextEdit — the words the user clicked, changed in the source', () => {
  it('rewrites JSX text that spans lines, the way it renders', () => {
    const r = applyTextEdit(HERO, 'Silence at High Altitudes', 'Quiet above the clouds')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.code).toContain('{"Quiet above the clouds"}')
    expect(r.code).not.toContain('High Altitudes')
    expect(findSyntaxProblem(r.code)).toBeNull()
  })

  it('reads entities as the reader sees them and keeps the spaces around a piece', () => {
    const r = applyTextEdit(HERO, 'Small groups & slow days.', 'Groups of six.')
    expect(r.ok && r.code).toContain('<p>{"Groups of six."} <b>Since 2009</b>')
    const tail = applyTextEdit(HERO, 'in the Alps.', 'in the Dolomites.')
    expect(tail.ok && tail.code).toContain('</b> {"in the Dolomites."}</p>')
  })

  it('changes words that live in a data array, never the object key or a class name', () => {
    const r = applyTextEdit(HERO, 'Peaks guided', 'Summits led')
    expect(r.ok && r.code).toContain(`{ label: "Summits led", value: '140+' }`)
    // "Book now" is a label in the data AND a link: occurrence picks which; className is never a candidate.
    const second = applyTextEdit(HERO, 'Book now', 'Reserve', 1)
    expect(second.ok && second.matches).toBe(2)
    expect(second.ok && second.code).toContain('className="Book now">{"Reserve"}</a>')
  })

  it('edits a visible attribute (alt) but wraps it so JSX stays valid', () => {
    const r = applyTextEdit(HERO, 'A glacier at dawn', 'The "north" face')
    expect(r.ok && r.code).toContain('alt={"The \\"north\\" face"}')
    expect(r.ok && findSyntaxProblem(r.code)).toBeNull()
  })

  it('says not-found for words built at runtime, so the caller can offer a rebuild', () => {
    expect(applyTextEdit(HERO, 'Season 2026', 'Season 2027')).toEqual({ ok: false, reason: 'not-found' })
    expect(applyTextEdit(HERO, 'Nothing like this', 'x')).toEqual({ ok: false, reason: 'not-found' })
    expect(applyTextEdit(HERO, 'Book now', 'Book now')).toEqual({ ok: false, reason: 'unchanged' })
  })

  it('writes typed text safely: one line, no control characters, capped, quotes escaped', () => {
    expect(cleanEditText('  a\n\tb\u0000c  ')).toBe('a b c')
    expect(cleanEditText('x'.repeat(5000))).toHaveLength(600)
    const r = applyTextEdit(HERO, 'Since 2009', '</script><img onerror=alert(1)> {evil} `x` ${y}')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(findSyntaxProblem(r.code)).toBeNull()
    expect(r.code).toContain('<b>{"</script><img onerror=alert(1)> {evil} `x` ${y}"}</b>')
  })

  it('normalises whitespace and entities like the frame does', () => {
    expect(visibleText('\n   Hello  &amp;   you  ')).toBe('Hello & you')
  })
})

describe('user pictures — a map, never a rewrite of the model code', () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/site-images/user/u1/abc.webp'

  it('adds, merges, replaces and removes the map', () => {
    const one = setUserImage(HERO, '1200x800/glacier/3', url)
    expect(userImagesOf(one)).toEqual({ '1200x800/glacier/3': url })
    const two = setUserImage(one, 'https://images.unsplash.com/photo-1', url)
    expect(Object.keys(userImagesOf(two))).toHaveLength(2)
    expect(two.match(/intentdraw:user-images/g)).toHaveLength(1)
    expect(withoutUserImages(two).trim()).toBe(HERO.trim())
    expect(findSyntaxProblem(two)).toBeNull()
  })

  it('drops anything that could break out of the statement', () => {
    expect(userImagesOf(withUserImages(HERO, { '1200x800/glacier/3': 'javascript:alert(1)' }))).toEqual({})
    expect(userImagesOf(withUserImages(HERO, { 'a"b': url }))).toEqual({})
    expect(userImagesOf(withUserImages(HERO, { '1200x800/glacier/3': 'https://x.co/a b' }))).toEqual({})
  })
})

describe('applyPageEdit on page parts', () => {
  const parts: PageParts = {
    shellCode: 'export default function App() { return <main><Hero /><Footer /></main> }',
    sceneCode: null,
    tokenId: 'neosleek',
    brief: null,
    regions: [],
    groups: [],
    prompt: 'a guide company',
    sections: ['Hero', 'Footer'],
    blocks: [
      { sections: ['Hero'], code: HERO },
      { sections: ['Footer'], code: 'function Footer() { return <footer><p>Since 2009</p><p>Alpine Guides</p></footer> }' },
    ],
    failed: [],
  }

  it('changes only the clicked section, and the page still assembles and compiles', () => {
    const r = applyPageEdit(parts, '', { kind: 'text', section: 'Footer', before: 'Since 2009', after: 'Since 2010' })
    expect(r.ok).toBe(true)
    if (!r.ok || !r.parts) return
    expect(r.parts.blocks[0].code).toBe(HERO)
    expect(r.parts.blocks[1].code).toContain('{"Since 2010"}')
    const page = assembleParts(r.parts).code
    expect(page && findSyntaxProblem(page)).toBeNull()
  })

  it('falls back to the other blocks for text the section did not write itself', () => {
    const r = applyPageEdit(parts, '', { kind: 'text', section: 'Footer', before: 'Peaks guided', after: 'Summits' })
    expect(r.ok && r.parts?.blocks[0].code).toContain('"Summits"')
  })

  it('edits the page code directly for an older project without parts', () => {
    const r = applyPageEdit(null, HERO, { kind: 'text', section: null, before: 'Since 2009', after: 'Est. 2009' })
    expect(r.ok && r.code).toContain('{"Est. 2009"}')
  })

  it('refuses unsafe picture URLs', () => {
    expect(applyPageEdit(parts, '', { kind: 'image', section: 'Hero', key: '1200x800/glacier/3', url: 'http://plain.example/a.jpg' })).toEqual({ ok: false, reason: 'unsafe' })
  })

  it('keeps the user pictures when the section is rebuilt', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/site-images/user/u1/abc.webp'
    const r = applyPageEdit(parts, '', { kind: 'image', section: 'Hero', key: '1200x800/glacier/3', url })
    expect(r.ok).toBe(true)
    if (!r.ok || !r.parts) return
    const rebuilt = replaceSection(r.parts, 'Hero', 'function Hero() { return <section><img src="https://loremflickr.com/1200/800/glacier?lock=3" alt="" /></section> }')
    expect(userImagesOf(rebuilt.blocks[0].code)).toEqual({ '1200x800/glacier/3': url })
  })
})

describe('putting the original picture back', () => {
  it('removes just that override', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/site-images/user/u1/abc.webp'
    const code = setUserImage(setUserImage(HERO, '1200x800/glacier/3', url), 'https://a.example/b.jpg', url)
    const r = applyPageEdit(null, code, { kind: 'image', section: null, key: '1200x800/glacier/3', url: '' })
    expect(r.ok && userImagesOf(r.code)).toEqual({ 'https://a.example/b.jpg': url })
    expect(applyPageEdit(null, HERO, { kind: 'image', section: null, key: '1200x800/glacier/3', url: '' })).toEqual({ ok: false, reason: 'not-found' })
  })
})

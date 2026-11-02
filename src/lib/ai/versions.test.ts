import { describe, expect, it } from 'vitest'
import { replaceSection, type PageParts } from './page-parts'
import {
  addVersion,
  authors,
  builtByLine,
  cleanPreferenceRecord,
  makeVersion,
  MAX_VERSIONS,
  preferenceRecord,
  summarizePreferences,
  withBlockCode,
} from './versions'

const shell = `import React from 'react';
export default function App() {
  return <div><Nav /><Hero /><Footer /></div>;
}`

function parts(overrides: Partial<PageParts> = {}): PageParts {
  return {
    shellCode: shell,
    sceneCode: null,
    tokenId: 'editorial',
    brief: null,
    regions: [],
    groups: [],
    prompt: 'a coffee roaster in Pune',
    sections: ['Nav', 'Hero', 'Footer'],
    blocks: [
      { sections: ['Hero'], code: `const Hero = () => <section>first hero</section>;`, provider: 'gemini', model: 'gemini-3.6-flash' },
      { sections: ['Nav', 'Footer'], code: `const Nav = () => <nav>n</nav>;\nconst Footer = () => <footer>f</footer>;`, provider: 'groq', model: 'openai/gpt-oss-120b' },
    ],
    failed: [],
    ...overrides,
  }
}

describe('makeVersion / addVersion', () => {
  it('keeps the assembled page with its parts', () => {
    const v = makeVersion('run', 'Finished run', parts(), 1000)!
    expect(v.code).toContain('first hero')
    expect(v.parts.prompt).toBe('a coffee roaster in Pune')
  })

  it('does not add the same page twice — showing an old version must not duplicate it', () => {
    const p = parts()
    const list = addVersion([], makeVersion('run', 'Finished run', p))
    expect(addVersion(list, makeVersion('earlier', 'Before Hero was rebuilt', p))).toBe(list)
  })

  it('drops the oldest past the cap, but keeps the first finished run', () => {
    let list = addVersion([], makeVersion('run', 'Finished run', parts()))
    for (let i = 0; i < MAX_VERSIONS + 3; i++) {
      list = addVersion(list, makeVersion('rebuild', `r${i}`, replaceSection(parts(), 'Hero', `const Hero = () => <section>hero ${i}</section>;`)))
    }
    expect(list).toHaveLength(MAX_VERSIONS)
    expect(list[0].label).toBe('Finished run')
    expect(list.at(-1)!.label).toBe(`r${MAX_VERSIONS + 2}`)
  })
})

describe('authors', () => {
  it('names the model behind each section in page order', () => {
    expect(authors(parts())).toEqual([
      { section: 'Nav', provider: 'groq', model: 'openai/gpt-oss-120b' },
      { section: 'Hero', provider: 'gemini', model: 'gemini-3.6-flash' },
      { section: 'Footer', provider: 'groq', model: 'openai/gpt-oss-120b' },
    ])
    expect(builtByLine(parts())).toBe('openai/gpt-oss-120b, gemini-3.6-flash')
  })
})

describe('withBlockCode', () => {
  it('rebuilds the page a discarded answer would have made, by the block it belonged to', () => {
    const p = withBlockCode(parts(), ['Hero'], `const Hero = () => <section>draft hero</section>;`, { model: 'gemini-3.5-flash' })!
    expect(makeVersion('first-answer', 'x', p)!.code).toContain('draft hero')
    expect(p.blocks[0].model).toBe('gemini-3.5-flash')
  })

  it('returns null for a block the page no longer has', () => {
    expect(withBlockCode(parts(), ['Pricing'], 'const Pricing = () => null;')).toBeNull()
  })
})

describe('preferenceRecord', () => {
  const finished = makeVersion('run', 'Finished run', parts(), 1)!
  const fixed = makeVersion(
    'auto-fix',
    'Hero rebuilt by the layout check',
    replaceSection(parts(), 'Hero', `const Hero = () => <section>fixed hero</section>;`, { provider: 'groq', model: 'openai/gpt-oss-120b' }),
    2
  )!

  it('records only the sections that differ, with the model on each side', () => {
    const record = preferenceRecord(finished, [finished, fixed], { projectId: 'p1', providerChoice: 'auto', at: new Date(0) })
    expect(record.contested).toEqual([{ section: 'Hero', preferred: 'gemini-3.6-flash', over: 'openai/gpt-oss-120b', overKind: 'auto-fix' }])
    expect(record.preferred.kind).toBe('run')
    expect(record.others.map(o => o.kind)).toEqual(['auto-fix'])
    expect(record.prompt).toBe('a coffee roaster in Pune')
  })

  it('survives the trip through the server unchanged, and rejects junk', () => {
    const record = preferenceRecord(finished, [finished, fixed], { projectId: 'p1', providerChoice: 'auto', at: new Date(0) })
    expect(cleanPreferenceRecord(JSON.parse(JSON.stringify(record)))).toEqual(record)
    expect(cleanPreferenceRecord('nope')).toBeNull()
    expect(cleanPreferenceRecord({ preferred: { kind: 'evil', label: 7 }, contested: [{ section: 'x'.repeat(500) }] })).toMatchObject({
      preferred: { kind: 'run', label: '' },
      contested: [{ section: 'x'.repeat(80), preferred: 'unknown', over: 'unknown', overKind: 'run' }],
    })
  })
})

describe('summarizePreferences', () => {
  it('tallies wins and losses per model, ignoring same-model comparisons', () => {
    const summary = summarizePreferences([
      { contested: [{ section: 'Hero', preferred: 'a', over: 'b', overKind: 'auto-fix' }] },
      { contested: [{ section: 'Hero', preferred: 'a', over: 'c', overKind: 'run' }, { section: 'Nav', preferred: 'b', over: 'b', overKind: 'rebuild' }] },
    ])
    expect(summary).toEqual([
      { model: 'a', wins: 2, losses: 0 },
      { model: 'b', wins: 0, losses: 1 },
      { model: 'c', wins: 0, losses: 1 },
    ])
  })
})

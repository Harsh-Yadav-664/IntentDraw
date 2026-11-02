import { describe, expect, it } from 'vitest'
import { aiLookNote, fixAiLook, scanAiLook } from './ai-look'
import { findSyntaxProblem } from './validate'
import { MAX_SECTION_NOTE_CHARS } from './page-parts'

const ids = (code: string) => scanAiLook(code).map(t => t.id)

describe('scanAiLook', () => {
  it('finds the purple-to-blue gradient and gradient text', () => {
    const code = `const Hero = () => <section className="bg-gradient-to-r from-purple-600 to-blue-500"><h1 className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500">Hi</h1></section>`
    expect(ids(code)).toEqual(expect.arrayContaining(['C1', 'C6']))
  })

  it('treats placeholder names as P0 — the owner rules them out on any site', () => {
    const tells = scanAiLook(`const T = () => <p>— Jane Doe, Founder</p>`)
    expect(tells).toEqual([expect.objectContaining({ id: 'IM4', severity: 'P0' })])
  })

  it('treats a template headline as P0 — it is the first thing a visitor reads', () => {
    const tells = scanAiLook('<h1 className="font-display text-7xl">Welcome to<br /> {"Casa del Sol"}</h1>')
    expect(tells.find(t => t.id === 'CP2')).toMatchObject({ severity: 'P0', what: 'a template headline ("Welcome to Casa del Sol")' })
    expect(ids('<h2>Where <span>craft</span> meets code</h2>')).toContain('CP2')
    expect(ids('<h1>Tacos al pastor, carved off the trompo since 1987</h1><p>Welcome to the family.</p>')).not.toContain('CP2')
  })

  it('counts patterns before calling them a habit', () => {
    const card = `<div className="rounded-2xl shadow-xl p-6">x</div>`
    expect(ids(`const A = () => <div>${card}${card}</div>`)).not.toContain('K2')
    expect(ids(`const A = () => <div>${card}${card}${card}</div>`)).toContain('K2')
  })

  it('finds vague marketing copy and emoji bullets', () => {
    expect(ids(`const H = () => <h1>Unleash your creative vision</h1>`)).toContain('CP1')
    expect(ids(`const L = () => <ul><li>🚀 Fast</li><li>✨ Pretty</li></ul>`)).toContain('I2')
  })

  it('leaves a plain, specific section alone', () => {
    const code = `const Menu = () => <section className="py-20 bg-[#f4efe6]"><h2 className="font-display text-5xl">Saturday bread, from 7am</h2><p>Rye, spelt and a seeded loaf that sells out by ten.</p></section>`
    expect(scanAiLook(code)).toEqual([])
  })
})

describe('fixAiLook', () => {
  it('turns gradient text solid and smooths bouncy easing, and the code still compiles', () => {
    const code = `import gsap from 'gsap'
const Hero = () => {
  React.useEffect(() => { gsap.from('.x', { y: 20, ease: 'bounce.out' }) }, [])
  return <h1 className="text-6xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 font-display">Hi</h1>
}`
    const { code: out, fixed } = fixAiLook(code)
    expect(fixed).toEqual(['C6', 'M4'])
    expect(out).toContain('className="text-6xl font-display"')
    expect(out).toContain(`ease: 'power3.out'`)
    expect(findSyntaxProblem(out)).toBeNull()
    expect(scanAiLook(out).map(t => t.id)).not.toContain('C6')
  })

  it('does not touch a gradient background that is not text', () => {
    const code = `const B = () => <div className="bg-gradient-to-r from-[#111] to-[#333]">x</div>`
    expect(fixAiLook(code)).toEqual({ code, fixed: [] })
  })
})

describe('aiLookNote', () => {
  it('puts the worst first and fits a section note', () => {
    const tells = scanAiLook(`const P = () => <div><h1>Elevate your brand seamlessly</h1><p>Jane Doe</p><a>Learn more</a><a>Get started</a></div>`)
    const note = aiLookNote(tells)
    expect(note.indexOf('placeholder')).toBeLessThan(note.indexOf('vague'))
    expect(note.length).toBeLessThanOrEqual(MAX_SECTION_NOTE_CHARS)
    expect(aiLookNote([])).toBe('')
  })
})

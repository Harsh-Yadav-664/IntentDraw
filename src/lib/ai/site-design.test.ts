import { describe, expect, it } from 'vitest'
import { designTokens, enforceDesign, freshDesign, normalizeDesign, type SiteDesign } from './site-design'
import { FONTS } from '@/lib/design/fonts'
import { UNDERSTAND_SYSTEM_PROMPT, buildUnderstandUserMessage, normalizeBrief } from './brief'
import { parseRecentDesigns } from './recent-designs'

const SHARP: SiteDesign = {
  displayFont: 'Fraunces',
  bodyFont: 'Manrope',
  corners: 'sharp',
  surfaces: 'outlined',
  density: 'airy',
  headings: 'editorial',
}

describe('normalizeDesign', () => {
  it('keeps a valid design, matching font names loosely', () => {
    const d = normalizeDesign({ ...SHARP, displayFont: 'fraunces', bodyFont: 'manrope' }, 'p', 'neosleek')
    expect(d).toEqual(SHARP)
  })

  it('replaces an unknown or generic font with one from the style', () => {
    const d = normalizeDesign({ displayFont: 'Inter', bodyFont: 'Roboto' }, 'a pottery studio', 'elegant_serif')
    expect(FONTS[d.displayFont].character).toBe('editorial-serif')
    expect(FONTS[d.bodyFont].body).toBe(true)
    expect(d.bodyFont).not.toBe(d.displayFont)
    expect(d.corners).toBe('subtle')
  })

  it('never uses a heading-only face for body text', () => {
    const d = normalizeDesign({ ...SHARP, bodyFont: 'Bebas Neue' }, 'p', 'neosleek')
    expect(FONTS[d.bodyFont].body).toBe(true)
  })

  it('is stable for one prompt and varies across prompts', () => {
    expect(normalizeDesign({}, 'same prompt', 'neosleek')).toEqual(normalizeDesign({}, 'same prompt', 'neosleek'))
    const faces = new Set(Array.from({ length: 12 }, (_, i) => normalizeDesign({}, `prompt ${i}`, 'neosleek').displayFont))
    expect(faces.size).toBeGreaterThan(2)
  })
})

describe('freshDesign', () => {
  it('swaps a display face the user used recently, keeping its character', () => {
    const d = freshDesign(SHARP, [{ ...SHARP, corners: 'pill' }], 'seed')
    expect(d.displayFont).not.toBe('Fraunces')
    expect(FONTS[d.displayFont].character).toBe('editorial-serif')
    expect(d.corners).toBe('sharp')
  })

  it('leaves a design alone when nothing repeats', () => {
    expect(freshDesign(SHARP, [{ ...SHARP, displayFont: 'Syne' }], 'seed')).toBe(SHARP)
  })
})

describe('designTokens', () => {
  it('turns choices into concrete rules and bans', () => {
    const t = designTokens(SHARP, 'elegant_serif')
    expect(t.id).toBe('elegant_serif')
    expect(t.bannedClasses).toEqual(expect.arrayContaining(['rounded-xl', 'rounded-full', 'shadow-lg', 'font-sans', 'font-mono']))
    expect(t.typography).toContain('"Fraunces"')
    expect(t.typography).toContain('font-display')
    expect(t.borderRadius).toMatch(/rounded-none/)
  })
})

describe('enforceDesign', () => {
  it('strips rounding from a sharp design, with variants and arbitrary values', () => {
    const code = `<div className="p-4 rounded-xl hover:rounded-lg md:rounded-[20px] rounded-none bg-black">x</div>`
    expect(enforceDesign(code, SHARP)).toBe(`<div className="p-4 rounded-none bg-black">x</div>`)
  })

  it('strips font family classes on every design', () => {
    const code = `<p className="font-mono text-sm">a</p>`
    expect(enforceDesign(code, { ...SHARP, corners: 'pill' })).toBe(`<p className="text-sm">a</p>`)
  })

  it('removes drop shadows on an outlined design but keeps text shadows and shadow-none', () => {
    const code = `<h1 className="shadow-lg drop-shadow-md shadow-none">t</h1>`
    expect(enforceDesign(code, SHARP)).toBe(`<h1 className="drop-shadow-md shadow-none">t</h1>`)
  })

  it('removes arbitrary shadows only on a flat design', () => {
    const code = `<div className="shadow-[0_0_40px_#f00]">t</div>`
    expect(enforceDesign(code, { ...SHARP, surfaces: 'flat' })).toBe(`<div className="">t</div>`)
    expect(enforceDesign(code, { ...SHARP, surfaces: 'hard-shadow' })).toBe(code)
  })

  it('handles expressions inside className and leaves the rest of the code alone', () => {
    const code = [
      "const label = 'rounded-xl font-mono'",
      'const C = ({ on }) => <a className={`px-2 rounded-lg ${on ? \'rounded-full\' : \'bg-x\'}`}>font-mono</a>',
    ].join('\n')
    const out = enforceDesign(code, SHARP)
    expect(out).toContain("const label = 'rounded-xl font-mono'")
    expect(out).toContain('>font-mono</a>')
    expect(out).toContain("className={`px-2 ${on ? '' : 'bg-x'}`}")
  })

  it('never merges two classes joined with +', () => {
    const code = `<a className={'px-2 rounded-lg ' + extra}>x</a>`
    expect(enforceDesign(code, SHARP)).toBe(`<a className={'px-2 ' + extra}>x</a>`)
  })
})

describe('the brief carries a design', () => {
  it('normalizes the design inside a brief', () => {
    const brief = normalizeBrief({ styleId: 'neosleek', design: SHARP }, [], 'a studio')
    expect(brief.design).toEqual(SHARP)
  })

  it('gives a brief without one a valid design', () => {
    const brief = normalizeBrief({}, [], 'a bakery in Lisbon')
    expect(FONTS[brief.design.displayFont]).toBeDefined()
  })

  it("shows the agent the product principle, the font menu and the user's recent designs", () => {
    expect(UNDERSTAND_SYSTEM_PROMPT).toContain('Every site is one of a kind')
    expect(UNDERSTAND_SYSTEM_PROMPT).toContain('Bricolage Grotesque')
    expect(UNDERSTAND_SYSTEM_PROMPT).not.toMatch(/\bInter\b|Roboto|Poppins/)
    const message = buildUnderstandUserMessage('a studio', [], [], false, [SHARP])
    expect(message).toContain("RECENT SITES")
    expect(message).toContain('Fraunces + Manrope')
  })
})

describe('parseRecentDesigns', () => {
  it('keeps only saved designs that name a real typeface', () => {
    const rows = [{ design: SHARP }, { design: null }, { design: { displayFont: 'Comic Sans' } }, {}]
    expect(parseRecentDesigns(rows)).toEqual([SHARP])
  })
})

describe('template chrome', () => {
  it('turns tracked-out ALL-CAPS small labels back into plain labels', () => {
    const code = `<p className="text-xs uppercase tracking-widest text-[#00C4CC]">Exhibition registry</p>`
    expect(enforceDesign(code, { ...SHARP, corners: 'pill' })).toBe(`<p className="text-xs text-[#00C4CC]">Exhibition registry</p>`)
  })

  it('leaves uppercase headings alone', () => {
    const code = `<h1 className="text-8xl uppercase tracking-tight">Initiate</h1>`
    expect(enforceDesign(code, { ...SHARP, corners: 'pill' })).toBe(code)
  })
})

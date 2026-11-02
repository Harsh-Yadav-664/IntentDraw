import { describe, expect, it } from 'vitest'
import { lintLayout } from './layout-lint'
import { findSyntaxProblem } from './validate'

const wrap = (jsx: string) => `export const Section = ({ isEven }: { isEven: boolean }) => (\n${jsx}\n);`

describe('grid rows that add up to more columns than the grid has', () => {
  it('fixes the travel run: 7 + 6 in a 12-column grid, the card wrapping under every image', () => {
    const code = wrap(`<div className="expedition-card relative grid grid-cols-1 md:grid-cols-12 items-center">
  <div className={\`md:col-span-7 relative z-0 \${isEven ? 'md:order-1' : 'md:order-2'}\`}><img src="a.jpg" /></div>
  <div className={\`md:col-span-6 relative z-10 \${isEven ? 'md:order-2 md:-ml-16' : 'md:order-1 md:-mr-16'}\`}><p>Card</p></div>
</div>`)
    const { code: out, fixes } = lintLayout(code)
    expect(fixes).toHaveLength(1)
    expect(out).toContain('`md:col-span-6 relative z-0 ')
    expect(out).toContain('`md:col-span-6 relative z-10 ')
    expect(findSyntaxProblem(out)).toBeNull()
  })

  it('takes the excess from the widest items', () => {
    const code = wrap(`<div className="grid lg:grid-cols-12"><div className="lg:col-span-5" /><div className="lg:col-span-4" /><div className="lg:col-span-4" /></div>`)
    expect(lintLayout(code).code).toContain('"lg:col-span-4" /><div className="lg:col-span-4" /><div className="lg:col-span-4"')
  })

  it('leaves layouts that are meant to wrap, or that it cannot know, alone', () => {
    const cases = [
      // Fits.
      `<div className="grid md:grid-cols-12"><div className="md:col-span-7" /><div className="md:col-span-5" /></div>`,
      // Two full rows on purpose.
      `<div className="grid md:grid-cols-12"><div className="md:col-span-8" /><div className="md:col-span-8" /></div>`,
      // Placed by hand.
      `<div className="grid md:grid-cols-12"><div className="md:col-span-7 md:col-start-1" /><div className="md:col-span-6 md:col-start-6" /></div>`,
      // Generated children: the count isn't known.
      `<div className="grid md:grid-cols-12">{[1, 2].map(i => <div key={i} className="md:col-span-7" />)}</div>`,
      // Branches disagree.
      `<div className="grid md:grid-cols-12"><div className={isEven ? 'md:col-span-7' : 'md:col-span-5'} /><div className="md:col-span-6" /></div>`,
      // Not a grid.
      `<div className="flex"><div className="md:col-span-7" /><div className="md:col-span-6" /></div>`,
    ]
    for (const jsx of cases) {
      const code = wrap(jsx)
      expect(lintLayout(code)).toEqual({ code, fixes: [] })
    }
  })

  it('only judges the breakpoint where the grid declares its columns', () => {
    // At md the grid has 12 columns and 7 + 6 overflows; at lg it has 14 and fits.
    const code = wrap(`<div className="grid md:grid-cols-12 lg:grid-cols-14"><div className="md:col-span-7" /><div className="md:col-span-6" /></div>`)
    expect(lintLayout(code).fixes).toHaveLength(1)
  })

  it('returns code it cannot parse untouched', () => {
    expect(lintLayout('const x = (')).toEqual({ code: 'const x = (', fixes: [] })
  })
})

describe('a fill that collapses', () => {
  it('gives h-full inside a min-h-screen section the section height — the Wilder House photo rendered 0px tall', () => {
    const code = `const RetreatPhoto = () => (
  <section className="relative min-h-screen py-16 flex items-center">
    <div className="relative w-full h-full mx-auto">
      <div className="lg:absolute lg:left-[6.5%] lg:top-[15.6%] lg:w-[39%] lg:h-[59.4%]"><img className="w-full h-full object-cover" src="x" alt="" /></div>
    </div>
  </section>
);`
    const out = lintLayout(code)
    expect(out.code).toContain('className="relative w-full min-h-[inherit] mx-auto"')
    expect(out.code).toContain('className="w-full h-full object-cover"') // deeper fills are fine once the parent has a height
    expect(findSyntaxProblem(out.code)).toBeNull()
  })

  it('leaves a section that has a real height alone', () => {
    const code = `const A = () => <section className="h-screen min-h-screen"><div className="h-full">x</div></section>;`
    expect(lintLayout(code).fixes).toEqual([])
  })
})

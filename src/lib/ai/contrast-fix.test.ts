import { describe, expect, it } from 'vitest'
import { fixContrast } from './contrast-fix'

describe('fixContrast', () => {
  it('swaps white-on-orange button text for the palette ink', () => {
    // The real run: every button white on #FF6F00, 2.6:1.
    const { code, fixes } = fixContrast(
      `<button className="bg-[#FF6F00] text-white px-6 py-3 rounded-[10px]">Book Now</button>`,
      ['#2E2E2E', '#FFF5E1']
    )
    expect(code).toBe(`<button className="bg-[#FF6F00] text-[#2E2E2E] px-6 py-3 rounded-[10px]">Book Now</button>`)
    expect(fixes[0]).toMatch(/#FFFFFF on #FF6F00 \(2\.\d:1\) → #2E2E2E/)
  })

  it('holds large text to 3:1, not 4.5:1', () => {
    // White on #E0583A is ~3.7:1: fails as body text, passes as a heading.
    expect(fixContrast(`<h2 className='bg-[#E0583A] text-white text-5xl'>A</h2>`).fixes).toHaveLength(0)
    expect(fixContrast(`<p className='bg-[#E0583A] text-white text-sm'>A</p>`).fixes).toHaveLength(1)
  })

  it('leaves passing pairs, variants and translucent colours alone', () => {
    const fine = [
      `<a className="bg-[#1B1B1B] text-white">x</a>`,
      `<a className="hover:bg-[#FF6F00] text-white">x</a>`,
      `<a className="bg-[#FF6F00]/40 text-white">x</a>`,
      `<a className="bg-[#FF6F00] md:text-white">x</a>`,
      `<a className={\`bg-[#FF6F00] text-white \${x}\`}>x</a>`,
    ]
    for (const code of fine) expect(fixContrast(code).code).toBe(code)
  })

  it('falls back to white or near-black when the palette has no ink that passes', () => {
    const { code } = fixContrast(`<span className="bg-[#0A2A6B] text-[#334]">x</span>`, ['#223', '#112'])
    expect(code).toContain('text-white')
  })
})

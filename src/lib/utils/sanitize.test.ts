import { describe, expect, it } from 'vitest'
import { wrapReactForPreview } from './sanitize'

describe('preview runtime robustness', () => {
  const html = wrapReactForPreview(`export default function App() { return <h1>Hi</h1> }`)

  it('loads the GSAP plugins models use — a missing ScrollToPlugin once blanked a whole page', () => {
    for (const plugin of ['ScrollTrigger', 'ScrollToPlugin', 'TextPlugin', 'SplitText', 'Observer', 'Flip']) {
      expect(html).toContain(`gsap/3.15.0/${plugin}.min.js`)
      if (plugin !== 'ScrollTrigger') expect(html).toContain(`'gsap/${plugin}': null`)
    }
  })

  it('turns imports from unsupported libraries into stand-ins instead of crashing', () => {
    expect(html).toContain('window.__intentdrawStub = function(name)')
    expect(html).toContain("t.identifier('__intentdrawStub')")
    // ...and framer-motion into plain elements.
    expect(html).toContain("'framer-motion': '__intentdrawMotion'")
  })

  it('tells drawn animation loops when the page is frozen as the editor backdrop', () => {
    expect(wrapReactForPreview('export default function App() { return null }', { freeze: true })).toContain('window.__intentdrawFrozen = true')
  })
})

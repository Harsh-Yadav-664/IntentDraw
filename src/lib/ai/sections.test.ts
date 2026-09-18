import { describe, expect, it } from 'vitest'
import { batchSections, findUndefinedComponents, parseSectionManifest, resolveSections } from './sections'

describe('findUndefinedComponents', () => {
  it('finds components rendered but never declared or imported', () => {
    const shell = `import React from 'react';
export default function App() {
  return <div><Hero /><Pricing /></div>;
}`
    expect(findUndefinedComponents(shell).sort()).toEqual(['Hero', 'Pricing'])
  })

  it('ignores components the shell declares itself', () => {
    const shell = `const Hero = () => null;
export default function App() { return <Hero />; }`
    expect(findUndefinedComponents(shell)).toEqual([])
  })

  it('ignores imported icons, including aliased ones', () => {
    const shell = `import { Star, Moon as MoonIcon } from 'lucide-react';
export default function App() { return <div><Star /><MoonIcon /><Hero /></div>; }`
    expect(findUndefinedComponents(shell)).toEqual(['Hero'])
  })

  it('ignores React built-ins', () => {
    const shell = `export default function App() { return <Fragment><Hero /></Fragment>; }`
    expect(findUndefinedComponents(shell)).toEqual(['Hero'])
  })
})

describe('parseSectionManifest', () => {
  it('reads the section list the shell declares', () => {
    expect(parseSectionManifest('/* SECTIONS: Hero, Features, Footer */\nconst x = 1;'))
      .toEqual(['Hero', 'Features', 'Footer'])
  })

  it('returns null when there is no manifest', () => {
    expect(parseSectionManifest('const x = 1;')).toBeNull()
  })
})

describe('resolveSections', () => {
  it('prefers the manifest but still includes rendered names it omitted', () => {
    const shell = `/* SECTIONS: Hero, Features */
export default function App() { return <div><Hero /><Features /><Footer /></div>; }`
    expect(resolveSections(shell).sort()).toEqual(['Features', 'Footer', 'Hero'])
  })

  it('drops manifest entries the shell already defines', () => {
    const shell = `/* SECTIONS: Hero, Features */
const Features = () => null;
export default function App() { return <div><Hero /><Features /></div>; }`
    expect(resolveSections(shell)).toEqual(['Hero'])
  })

  it('falls back to inference when the model omits the manifest', () => {
    const shell = `export default function App() { return <Region1 />; }`
    expect(resolveSections(shell)).toEqual(['Region1'])
  })
})

describe('batchSections', () => {
  it('splits into small batches so each call stays quota-friendly', () => {
    expect(batchSections(['A', 'B', 'C', 'D', 'E'], 2)).toEqual([['A', 'B'], ['C', 'D'], ['E']])
  })

  it('handles an empty section list', () => {
    expect(batchSections([])).toEqual([])
  })
})

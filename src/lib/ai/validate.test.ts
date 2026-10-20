import { describe, expect, it } from 'vitest'
import { aliasSectionImports, assembleFile } from './assemble'
import { assembleParts, parseSavedParts, type PageParts } from './page-parts'
import { declarationAt, describeProblem, findSyntaxProblem } from './validate'

describe('findSyntaxProblem', () => {
  it('passes valid TSX', () => {
    expect(findSyntaxProblem(`import React, { useState } from 'react';
export default function App() {
  const [open, setOpen] = useState<boolean>(false);
  return <button onClick={() => setOpen(!open)}>{open ? 'a' : 'b'}</button>;
}`)).toBeNull()
  })

  it('finds an unclosed tag, with its line', () => {
    const code = `export default function App() {\n  return <div><span>hi</div>;\n}`
    const problem = findSyntaxProblem(code)
    expect(problem).not.toBeNull()
    expect(problem!.line).toBe(2)
    expect(describeProblem(problem!, code)).toContain('line 2')
  })

  it('finds a string literal that never ends', () => {
    expect(findSyntaxProblem(`const a = 'oops;\nexport default function App() { return null }`)).not.toBeNull()
  })

  // The parser alone lets these through when TypeScript syntax is on; the
  // preview's transform stops with `Duplicate declaration "Navigation"`.
  it('finds an import that shares its name with a component', () => {
    const code = `import { Navigation } from 'lucide-react';\n\nexport function Navigation() {\n  return <nav />;\n}\nexport default function App() { return <Navigation />; }`
    const problem = findSyntaxProblem(code)
    expect(problem?.message).toBe('Duplicate declaration "Navigation"')
    expect(problem?.line).toBe(3)
    expect(declarationAt(code, problem!.line)).toBe('Navigation')
  })

  it('finds one name imported twice', () => {
    expect(findSyntaxProblem(`import { Link } from 'a';\nimport { Link } from 'b';\nexport default function App() { return null }`)?.message).toContain('Link')
  })

  it('does not mistake a type import for a duplicate', () => {
    expect(findSyntaxProblem(`import type { Menu } from 'a';\nconst Menu = () => null;\nexport default Menu;`)).toBeNull()
  })
})

describe('an icon named like a section', () => {
  const shell = `import React from 'react';\nexport default function App() {\n  return <main><Navigation /><Locations /></main>;\n}`
  const nav = `import { Menu } from 'lucide-react';\nexport function Navigation() {\n  return <nav aria-label="Navigation"><Menu /></nav>;\n}`
  // The real case: one section is the component Navigation, another imports the
  // lucide icon Navigation. The whole page was lost to a compile error.
  const locations = `import { MapPin, Navigation } from 'lucide-react';\nconst LINKS = [{ icon: Navigation, label: 'Navigation' }];\nexport function Locations() {\n  return <section><h2>Navigation</h2><Navigation className="w-4 h-4" /><MapPin />{LINKS.map(l => <l.icon key={l.label} />)}</section>;\n}`

  it('compiles, with the icon aliased where it was imported', () => {
    const { code } = assembleFile(shell, [nav, locations])
    expect(findSyntaxProblem(code)).toBeNull()
    expect(code).toContain('Navigation as NavigationIcon')
    expect(code).toContain('<NavigationIcon className="w-4 h-4" />')
    expect(code).toContain('icon: NavigationIcon,')
  })

  it('keeps the component, visible text and strings as written', () => {
    const { code } = assembleFile(shell, [nav, locations])
    expect(code).toContain('export function Navigation()')
    expect(code).toContain('<main><Navigation /><Locations /></main>')
    expect(code).toContain('<h2>Navigation</h2>')
    expect(code).toContain(`label: 'Navigation'`)
    expect(code).toContain('aria-label="Navigation"')
  })

  it('is the same whichever block arrives first', () => {
    expect(findSyntaxProblem(assembleFile(shell, [locations, nav]).code)).toBeNull()
  })

  it('also holds while the component is still a placeholder', () => {
    const { code } = assembleFile(shell, [locations, `const Navigation = () => <div />;`])
    expect(findSyntaxProblem(code)).toBeNull()
    expect(code).toContain('<NavigationIcon className="w-4 h-4" />')
  })

  it('aliases inside the block that defines the section too', () => {
    const block = `import { Navigation, X } from 'lucide-react';\nexport function Navigation() {\n  return <nav><X /></nav>;\n}\nexport function Footer() {\n  return <footer><Navigation size={14} /></footer>;\n}`
    const fixed = aliasSectionImports(block, ['Navigation', 'Footer'])
    expect(findSyntaxProblem(fixed)).toBeNull()
    expect(fixed).toContain('<NavigationIcon size={14} />')
    expect(fixed).toContain('export function Navigation()')
    // Nothing to do: returned untouched.
    expect(aliasSectionImports(nav, ['Navigation'])).toBe(nav)
  })

  it('repairs a page saved before this was handled, from its own parts', () => {
    const parts: PageParts = {
      shellCode: shell,
      sceneCode: null,
      tokenId: 'neosleek',
      brief: null,
      regions: [],
      groups: [],
      prompt: 'a taqueria',
      sections: ['Navigation', 'Locations'],
      blocks: [
        { sections: ['Navigation'], code: nav },
        { sections: ['Locations'], code: locations },
      ],
      failed: [],
    }
    const savedBroken = assembleParts(parts, { legacyCollisions: true }).code
    expect(findSyntaxProblem(savedBroken)?.message).toBe('Duplicate declaration "Navigation"')

    const restored = parseSavedParts(JSON.parse(JSON.stringify(parts)), savedBroken)
    expect(restored).not.toBeNull()
    expect(findSyntaxProblem(assembleParts(restored!).code)).toBeNull()
  })
})

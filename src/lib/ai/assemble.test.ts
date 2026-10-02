import { describe, expect, it } from 'vitest'
import { assembleFile, normalizeImports } from './assemble'

const SHELL = `import React from 'react';
import { Menu } from 'lucide-react';

export default function App() {
  return <div><Hero /><Pricing /></div>;
}`

describe('assembleFile', () => {
  it('puts sections before the default export so it can reference them', () => {
    const { code, error } = assembleFile(SHELL, [`const Hero = () => <h1>Hi</h1>;`])

    expect(error).toBeUndefined()
    expect(code.indexOf('const Hero')).toBeLessThan(code.indexOf('export default'))
  })

  it('merges specifiers from the same module instead of redeclaring them', () => {
    const { code } = assembleFile(SHELL, [
      `import { Star } from 'lucide-react';\nconst Hero = () => <Star />;`,
      `import { Star, Moon } from 'lucide-react';\nconst Pricing = () => <Moon />;`,
    ])

    // One import line for the module, and each binding appears exactly once.
    const lucideLines = code.split('\n').filter(l => l.includes("from 'lucide-react'"))
    expect(lucideLines).toHaveLength(1)
    expect(lucideLines[0].match(/\bStar\b/g)).toHaveLength(1)
    expect(lucideLines[0]).toContain('Moon')
    expect(lucideLines[0]).toContain('Menu')
  })

  it('keeps aliased and default imports distinct', () => {
    const { code } = assembleFile(SHELL, [
      `import gsap from 'gsap';\nimport { Star as StarIcon } from 'lucide-react';\nconst Hero = () => <StarIcon />;`,
    ])

    expect(code).toContain("import gsap from 'gsap';")
    expect(code).toContain('Star as StarIcon')
  })

  it('does not bind the same name as both a default and a named import', () => {
    // Real failure: shell used the default export, a section the named one.
    const { code } = assembleFile(`import gsap from 'gsap';\n${SHELL}`, [
      `import { gsap } from 'gsap';\nconst Hero = () => <h1>Hi</h1>;`,
    ])

    const gsapLines = code.split('\n').filter(l => l.includes("from 'gsap'"))
    expect(gsapLines).toEqual(["import gsap from 'gsap';"])
  })

  it('drops relative imports of components the file itself defines', () => {
    // Real failure: a shell written as if multi-file, and a section defining the same name.
    const shell = `import React from 'react';\nimport Hero from './Hero';\nimport { cn } from '@/lib/utils';\n${SHELL.split('\n').slice(2).join('\n')}`
    const { code } = assembleFile(shell, [`export function Hero() { return <h1>Hi</h1>; }`])

    expect(code).not.toMatch(/from '\.\/Hero'/)
    expect(code).not.toMatch(/from '@\/lib\/utils'/)
    expect(code).toContain('function Hero()')
  })

  it('recognises an import followed by a comment', () => {
    // Real failure: the line wasn't treated as an import, so it was never dropped.
    const shell = `import React from 'react';\nimport { Scene } from './Scene' // assuming it lives here\n${SHELL.split('\n').slice(2).join('\n')}`
    const { code } = assembleFile(shell, [`const Scene = () => null;`])

    expect(code).not.toContain("from './Scene'")
    expect(code.match(/\bScene\b/g)).toHaveLength(1)
  })

  it('drops a stray default export from a section', () => {
    const { code } = assembleFile(SHELL, [`export default function Hero() { return <h1>Hi</h1>; }`])

    expect(code.match(/export default/g)).toHaveLength(1)
    expect(code).toContain('function Hero()')
  })

  it('reports an unusable shell rather than emitting broken code', () => {
    const { code, error } = assembleFile(`import React from 'react';\nconst App = () => null;`, [])

    expect(error).toMatch(/export default/)
    expect(code).toBe('')
  })

  it('ignores empty sections that failed to generate', () => {
    const { code, error } = assembleFile(SHELL, ['', '   ', `const Hero = () => null;`])

    expect(error).toBeUndefined()
    expect(code).toContain('const Hero')
  })
})

describe('duplicate declarations across independently generated sections', () => {
  it('keeps the first definition and drops a later redefinition', () => {
    const { code } = assembleFile(SHELL, [
      `const Hero = () => <h1>First</h1>;`,
      `const Hero = () => <h1>Second</h1>;\nconst Pricing = () => <p>Plans</p>;`,
    ])

    expect(code.match(/const Hero\b/g)).toHaveLength(1)
    expect(code).toContain('First')
    expect(code).not.toContain('Second')
    // The non-duplicate component in the same block still survives.
    expect(code).toContain('const Pricing')
  })

  it('does not let a section redefine something the shell declared', () => {
    const shell = `import React from 'react';
const Wrapper = ({ children }) => <div>{children}</div>;
export default function App() { return <Wrapper><Hero /></Wrapper>; }`

    const { code } = assembleFile(shell, [
      `const Wrapper = () => null;\nconst Hero = () => <h1>Hi</h1>;`,
    ])

    expect(code.match(/const Wrapper\b/g)).toHaveLength(1)
    expect(code).toContain('const Hero')
  })

  it('is not confused by braces inside strings or JSX', () => {
    const { code } = assembleFile(SHELL, [
      `const Hero = () => <div className="a{b}">{"} not a brace"}</div>;`,
      `const Pricing = () => <p>ok</p>;`,
    ])

    expect(code).toContain('const Hero')
    expect(code).toContain('const Pricing')
  })

  it('keeps function and class declarations distinct from consts', () => {
    const { code } = assembleFile(SHELL, [
      `function Hero() { return <h1>A</h1>; }\n`,
      `function Hero() { return <h1>B</h1>; }\nconst Pricing = () => null;`,
    ])

    expect(code.match(/function Hero\b/g)).toHaveLength(1)
    expect(code).toContain('const Pricing')
  })
})

describe('multi-line imports', () => {
  // A real run: the shell imported Terminal on one line, a section imported it
  // again over several lines. The multi-line statement was never recognised,
  // stayed mid-file, and declared Terminal twice.
  const shell = `import React from 'react';
import { Terminal, Cpu } from 'lucide-react';

/* SECTIONS: Contact */
export default function App() {
  return <main><Terminal /><Contact /></main>;
}`
  const section = `import {
  Terminal,
  Github,
  Copy,
} from 'lucide-react';

export function Contact() {
  return <section><Terminal /><Github /><Copy /></section>;
}`

  it('merges a multi-line import with the shell imports', () => {
    const { code } = assembleFile(shell, [section])
    expect(code.match(/\bimport\b[^;]*from 'lucide-react'/g)).toHaveLength(1)
    expect(code).toMatch(/import \{ Terminal, Cpu, Github, Copy \} from 'lucide-react';/)
    expect(code).not.toMatch(/^\s*Terminal,\s*$/m)
  })

  it('repairs an already-saved file at render time', () => {
    const saved = `${shell}\n\n${section}`
    const fixed = normalizeImports(saved)
    expect(fixed.match(/\bTerminal\b(?=[,\s}]*[^<])/g)?.length).toBeGreaterThan(0)
    expect(fixed.match(/from 'lucide-react'/g)).toHaveLength(1)
  })

  it('leaves code that only starts with the word import alone', () => {
    const code = `const x = 1\nimport.meta\nconst y = 2`
    expect(normalizeImports(code)).toContain('import.meta')
  })
})

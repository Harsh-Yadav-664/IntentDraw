import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { contrast, mix, renderSceneComponent } from './scene-render'
import { placeSceneBehind } from './staged'
import type { BriefElement } from './brief'
import type { Region } from '@/types'

function stroke(regionNumber: number, points: Array<[number, number]>): Region {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    id: `r${regionNumber}`,
    regionNumber,
    geometry: {
      type: 'freeform',
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y,
      path: points.map(([px, py]) => ({ x: px - x, y: py - y })),
    },
    intent: '',
    lockState: { layout: false, style: false, animation: false },
    generatedCode: null,
    createdAt: '',
    updatedAt: '',
  } as Region
}

const el = (name: string, regions: number[], form: BriefElement['form'], depth: number, motion: string | null = null): BriefElement => ({
  name,
  regions,
  role: 'illustration',
  form,
  depth,
  placement: 'page-background',
  render: null,
  motion,
})

const arc = Array.from({ length: 20 }, (_, i): [number, number] => {
  const a = Math.PI + (i / 19) * Math.PI
  return [640 + 150 * Math.cos(a), 400 + 150 * Math.sin(a)]
})
const regions = [
  stroke(1, [[0, 650], [300, 180], [800, 650]]), // mountain
  stroke(2, arc), // sun
  stroke(3, [[900, 250], [880, 450], [850, 700]]), // left bank
  stroke(4, [[930, 250], [960, 450], [1050, 700]]), // right bank
]
const palette = { background: '#F4EFE6', surface: '#E6DCCB', text: '#2B2622', accent: '#E8A33D', secondary: '#3F7F86' }

/** Syntax errors only — this is a snippet, so unresolved names are expected and ignored. */
function syntaxErrors(tsx: string): string[] {
  const out = ts.transpileModule(tsx, {
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020 },
    fileName: 'scene.tsx',
  })
  return (out.diagnostics ?? []).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('renderSceneComponent', () => {
  const code = renderSceneComponent(
    [el('Mountain', [1], 'silhouette', 0), el('Sun', [2], 'disc', 9, 'slow glow'), el('River', [3, 4], 'band', 1, 'shimmer')],
    regions,
    palette
  )

  it('produces a component that compiles', () => {
    expect(code).toContain('const IntentScene')
    expect(syntaxErrors(code)).toEqual([])
  })

  it('paints the sun behind the land even when the model gave it a nearer depth', () => {
    expect(code.indexOf('Sun */')).toBeLessThan(code.indexOf('Mountain */'))
    expect(code.indexOf('Mountain */')).toBeLessThan(code.indexOf('River */'))
  })

  it('animates only the elements the brief says should move, and honours reduced motion', () => {
    expect(code).toMatch(/@keyframes is\d+-pulse/)
    expect(code).toMatch(/@keyframes is\d+-flow/)
    expect(code).toContain('prefers-reduced-motion')
    const still = renderSceneComponent([el('Mountain', [1], 'silhouette', 0)], regions, palette)
    expect(still).not.toContain('@keyframes')
  })

  it('gives two mountains in one element different depths, so they do not merge', () => {
    const two = [stroke(1, [[0, 650], [300, 180], [800, 650]]), stroke(2, [[500, 650], [900, 300], [1280, 650]])]
    const scene = renderSceneComponent([el('Mountains', [1, 2], 'silhouette', 0)], two, palette)
    const colours = [...scene.matchAll(/<linearGradient id="is\d+-\d+"[^>]*><stop offset="0%" stopColor="(#[0-9A-F]{6})"/g)].map(m => m[1])
    expect(colours).toHaveLength(2)
    expect(colours[0]).not.toBe(colours[1])
  })

  it('draws nothing when the brief has no picture', () => {
    expect(renderSceneComponent([{ ...el('Nav', [1], null, 0), role: 'layout' }], regions, palette)).toBe('')
  })

  it('keeps the nearest land readable against a pale background', () => {
    const fill = code.match(/Mountain \*\/\}\s*<path[^>]*fill="url\(#(is[\d-]+)\)"/)![1]
    const top = code.match(new RegExp(`id="${fill}"[^>]*><stop offset="0%" stopColor="(#[0-9A-F]{6})"`))![1]
    expect(contrast(top, palette.background)).toBeGreaterThanOrEqual(3)
  })
})

describe('placeSceneBehind', () => {
  it('wraps a shell that forgot the scene, and the result still compiles', () => {
    const shell = `import React from 'react';\nexport default function App() {\n  return <main><Hero /></main>;\n}`
    const wrapped = placeSceneBehind(shell, '#F4EFE6')
    expect(wrapped).toContain('function IntentDrawPage(')
    expect(wrapped).toContain('<IntentScene />')
    expect(wrapped.match(/export default/g)).toHaveLength(1)
    expect(syntaxErrors(wrapped)).toEqual([])
  })
})

describe('mix', () => {
  it('blends endpoints exactly', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF')
  })
})

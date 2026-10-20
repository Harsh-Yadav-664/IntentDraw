import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import type { Region } from '@/types'
import travel from './__fixtures__/travel-scenery.json'
import { normalizeBrief } from './brief'
import { promptSignals } from './intent'
import { buildPageShell, describeDrawnSections } from './page-shell'
import { SCENE_STYLES, contrast, renderSceneComponent, sceneStyle, sceneTones, textOverArt } from './scene-render'

// The owner's real drawing (2026-10-17): two ridges R1, R2 and a sun arc R3
// drawn between them, "as the main background on which the content scrolls".
// The run merged the sun into the hills and put the picture behind the hero only.
const regions = travel.regions as unknown as Region[]

function syntaxErrors(tsx: string): string[] {
  const out = ts.transpileModule(tsx, {
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020 },
    fileName: 'scene.tsx',
  })
  return (out.diagnostics ?? []).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

function stroke(n: number, points: Array<[number, number]>): Region {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    id: `r${n}`,
    regionNumber: n,
    geometry: { type: 'freeform', x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, path: points.map(([px, py]) => ({ x: px - x, y: py - y })) },
    intent: '',
    lockState: 'unlocked',
    generatedCode: null,
    createdAt: '',
    updatedAt: '',
  } as unknown as Region
}

describe('the travel run, read again in code', () => {
  const brief = normalizeBrief(travel.brief, regions, travel.prompt)
  const els = brief.drawing.elements

  it('keeps the sun a round body behind the hills instead of a third ridge', () => {
    const disc = els.find(e => e.form === 'disc')
    const land = els.find(e => e.form === 'silhouette')
    expect(disc?.regions).toEqual([3])
    expect(land?.regions).toEqual([1, 2])
    const scene = renderSceneComponent(els, regions, brief.palette)
    expect(scene.indexOf('round body */')).toBeLessThan(scene.indexOf('landscape */'))
  })

  it('puts "the main background the content scrolls on" behind the whole page', () => {
    const [signal] = promptSignals(travel.prompt, regions)
    expect(signal).toMatchObject({ kind: 'background', scope: 'page' })
    expect(els.every(e => e.placement === 'page-background')).toBe(true)
    const shell = buildPageShell(brief, regions, true)
    expect(shell.shellCode).toMatch(/fixed inset-0 z-0[^>]*><IntentScene \/>/)
  })

  it('tells every section, drawn in or not, to let the picture show through', () => {
    const block = describeDrawnSections(['Journal'], brief, regions)
    expect(block).toMatch(/FIXED BEHIND THE WHOLE PAGE/)
    expect(block).toMatch(new RegExp(`text-\\[${textOverArt(brief.palette)}\\]`))
  })
})

describe('what is and is not split off as a round body', () => {
  const arc = (cx: number, cy: number, r: number) =>
    Array.from({ length: 24 }, (_, i): [number, number] => {
      const a = Math.PI + (i / 23) * Math.PI
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    })

  it('leaves a hill drawn as a neat semicircle on the ground as land', () => {
    const hills = [stroke(1, arc(400, 700, 250)), stroke(2, [[600, 700], [900, 300], [1250, 700]])]
    const raw = { drawing: { elements: [{ name: 'Hills', regions: [1, 2], role: 'illustration', form: 'silhouette', depth: 0 }] } }
    const els = normalizeBrief(raw, hills, '').drawing.elements
    expect(els).toHaveLength(1)
    expect(els[0].regions).toEqual([1, 2])
  })

  it('reads "use my drawing as the main background" with no shape named', () => {
    const hills = [stroke(1, [[0, 700], [300, 300], [700, 700]])]
    const raw = { drawing: { elements: [{ name: 'Hill', regions: [1], role: 'illustration', form: 'silhouette', placement: 'hero-background', depth: 0 }] } }
    expect(normalizeBrief(raw, hills, 'use my drawing as the main background').drawing.elements[0].placement).toBe('page-background')
    expect(normalizeBrief(raw, hills, 'a bakery site').drawing.elements[0].placement).toBe('hero-background')
  })
})

describe('art direction', () => {
  const brief = normalizeBrief(travel.brief, regions, travel.prompt)
  const scenes = Object.fromEntries(SCENE_STYLES.map(style => [style, renderSceneComponent(brief.drawing.elements, regions, brief.palette, { style })]))

  it('renders every style as a component that compiles', () => {
    for (const style of SCENE_STYLES) {
      expect(scenes[style]).toContain(`(${style})`)
      expect(syntaxErrors(scenes[style])).toEqual([])
    }
    expect(new Set(Object.values(scenes)).size).toBe(SCENE_STYLES.length)
  })

  it('gives each style its own finish', () => {
    expect(scenes.painterly).toContain('url(#is-haze)')
    expect(scenes.painterly).toContain("mixBlendMode: 'soft-light'")
    expect(scenes.papercut).toContain('feDropShadow')
    expect(scenes['line-art']).toMatch(/stroke="#[0-9A-F]{6}" strokeWidth=\{3\}[^/]*data-draw/)
    expect(scenes.flat).not.toMatch(/linearGradient id="is\d/)
  })

  it('follows the site design: flat surfaces paint flat, outlined ones draw lines', () => {
    expect(sceneStyle({ surfaces: 'flat' })).toBe('flat')
    expect(sceneStyle({ surfaces: 'outlined' })).toBe('line-art')
    expect(sceneStyle({ surfaces: 'layered' })).toBe('papercut')
    expect(sceneStyle({ surfaces: 'glass' })).toBe('painterly')
    expect(sceneStyle(null)).toBe('painterly')
  })

  it('keeps the nearest land readable against the light behind it, on dark and light pages', () => {
    const dark = { background: '#0B1220', surface: '#16213A', text: '#F2EBDD', accent: '#E8A33D', secondary: '#4A6B5C' }
    const light = { background: '#F4EFE6', surface: '#E6DCCB', text: '#2B2622', accent: '#E8A33D', secondary: '#3F7F86' }
    for (const p of [dark, light]) {
      const t = sceneTones(p, 3)
      expect(contrast(t.land[0], t.horizon)).toBeGreaterThanOrEqual(3)
      // Far layers fade toward the horizon: atmospheric perspective.
      expect(contrast(t.land[2], t.horizon)).toBeLessThan(contrast(t.land[0], t.horizon))
    }
  })

  it('lists its colours for the preview legibility check', () => {
    expect(scenes.painterly).toMatch(/data-tones="(#[0-9A-F]{6},){3,}#[0-9A-F]{6}"/)
  })

  it('moves only in frames it gets, honours reduced motion and the editor freeze', () => {
    const code = scenes.painterly
    expect(code).toContain('requestAnimationFrame(tick)')
    expect(code).toContain("prefers-reduced-motion: reduce)').matches) return")
    expect(code).toContain('__intentdrawFrozen) { settle(); return; }')
    // Fixed behind the page: near layers sink as the page scrolls.
    expect(code).toContain('const lift = s * 0.06 * d')
    const hero = renderSceneComponent(brief.drawing.elements.map(e => ({ ...e, placement: 'section-background' as const })), regions, brief.palette)
    expect(hero).toContain('const lift = s * 0.3 * (1 - d)')
    // Nothing is written outside a frame: no Web Animations intro to get stuck.
    expect(code).not.toMatch(/\.animate\(/)
  })
})

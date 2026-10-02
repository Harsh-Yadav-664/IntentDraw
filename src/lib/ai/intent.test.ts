import { describe, expect, it } from 'vitest'
import type { Region } from '@/types'
import cube from './__fixtures__/cube-portfolio.json'
import globe from './__fixtures__/globe-portfolio.json'
import { describeIntentSignals, geometrySignals, intentSignals, promptSignals } from './intent'
import { normalizeBrief } from './brief'
import { buildPageShell, describeDrawnSections } from './page-shell'
import { renderObjects } from './objects'

const cubeRegions = cube.regions as unknown as Region[]
const globeRegions = globe.regions as unknown as Region[]

const box = (n: number, x: number, y: number, w: number, h: number, type: 'rectangle' | 'circle' = 'rectangle'): Region =>
  ({ id: `r${n}`, regionNumber: n, geometry: { type, x, y, width: w, height: h }, intent: '', lockState: 'unlocked', generatedCode: null, createdAt: '', updatedAt: '' }) as unknown as Region

describe('reading the prompt in code', () => {
  it('finds the cube in a short, loosely written prompt', () => {
    const [s] = promptSignals(cube.prompt, cubeRegions)
    expect(s).toMatchObject({ regions: [1], kind: 'object', object: 'cube', anchor: 'exact', interactive: true, animated: true })
  })

  it('survives typos and expands "and all regions inside it"', () => {
    const signals = promptSignals(globe.prompt, globeRegions)
    expect(signals.find(s => s.regions.includes(11))).toMatchObject({ kind: 'content', anchor: 'exact' })
    const sphere = signals.find(s => s.regions.includes(1))!
    expect([...sphere.regions].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(sphere).toMatchObject({ kind: 'object', object: 'sphere' })
  })

  it('reads ranges, lists, backgrounds and "anywhere"', () => {
    const regions = [box(1, 0, 0, 1280, 800), box(2, 100, 100, 200, 200), box(3, 400, 100, 200, 200), box(4, 700, 100, 200, 200)]
    const signals = promptSignals('use region 1 as the background. R2 to R4 are project cards. Put a badge in R3 anywhere', regions)
    expect(signals[0]).toMatchObject({ regions: [1], kind: 'background', anchor: 'behind' })
    expect(signals[1]).toMatchObject({ regions: [2, 3, 4], kind: 'content' })
    expect(signals[2]).toMatchObject({ regions: [3], anchor: 'anywhere' })
  })

  it('ignores numbers that are not shapes', () => {
    expect(promptSignals('region 9 is a cube', [box(1, 0, 0, 10, 10)])).toEqual([])
  })
})

describe('geometry priors', () => {
  it('knows a top strip, a full-screen box and a row of equal cards', () => {
    const regions = [box(1, 20, 10, 1240, 70), box(2, 0, 800, 1280, 790), box(3, 100, 1700, 300, 200), box(4, 450, 1700, 300, 200), box(5, 800, 1700, 300, 200)]
    const signals = geometrySignals(regions)
    expect(signals.find(s => s.regions[0] === 1)?.why).toMatch(/navigation/)
    expect(signals.find(s => s.regions[0] === 2)).toMatchObject({ kind: 'background' })
    expect(signals.find(s => s.regions.length === 3)?.why).toMatch(/row or grid of cards/)
  })

  it('drops geometry guesses about shapes the user already explained', () => {
    const signals = intentSignals(cube.prompt, cubeRegions)
    expect(signals.filter(s => s.source === 'geometry')).toHaveLength(0)
    expect(describeIntentSignals(signals)).toMatch(/R1 → 3D object \(cube\), exactly where drawn, interactive, animated \[PROMPT/)
  })

  it('lets a one-click tag outrank everything', () => {
    const tagged = cubeRegions.map(r => ({ ...r, tag: { kind: 'background' as const } }))
    const brief = normalizeBrief(cube.brief, tagged, cube.prompt)
    // The prompt says cube, but the user's own tag says background: the tag wins.
    expect(brief.drawing.elements[0]).toMatchObject({ role: 'illustration', anchor: 'behind' })
  })
})

describe('the cube run, end to end in code', () => {
  const brief = normalizeBrief(cube.brief, cubeRegions, cube.prompt)
  const objects = renderObjects(brief.drawing.elements, cubeRegions, brief.palette)

  it('turns the misfiled flat shape into a 3D cube object', () => {
    expect(brief.drawing.elements[0]).toMatchObject({ role: 'object', form: 'cube', anchor: 'exact', section: 'Hero' })
    expect(objects.objects.map(o => o.name)).toEqual(['IntentObject1'])
    expect(objects.code).toMatch(/transformStyle: 'preserve-3d'/)
    expect(objects.code).toMatch(/pointerdown/)
  })

  it('places it at R1 in the hero, in code, and tells the hero to keep the spot clear', () => {
    const shell = buildPageShell(brief, cubeRegions, false, objects.objects)
    expect(shell.shellCode).toMatch(/lg:left-\[68.9%\] lg:top-\[25.2vh\] lg:w-\[21%\] lg:h-\[31.7vh\]"><IntentObject1 \/>/)
    const block = describeDrawnSections(['Hero'], brief, cubeRegions)
    expect(block).toMatch(/BUILT AND PLACED BY IntentDraw/)
    expect(block).not.toMatch(/painted behind/)
  })
})

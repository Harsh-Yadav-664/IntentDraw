import { describe, expect, it } from 'vitest'
import { applyBriefToRegions, describeScene, normalizeBrief, parseJsonObject, toComponentName } from './brief'
import type { Region } from '@/types'

function region(regionNumber: number, type: 'rectangle' | 'freeform' | 'arrow'): Region {
  return {
    id: `r${regionNumber}`,
    regionNumber,
    geometry: {
      type,
      x: 100 * regionNumber,
      y: 100,
      width: 200,
      height: 200,
      path: type === 'rectangle' ? undefined : [{ x: 0, y: 200 }, { x: 100, y: 0 }, { x: 200, y: 200 }],
    },
    intent: '',
    lockState: { layout: false, style: false, animation: false },
    generatedCode: null,
    createdAt: '',
    updatedAt: '',
  } as Region
}

describe('parseJsonObject', () => {
  it('keeps an object that contains arrays whole (the shared helper cut it to the array)', () => {
    const parsed = parseJsonObject('Here: {"sections":[{"name":"Hero"}],"tone":["warm"]} done') as Record<string, unknown>
    expect(parsed.sections).toEqual([{ name: 'Hero' }])
    expect(parsed.tone).toEqual(['warm'])
  })

  it('is not fooled by braces inside strings', () => {
    const parsed = parseJsonObject('{"concept":"a } b {","x":1}') as Record<string, unknown>
    expect(parsed.x).toBe(1)
  })
})

describe('toComponentName', () => {
  it('turns prose section names into component names and rejects unusable ones', () => {
    expect(toComponentName('hero section')).toBe('HeroSection')
    expect(toComponentName('shop-by-craft')).toBe('ShopByCraft')
    expect(toComponentName('App')).toBeNull()
    expect(toComponentName('3 columns')).toBeNull()
  })
})

describe('normalizeBrief', () => {
  const regions = [region(1, 'rectangle'), region(2, 'freeform'), region(3, 'freeform')]

  it('gives every drawn shape exactly one element, even ones the model forgot', () => {
    const brief = normalizeBrief(
      {
        drawing: {
          elements: [
            { name: 'Nav', regions: [1], role: 'layout' },
            { name: 'Sun', regions: [2, 1], role: 'illustration', form: 'disc' }, // R1 already claimed
          ],
        },
      },
      regions,
      'a site'
    )
    const owners = brief.drawing.elements.flatMap(e => e.regions)
    expect(owners.sort()).toEqual([1, 2, 3])
    expect(brief.drawing.elements.find(e => e.name === 'Sun')?.regions).toEqual([2])
    expect(brief.drawing.kind).toBe('mixed')
  })

  it('rejects invalid enums, palettes and style ids instead of trusting them', () => {
    const brief = normalizeBrief(
      {
        styleId: 'made-up',
        palette: { background: 'red', surface: '#fff', text: '#000', accent: '#111', secondary: '#222' },
        drawing: { elements: [{ name: 'X', regions: [2], role: 'nonsense' }] },
      },
      regions,
      'an elegant luxury boutique'
    )
    expect(brief.styleId).toBe('elegant_serif') // from the prompt's own words
    expect(brief.palette).toBeNull()
    expect(brief.drawing.elements.map(e => e.role)).not.toContain('nonsense')
  })

  it('picks the same fallback style for the same prompt every time', () => {
    const a = normalizeBrief({}, [], 'a website for a bakery')
    const b = normalizeBrief({}, [], 'a website for a bakery')
    expect(a.styleId).toBe(b.styleId)
  })
})

describe('applyBriefToRegions', () => {
  it('keeps picture strokes out of the layout skeleton', () => {
    const regions = [region(1, 'rectangle'), region(2, 'freeform')]
    const brief = normalizeBrief(
      {
        concept: 'c',
        drawing: {
          elements: [
            { name: 'Nav', regions: [1], role: 'layout' },
            { name: 'Mountain', regions: [2], role: 'illustration', form: 'silhouette' },
          ],
        },
      },
      regions,
      'x'
    )
    const tagged = applyBriefToRegions(regions, brief)
    expect(tagged.map(r => r.classificationTag)).toEqual(['exact-placement', 'illustration'])
    expect(describeScene(brief, tagged)).toContain('ILLUSTRATED SCENE')
  })

  it('falls back to the old heuristics when no model wrote the brief', () => {
    const regions = [region(1, 'rectangle'), region(2, 'freeform'), region(3, 'arrow')]
    const brief = { ...normalizeBrief({}, regions, 'x'), source: 'fallback' as const }
    expect(applyBriefToRegions(regions, brief).map(r => r.classificationTag)).toEqual([
      'exact-placement',
      'decorative',
      'relational',
    ])
  })
})

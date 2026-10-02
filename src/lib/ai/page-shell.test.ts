import { describe, expect, it } from 'vitest'
import type { Region } from '@/types'
import fixture from './__fixtures__/globe-portfolio.json'
import misread from './__fixtures__/globe-portfolio.misread-brief.json'
import { normalizeBrief, sectionForPage } from './brief'
import { batchPlan, buildPageShell, describeDrawnSections, planSections } from './page-shell'
import { looksHandwritten, perceiveDrawing } from './perception'
import { renderSceneComponent } from './scene-render'
import { sphereGeometry } from './scene'

// The owner's real drawing (2026-10-02): handwritten "Name" (R10), a key-points
// box (R11), and a circle R1 with a network of lines R2-R9 inside it.
const regions = fixture.regions as unknown as Region[]
const prompt = fixture.prompt

describe('reading the real drawing in code', () => {
  it('recognises the handwritten word — it used to be "zig-zag with 8 spikes"', () => {
    const r10 = regions.find(r => r.regionNumber === 10)!
    expect(looksHandwritten(r10)).toBe(true)
    expect(regions.filter(looksHandwritten).map(r => r.regionNumber)).toEqual([10])
    const facts = perceiveDrawing(regions)
    expect(facts.get(10)).toMatch(/HANDWRITTEN TEXT/)
    expect(facts.get(10)).not.toMatch(/zig-zag/)
  })

  it('states what is drawn inside the circle, on both sides', () => {
    const facts = perceiveDrawing(regions)
    expect(facts.get(1)).toMatch(/contains R2, R3, R4, R5, R6, R7, R8, R9/)
    expect(facts.get(5)).toMatch(/drawn inside R1/)
    expect(facts.get(11) ?? '').not.toMatch(/inside/)
  })
})

describe('the misread brief from the failed run, corrected by code', () => {
  const brief = normalizeBrief(misread, regions, prompt)

  it('turns the circle and its marks into a 3D sphere when the user asked for 3D', () => {
    const globe = brief.drawing.elements.find(e => e.regions.includes(1))!
    expect(globe.form).toBe('sphere')
  })

  it('treats the handwritten word as content, not decoration', () => {
    const name = brief.drawing.elements.find(e => e.regions.includes(10))!
    expect(name.role).toBe('layout')
  })

  it('assigns everything drawn on page 1 to the first section', () => {
    expect(brief.drawing.elements.every(e => e.section === 'HeroSection')).toBe(true)
  })
})

describe('the page shell, built in code', () => {
  const brief = normalizeBrief(misread, regions, prompt)
  const scene = renderSceneComponent(brief.drawing.elements, regions, brief.palette)
  const shell = buildPageShell(brief, regions, !!scene)

  it('renders every planned section in order — the failed run rendered one of five', () => {
    expect(shell.sections).toEqual(['HeroSection', 'AboutSection', 'ProjectsSection', 'HighlightsSection', 'ContactSection'])
    let at = -1
    for (const name of shell.sections) {
      const i = shell.shellCode.indexOf(`<${name} />`)
      expect(i).toBeGreaterThan(at)
      at = i
    }
    expect(shell.shellCode).not.toMatch(/FirstSection/)
  })

  it('puts the drawing behind the section it was drawn in, and carries the fonts', () => {
    expect(shell.shellCode).toMatch(/<IntentScene \/><\/div>\s*<div className="relative z-10"><HeroSection \/>/)
    expect(shell.shellCode).toMatch(/SITE-FONTS: display=/)
  })

  it('builds the drawn section alone and first', () => {
    expect(shell.batches[0]).toEqual(['HeroSection'])
    expect(shell.batches.flat().sort()).toEqual([...shell.sections].sort())
  })

  it('gives the section exact placement for what was drawn in it', () => {
    const block = describeDrawnSections(['HeroSection'], brief, regions)
    // One column: the handwritten name with room up to the globe (not the
    // scribble's width), then the box drawn under it, in normal flow so a tall
    // heading pushes it down instead of overlapping it (a real run collided).
    expect(block).toMatch(/className="lg:absolute lg:left-\[4.4%\] lg:top-\[22.9%\] lg:w-\[58.2%\] lg:flex lg:flex-col"/)
    expect(block).toMatch(/lg:mt-\[23vh\] lg:w-\[85.2%\]/) // R11, 23% of a screen below the name
    expect(block).toMatch(/HANDWROTE/)
    expect(block).toMatch(/ALREADY PAINTED behind this section/)
    expect(describeDrawnSections(['AboutSection'], brief, regions)).toBe('')
  })
})

describe('the sphere', () => {
  it('lifts the marks onto the front of a sphere centred on the drawn circle', () => {
    const geo = sphereGeometry([1, 2, 3, 4, 5, 6, 7, 8, 9], regions)!
    expect(Math.abs(geo.cx - 990)).toBeLessThanOrEqual(1) // R1: x 828 + 325/2
    expect(geo.strokes).toHaveLength(8)
    for (const s of geo.strokes) {
      for (const [x, y, z] of s) {
        expect(Math.abs(Math.hypot(x, y, z) - 1)).toBeLessThan(0.01)
        expect(z).toBeGreaterThanOrEqual(0)
      }
    }
    expect(geo.nodes.length).toBeGreaterThan(4)
  })

  it('renders as a live component that stops when the page is frozen', () => {
    const brief = normalizeBrief(misread, regions, prompt)
    const scene = renderSceneComponent(brief.drawing.elements, regions, brief.palette)
    expect(scene).toMatch(/const IntentSceneSphere0 = \(\) =>/)
    expect(scene).toMatch(/<IntentSceneSphere0 \/>/)
    expect(scene).toMatch(/__intentdrawFrozen/)
    expect(scene).toMatch(/prefers-reduced-motion/)
    expect(scene).toMatch(/Math\.max\(1, window\.innerWidth\)/)
  })
})

describe('section plumbing', () => {
  it('maps drawn pages to content sections, after a navigation bar', () => {
    const names = ['Navigation', 'Hero', 'Work', 'Contact']
    expect(sectionForPage(0, names)).toBe('Hero')
    expect(sectionForPage(1, names)).toBe('Work')
    expect(sectionForPage(9, names)).toBe('Contact')
    expect(sectionForPage(0, [])).toBeNull()
  })

  it('pairs navigation with footer and the rest in twos', () => {
    expect(batchPlan(['Navigation', 'Hero', 'Work', 'Wins', 'About', 'Contact', 'Footer'], ['Hero'])).toEqual([
      ['Hero'], ['Navigation', 'Footer'], ['Work', 'Wins'], ['About', 'Contact'],
    ])
  })

  it('gives a brief with no plan a full page anyway', () => {
    expect(planSections(normalizeBrief({}, [], 'a bakery')).length).toBeGreaterThanOrEqual(4)
  })
})

describe('one drawn page, one section', () => {
  it('keeps a box drawn under the hero in the hero, as a real run tried to split it out', () => {
    const brief = normalizeBrief(
      {
        sections: [
          { name: 'Navigation', purpose: '' }, { name: 'Hero', purpose: '' }, { name: 'KeyAchievements', purpose: '' },
          { name: 'Portfolio', purpose: '' }, { name: 'Footer', purpose: '' },
        ],
        drawing: {
          reading: 'x',
          elements: [
            { name: 'Name', regions: [10], role: 'layout', section: 'Hero' },
            { name: 'Key achievements', regions: [11], role: 'layout', section: 'KeyAchievements' },
            { name: 'Sphere', regions: [1, 2, 3, 4, 5, 6, 7, 8, 9], role: 'illustration', form: 'sphere', section: 'Hero' },
          ],
        },
      },
      regions,
      prompt
    )
    expect(new Set(brief.drawing.elements.map(e => e.section))).toEqual(new Set(['Hero']))
  })
})

describe('a sphere keeps what is drawn on it', () => {
  it('merges marks drawn inside the circle back into the sphere — a real run split them into 8 flat "routes"', async () => {
    const split = (await import('./__fixtures__/globe-portfolio.split-sphere-brief.json')).default
    const brief = normalizeBrief(split, regions, prompt)
    const globe = brief.drawing.elements.find(e => e.form === 'sphere')!
    expect([...globe.regions].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(brief.drawing.elements.filter(e => e.name.startsWith('Route'))).toHaveLength(0)
    expect(brief.drawing.elements).toHaveLength(3)
  })
})

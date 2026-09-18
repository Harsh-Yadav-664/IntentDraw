import { describe, expect, it } from 'vitest'
import { REFERENCE_CORPUS, buildReferenceSection, selectReferences } from './references'

describe('REFERENCE_CORPUS', () => {
  it('has unique ids and a useful spread of archetypes', () => {
    const ids = REFERENCE_CORPUS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(6)
  })

  it('stays compact — a sketch is a structural summary, not markup', () => {
    for (const sketch of REFERENCE_CORPUS) {
      const rendered = [sketch.flow, sketch.weight, sketch.contrast, sketch.rhythm, sketch.designed].join(' ')
      expect(rendered.length, sketch.id).toBeLessThan(1400)
      // No markup may leak into the corpus — structure is described, never copied.
      expect(rendered, sketch.id).not.toMatch(/className=|<div|<section/)
    }
  })
})

describe('selectReferences', () => {
  it('returns 1-2 sketches, never the whole corpus', () => {
    const prompts = [
      'a restaurant website, the menu should be visible in circles',
      'saas analytics platform for teams',
      'my photography portfolio',
      'sneaker store with a shop page',
      'developer tool with an api and a cli',
      'a conference site with a schedule and tickets',
      'creative agency studio site',
      'something about badgers',
      '',
    ]
    for (const prompt of prompts) {
      const picked = selectReferences(prompt)
      expect(picked.length, prompt).toBeGreaterThanOrEqual(1)
      expect(picked.length, prompt).toBeLessThanOrEqual(2)
      expect(picked.length, prompt).toBeLessThan(REFERENCE_CORPUS.length)
    }
  })

  it('picks the matching archetype', () => {
    expect(selectReferences('a restaurant website with a menu')[0].id).toBe('hospitality')
    expect(selectReferences('my photography portfolio')[0].id).toBe('portfolio')
    expect(selectReferences('an online store selling furniture')[0].id).toBe('ecommerce')
    expect(selectReferences('a conference with speakers and tickets')[0].id).toBe('event_launch')
    expect(selectReferences('a saas platform for project management')[0].id).toBe('saas_landing')
    expect(selectReferences('a creative agency studio')[0].id).toBe('agency_editorial')
  })

  it('is deterministic for a given prompt', () => {
    const prompt = 'a restaurant booking app with a menu'
    const first = selectReferences(prompt, 'neosleek')
    for (let i = 0; i < 5; i++) {
      expect(selectReferences(prompt, 'neosleek').map(s => s.id)).toEqual(first.map(s => s.id))
    }
  })

  it('adds a second sketch only on genuine dual signal', () => {
    // Two clear archetypes in one prompt.
    const dual = selectReferences('a restaurant booking app with a dashboard and a menu')
    expect(dual.length).toBe(2)
    expect(dual.map(s => s.id).sort()).toEqual(['app_marketing', 'hospitality'])

    // One clear archetype -> one sketch.
    expect(selectReferences('a restaurant website with a menu and a chef')).toHaveLength(1)
  })

  it('falls back to the corpus default for an unmatched prompt', () => {
    const picked = selectReferences('region 1 to 7 shows an animated background')
    expect(picked).toHaveLength(1)
    expect(picked[0]).toBe(REFERENCE_CORPUS[0])
  })

  it('handles an empty prompt without throwing', () => {
    expect(selectReferences('')).toHaveLength(1)
  })

  it('uses the style preset only as a tie-break, never over real prompt signal', () => {
    // No archetype signal: the preset affinity decides.
    expect(selectReferences('make me a website', 'glassmorphism')[0].id).toBe('saas_landing')
    expect(selectReferences('make me a website', 'playful_pop')[0].id).toBe('hospitality')
    // Real signal present: the preset cannot override it.
    expect(selectReferences('a photography portfolio', 'glassmorphism')[0].id).toBe('portfolio')
  })

  it('does not match short keywords inside unrelated words', () => {
    // 'various' contains 'ios', 'rapid' contains 'api', 'cartoon' contains 'cart'.
    const picked = selectReferences('a rapid various cartoon page')
    expect(picked).toHaveLength(1)
    expect(picked[0]).toBe(REFERENCE_CORPUS[0])
  })
})

describe('buildReferenceSection', () => {
  it('emits page architecture in page mode, with the transformation instruction', () => {
    const block = buildReferenceSection('a restaurant website with a menu', 'elegant_serif', 'page')
    expect(block).toContain('ADOPT THE STRUCTURE, NOT THE SKIN')
    expect(block).toContain('REFERENCE 1 —')
    expect(block).toContain('FLOW:')
    expect(block).toContain('RHYTHM:')
    expect(block).toContain('THE SKELETON WINS')
    expect(block).toContain('BANNED CLASSES')
  })

  it('emits only section craft in section mode, and stays much cheaper', () => {
    const page = buildReferenceSection('a saas analytics platform', 'glassmorphism', 'page')
    const section = buildReferenceSection('a saas analytics platform', 'glassmorphism', 'section')
    expect(section).toContain('section craft')
    expect(section).not.toContain('FLOW:')
    expect(section.length).toBeLessThan(page.length / 2)
  })

  it('never injects more than two references', () => {
    const block = buildReferenceSection('a restaurant booking app with a dashboard and a menu', undefined, 'page')
    expect(block).toContain('REFERENCE 2 —')
    expect(block).not.toContain('REFERENCE 3 —')
  })

  it('stays inside a free-tier-friendly token budget', () => {
    const worst = buildReferenceSection(
      'a restaurant booking app with a dashboard and a menu',
      undefined,
      'page'
    )
    // ~chars/4 tokens. Two full sketches plus the header must stay well under 1k tokens.
    expect(worst.length / 4).toBeLessThan(900)
  })
})

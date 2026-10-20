import { describe, expect, it } from 'vitest'
import { auditBySection, auditNote, auditPage, contrastRatio } from './page-audit'

describe('contrastRatio', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1)
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 1)
    expect(contrastRatio([40, 40, 40], [20, 20, 20])).toBeLessThan(1.5) // the dark-grey name on near-black
  })
})

describe('embedding', () => {
  it('both run from their source text alone — the preview only gets the bodies', () => {
    const ratio = new Function(`return (${contrastRatio.toString()})`)()
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1)
    // Needs a DOM to run; compiling it from source is what proves it carries no outside references.
    expect(() => new Function(`return (${auditPage.toString()})`)()).not.toThrow()
    expect(auditPage.toString()).not.toMatch(/\b(?:_sliced|__spread|_to_consumable|require\()/)
  })
})

describe('auditNote', () => {
  it('puts what breaks the page first and fits a section note', () => {
    const note = auditNote([
      { kind: 'contrast', section: 'Hero', detail: 'text "Book" is hard to read (contrast 1.4:1 — needs 4.5:1)' },
      { kind: 'overflow', section: 'Hero', detail: 'the page is 120px wider than the window — something overflows sideways' },
    ])
    expect(note.indexOf('wider')).toBeLessThan(note.indexOf('hard to read'))
    expect(note.length).toBeLessThanOrEqual(300)
    expect(auditNote([])).toBe('')
  })
})

describe('auditBySection', () => {
  it('keeps only this page\'s sections, known kinds and plain text', () => {
    const notes = auditBySection([
      { kind: 'empty', section: 'RetreatPhoto', detail: '1.3 screens with nothing visible on them' },
      { kind: 'contrast', section: 'Evil', detail: 'x' },
      { kind: 'rm -rf', section: 'RetreatPhoto', detail: 'x' },
      { kind: 'overlap', section: 'RetreatPhoto', detail: '<script>{`a`}</script>'.repeat(30) },
      null,
    ], ['RetreatPhoto', 'Footer'])
    expect(Object.keys(notes)).toEqual(['RetreatPhoto'])
    expect(notes.RetreatPhoto).toMatch(/^Layout check: /)
    expect(notes.RetreatPhoto).not.toMatch(/[<>{}`]/)
    expect(auditBySection('nope', ['A'])).toEqual({})
  })
})

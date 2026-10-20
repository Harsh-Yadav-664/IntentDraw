import { describe, expect, it } from 'vitest'
import { OPENROUTER_TEXT_MODELS, OPENROUTER_VISION_MODELS } from './openrouter'
import { buildFallbackChain, resolveProvider } from './provider'

describe('OpenRouter model lists', () => {
  it('stay within the 3 entries a `models` request accepts (a longer list is a 400)', () => {
    expect(OPENROUTER_TEXT_MODELS.length).toBeLessThanOrEqual(3)
    expect(OPENROUTER_VISION_MODELS.length).toBeLessThanOrEqual(3)
  })

  it('hold only free model IDs', () => {
    for (const id of [...OPENROUTER_TEXT_MODELS, ...OPENROUTER_VISION_MODELS]) expect(id).toMatch(/:free$/)
  })
})

describe('resolveProvider', () => {
  it('keeps an explicit choice', () => {
    expect(resolveProvider('groq', ['Hero'])).toBe('groq')
    expect(resolveProvider('nvidia')).toBe('nvidia')
  })

  it("on 'auto', gives structure to Groq and the look and content to Gemini", () => {
    expect(resolveProvider('auto', ['Navigation', 'Footer'])).toBe('groq')
    expect(resolveProvider('auto', ['Reservations', 'Contact'])).toBe('groq')
    expect(resolveProvider('auto', ['Hero'])).toBe('gemini')
    expect(resolveProvider('auto', ['Menu', 'Contact'])).toBe('gemini') // mixed: content wins
    expect(resolveProvider('auto')).toBe('gemini') // understanding, the legacy path
    expect(resolveProvider(undefined)).toBe('gemini')
    expect(buildFallbackChain('auto')[0]).toBe('gemini')
  })
})

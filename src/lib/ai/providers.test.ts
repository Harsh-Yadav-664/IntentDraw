import { describe, expect, it } from 'vitest'
import { OPENROUTER_TEXT_MODELS, OPENROUTER_VISION_MODELS } from './openrouter'

describe('OpenRouter model lists', () => {
  it('stay within the 3 entries a `models` request accepts (a longer list is a 400)', () => {
    expect(OPENROUTER_TEXT_MODELS.length).toBeLessThanOrEqual(3)
    expect(OPENROUTER_VISION_MODELS.length).toBeLessThanOrEqual(3)
  })

  it('hold only free model IDs', () => {
    for (const id of [...OPENROUTER_TEXT_MODELS, ...OPENROUTER_VISION_MODELS]) expect(id).toMatch(/:free$/)
  })
})

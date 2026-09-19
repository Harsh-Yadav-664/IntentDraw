import { describe, expect, it } from 'vitest'
import { classifyGeminiError } from './gemini'

describe('classifyGeminiError', () => {
  it('moves on from a spent daily quota instead of waiting (the real 429 names it)', () => {
    const real = '[429 Too Many Requests] quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier" quotaValue":"20"'
    expect(classifyGeminiError(real)).toBe('daily-quota')
  })

  it('moves on from a retired model', () => {
    expect(classifyGeminiError('[404 Not Found] This model models/gemini-2.5-pro is no longer available to new users.')).toBe('retired')
  })

  it('waits and retries per-minute limits and high-demand 503s', () => {
    expect(classifyGeminiError('[429 Too Many Requests] quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"')).toBe('transient')
    expect(classifyGeminiError('[503 Service Unavailable] This model is currently experiencing high demand.')).toBe('transient')
  })

  it('treats anything else as a real error', () => {
    expect(classifyGeminiError('[400 Bad Request] Invalid value at inline_data.data')).toBe('fatal')
  })
})

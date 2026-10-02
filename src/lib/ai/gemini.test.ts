import { beforeEach, describe, expect, it, vi } from 'vitest'

// The SDK is replaced so the model chain can be exercised without a network.
const calls: string[] = []
let behaviour: Record<string, () => string> = {}
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async () => {
          calls.push(model)
          const text = (behaviour[model] ?? (() => { throw new Error('[503 Service Unavailable] high demand') }))()
          return { response: { text: () => text } }
        },
      }
    }
  },
}))

process.env.GOOGLE_AI_API_KEY = 'test'
const { GEMINI_MODELS, classifyGeminiError, geminiGenerate, resetGeminiState, usableModels } = await import('./gemini')

describe('classifyGeminiError', () => {
  it('moves on from a spent daily quota instead of waiting (the real 429 names it)', () => {
    const real = '[429 Too Many Requests] quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier" quotaValue":"20"'
    expect(classifyGeminiError(real)).toBe('daily-quota')
  })

  it('moves on from a retired model', () => {
    expect(classifyGeminiError('[404 Not Found] This model models/gemini-2.5-pro is no longer available to new users.')).toBe('retired')
  })

  it('treats high demand, server errors and hung requests as overload', () => {
    expect(classifyGeminiError('[503 Service Unavailable] This model is currently experiencing high demand.')).toBe('overloaded')
    expect(classifyGeminiError('Request aborted when fetching …: This operation was aborted')).toBe('overloaded')
  })

  it('waits once for a per-minute limit', () => {
    expect(classifyGeminiError('[429 Too Many Requests] quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"')).toBe('rate-limited')
  })

  it('treats anything else as a real error', () => {
    expect(classifyGeminiError('[400 Bad Request] Invalid value at inline_data.data')).toBe('fatal')
  })
})

describe('geminiGenerate across the model chain', () => {
  beforeEach(() => {
    calls.length = 0
    behaviour = {}
    resetGeminiState()
  })

  it('skips overloaded models immediately — one attempt each, no waiting', async () => {
    const last = GEMINI_MODELS[GEMINI_MODELS.length - 1]
    behaviour[last] = () => 'ok'
    const started = Date.now()
    await expect(geminiGenerate([{ text: 'x' }])).resolves.toBe('ok')
    expect(calls).toEqual(GEMINI_MODELS)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('remembers overloaded models and tries the last one that answered first', async () => {
    const last = GEMINI_MODELS[GEMINI_MODELS.length - 1]
    behaviour[last] = () => 'ok'
    await geminiGenerate([{ text: 'x' }])
    expect(usableModels()).toEqual([last])

    // Everyone recovers; the one that answered stays first.
    const later = Date.now() + 10 * 60 * 1000
    expect(usableModels(later)[0]).toBe(last)
  })

  it('throws a real error straight to the provider chain', async () => {
    behaviour[GEMINI_MODELS[0]] = () => { throw new Error('[400 Bad Request] bad image') }
    await expect(geminiGenerate([{ text: 'x' }])).rejects.toThrow('400')
    expect(calls).toEqual([GEMINI_MODELS[0]])
  })
})

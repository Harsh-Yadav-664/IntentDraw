import { afterEach, describe, expect, it, vi } from 'vitest'
import { AllowanceSpentError, generateFluxImage, imageAllowanceSpent, isAllowanceSpent, nextUtcMidnight } from './cloudflare'

const config = { accountId: 'a', token: 't' }
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('the free image allowance', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('knows the daily-allocation answer from a passing rate limit', () => {
    expect(isAllowanceSpent(429, '4006: you have used up your daily free allocation of 10,000 neurons')).toBe(true)
    expect(isAllowanceSpent(429, 'Capacity temporarily exceeded, please try again')).toBe(false)
    expect(isAllowanceSpent(500, 'Internal error')).toBe(false)
  })

  it('resets at the next UTC midnight', () => {
    expect(new Date(nextUtcMidnight(Date.UTC(2026, 10, 5, 23, 59))).toISOString()).toBe('2026-11-06T00:00:00.000Z')
  })

  it('stops asking for the rest of the day once it is spent, but not after a passing error', async () => {
    vi.stubGlobal('fetch', reply(429, { success: false, errors: [{ message: 'Capacity temporarily exceeded' }] }))
    await expect(generateFluxImage(config, 'a cafe', 1)).rejects.not.toBeInstanceOf(AllowanceSpentError)
    expect(imageAllowanceSpent()).toBe(false)

    vi.stubGlobal('fetch', reply(429, { success: false, errors: [{ message: '4006: you have used up your daily free allocation of 10,000 neurons' }] }))
    await expect(generateFluxImage(config, 'a cafe', 1)).rejects.toBeInstanceOf(AllowanceSpentError)
    expect(imageAllowanceSpent()).toBe(true)
    expect(imageAllowanceSpent(nextUtcMidnight(Date.now()) + 1)).toBe(false)
  })
})

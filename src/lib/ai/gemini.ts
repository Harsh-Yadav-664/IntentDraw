import { GoogleGenerativeAI, type Part } from '@google/generative-ai'

let _instance: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!_instance) {
    const key = process.env.GOOGLE_AI_API_KEY
    if (!key) throw new Error('Missing GOOGLE_AI_API_KEY environment variable')
    _instance = new GoogleGenerativeAI(key)
  }
  return _instance
}

/**
 * Gemini 2.5 Flash — supports vision, used for canvas analysis,
 * intent classification, design-token resolution and code generation.
 */
export function getVisionModel() {
  return getClient().getGenerativeModel({ model: 'gemini-2.5-flash' })
}

/**
 * Alias of getVisionModel — same underlying model. Kept so call sites
 * can express intent (vision task vs generation task) explicitly.
 */
export function getProModel() {
  return getClient().getGenerativeModel({ model: 'gemini-2.5-flash' })
}

/**
 * Parse Gemini's RetryInfo `retryDelay` ("9s" / "9.18s") out of a 429 error
 * message → milliseconds, with a small cushion and a hard cap. Falls back to
 * exponential backoff (4s → 8s → 16s) when the field is absent.
 */
function parseRetryDelayMs(errorMessage: string, attempt: number): number {
  const m = errorMessage.match(/retryDelay["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)\s*s/i)
  if (m) {
    const secs = parseFloat(m[1])
    // +0.75s cushion so we clear the window edge; cap at 20s to stay in budget.
    return Math.min(Math.ceil((secs + 0.75) * 1000), 20000)
  }
  return Math.min(4000 * 2 ** attempt, 20000)
}

/**
 * Generate content with Gemini, retrying on a free-tier rate-limit (429 /
 * RESOURCE_EXHAUSTED). Free-tier `gemini-2.5-flash` has a low per-minute
 * request/token allowance; a burst of generations trips a 429 whose error
 * carries a short `retryDelay` (~seconds) — a PER-MINUTE limit that self-heals.
 * Rather than failing the whole request over to a weaker provider, we honor
 * that delay and retry. 429s reject almost instantly, so the retry wait plus a
 * fresh attempt stays comfortably within the caller's time budget.
 *
 * A fresh AbortSignal.timeout is created per attempt — a signal that has
 * already fired can't be reused.
 */
export async function geminiGenerate(
  contentParts: Part[],
  opts?: { perAttemptTimeoutMs?: number; maxRetries?: number }
): Promise<string> {
  const model = getProModel()
  const perAttemptTimeoutMs = opts?.perAttemptTimeoutMs ?? 120000
  const maxRetries = opts?.maxRetries ?? 2

  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(contentParts, {
        signal: AbortSignal.timeout(perAttemptTimeoutMs),
      })
      return result.response.text()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const isRateLimit = /\b429\b|too many requests|resource_exhausted|rate.?limit|\bquota\b/i.test(msg)
      if (!isRateLimit || attempt === maxRetries) throw err
      const waitMs = parseRetryDelayMs(msg, attempt)
      console.warn(`[Gemini] rate-limited (429); retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((res) => setTimeout(res, waitMs))
    }
  }
  throw lastErr
}
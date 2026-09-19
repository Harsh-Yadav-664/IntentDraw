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
 * Gemini models to use, best first.
 *
 * Checked 2026-09-19 by listing the key's models (GET /v1beta/models) and
 * sending each one a one-word request — never edit these from memory, dead
 * model IDs have broken this project before:
 *   - gemini-3.8/3.7/3.6/3.5-flash answer on the free tier
 *   - gemini-2.5-flash-lite and gemini-2.5-pro now return 404 "no longer
 *     available to new users", so gemini-2.5-flash (what this project used to
 *     pin) is on its way out too; it stays last only as a safety net
 *
 * Free-tier quota is per project PER MODEL (the 429 names it:
 * "GenerateRequestsPerDayPerProjectPerModel-FreeTier", 20/day for
 * gemini-2.5-flash). Pinning one model capped the whole app at ~4 generations a
 * day; walking a chain of models multiplies that, and puts the newest model
 * first.
 *
 * Override with GEMINI_MODELS="model-a,model-b" without a code change.
 */
export const GEMINI_MODELS: string[] = (process.env.GEMINI_MODELS ?? '')
  .split(',')
  .map(m => m.trim())
  .filter(Boolean)
const DEFAULT_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']
if (GEMINI_MODELS.length === 0) GEMINI_MODELS.push(...DEFAULT_GEMINI_MODELS)

/**
 * Models known to be unusable right now (daily quota spent, or retired), with
 * when to try them again. Skipping them costs nothing; asking would spend a
 * round trip — and a retry wait — on a guaranteed refusal. Per server instance.
 */
const unavailableUntil = new Map<string, number>()
const QUOTA_RECHECK_MS = 60 * 60 * 1000 // daily quotas reset once a day; re-check hourly
const RETIRED_RECHECK_MS = 24 * 60 * 60 * 1000
const OVERLOAD_RECHECK_MS = 2 * 60 * 1000

function usableModels(): string[] {
  const now = Date.now()
  const usable = GEMINI_MODELS.filter(m => (unavailableUntil.get(m) ?? 0) <= now)
  // Never return nothing: if everything is marked, try them all again.
  return usable.length > 0 ? usable : GEMINI_MODELS
}

/**
 * The best Gemini model not currently known to be exhausted. Used by the
 * older single-shot callers (intent classifier, style presets).
 */
export function getVisionModel() {
  return getClient().getGenerativeModel({ model: usableModels()[0] })
}

/** Alias of getVisionModel, kept so call sites can say what they use it for. */
export function getProModel() {
  return getVisionModel()
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

type Failure = 'daily-quota' | 'retired' | 'transient' | 'fatal'

/** What a Gemini error means for what to do next. */
export function classifyGeminiError(message: string): Failure {
  // A per-DAY quota won't recover by waiting seconds: move to the next model.
  if (/PerDay|per day|daily/i.test(message) && /\b429\b|quota|resource_exhausted/i.test(message)) return 'daily-quota'
  if (/\b404\b|no longer available|not found|is not supported/i.test(message)) return 'retired'
  // Per-minute limits and "high demand" 503s recover in seconds: wait and retry.
  if (/\b429\b|too many requests|resource_exhausted|rate.?limit|\bquota\b|\b503\b|service unavailable|high demand|overloaded/i.test(message)) {
    return 'transient'
  }
  return 'fatal'
}

/**
 * Generate with Gemini across the model chain.
 *
 * Per model: a transient failure (per-minute 429, 503 "high demand") waits —
 * honouring the server's retryDelay — and retries the same model; if it is
 * still failing after the retries, the next Gemini model is tried rather than
 * leaving Gemini for a weaker, often text-only provider. A spent daily quota or
 * a retired model moves on immediately. Unusable models are remembered so
 * later calls skip them for free. Only a real error (bad request, auth) — or
 * every model failing — is thrown for the provider chain to handle.
 *
 * Never set maxOutputTokens here: these are thinking models, and thinking
 * tokens consume the cap before any visible output (see CLAUDE.md).
 */
export async function geminiGenerate(
  contentParts: Part[],
  opts?: { perAttemptTimeoutMs?: number; maxRetries?: number }
): Promise<string> {
  const perAttemptTimeoutMs = opts?.perAttemptTimeoutMs ?? 120000
  const maxRetries = opts?.maxRetries ?? 2
  const client = getClient()

  let lastErr: unknown
  for (const modelName of usableModels()) {
    const model = client.getGenerativeModel({ model: modelName })

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(contentParts, {
          signal: AbortSignal.timeout(perAttemptTimeoutMs),
        })
        return result.response.text()
      } catch (err) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        const kind = classifyGeminiError(msg)

        if (kind === 'daily-quota' || kind === 'retired') {
          unavailableUntil.set(modelName, Date.now() + (kind === 'retired' ? RETIRED_RECHECK_MS : QUOTA_RECHECK_MS))
          console.warn(`[Gemini] ${modelName}: ${kind === 'retired' ? 'unavailable' : 'daily quota spent'} — trying the next model`)
          break // next model
        }
        if (kind === 'fatal') throw err
        if (attempt === maxRetries) {
          // Still overloaded/limited after waiting: the next Gemini model has
          // its own capacity and is far better than leaving Gemini for a
          // text-only provider. Skip this one briefly — "high demand" tends to
          // last minutes, and every call would otherwise re-spend the waits.
          unavailableUntil.set(modelName, Date.now() + OVERLOAD_RECHECK_MS)
          console.warn(`[Gemini] ${modelName}: still unavailable after retries — trying the next model`)
          break
        }

        const waitMs = parseRetryDelayMs(msg, attempt)
        console.warn(
          `[Gemini] ${modelName}: ${/\b503\b|high demand|overloaded|unavailable/i.test(msg) ? 'overloaded (503)' : 'rate-limited (429)'}; retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
        )
        await new Promise(res => setTimeout(res, waitMs))
      }
    }
  }
  throw lastErr
}

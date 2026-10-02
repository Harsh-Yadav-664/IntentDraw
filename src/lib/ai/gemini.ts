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
 * Models known to be unusable right now (daily quota spent, retired, or
 * overloaded), with when to try them again. Skipping them costs nothing; asking
 * would spend a round trip on a guaranteed refusal. Per server instance.
 */
const unavailableUntil = new Map<string, number>()
const QUOTA_RECHECK_MS = 60 * 60 * 1000 // daily quotas reset once a day; re-check hourly
const RETIRED_RECHECK_MS = 24 * 60 * 60 * 1000
// "High demand" 503s on the free tier last minutes, not seconds (2026-10-02:
// 3.8, 3.7 and 3.6 all overloaded for an afternoon). Waiting and retrying the
// same model spent ~4 minutes per generation and still failed.
const OVERLOAD_RECHECK_MS = 3 * 60 * 1000

/** The model that answered most recently — tried first next time. */
let lastGood: string | null = null

export function usableModels(now = Date.now()): string[] {
  const usable = GEMINI_MODELS.filter(m => (unavailableUntil.get(m) ?? 0) <= now)
  // Never return nothing: if everything is marked, try them all again.
  const list = usable.length > 0 ? usable : [...GEMINI_MODELS]
  if (lastGood && list.includes(lastGood)) return [lastGood, ...list.filter(m => m !== lastGood)]
  return list
}

/** Test hook: forget every remembered failure and success. */
export function resetGeminiState(): void {
  unavailableUntil.clear()
  lastGood = null
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
 * message → milliseconds, with a small cushion and a hard cap.
 */
function parseRetryDelayMs(errorMessage: string): number {
  const m = errorMessage.match(/retryDelay["']?s*[:=]s*["']?(d+(?:.d+)?)s*s/i)
  if (m) return Math.min(Math.ceil((parseFloat(m[1]) + 0.75) * 1000), 20000)
  return 5000
}

type Failure = 'daily-quota' | 'retired' | 'overloaded' | 'rate-limited' | 'fatal'

/** What a Gemini error means for what to do next. */
export function classifyGeminiError(message: string): Failure {
  // A per-DAY quota won't recover by waiting seconds: move to the next model.
  if (/PerDay|per day|daily/i.test(message) && /429|quota|resource_exhausted/i.test(message)) return 'daily-quota'
  if (/404|no longer available|not found|is not supported/i.test(message)) return 'retired'
  // Capacity problems on Google's side — the next model has its own capacity.
  if (/503|500|service unavailable|high demand|overloaded|internal error|timed out|aborted/i.test(message)) return 'overloaded'
  // A per-minute limit clears in seconds: one short wait is worth it.
  if (/429|too many requests|resource_exhausted|rate.?limit|quota/i.test(message)) return 'rate-limited'
  return 'fatal'
}

/**
 * Generate with Gemini across the model chain.
 *
 * - overloaded (503 "high demand", 500, a hung request): skip this model for a
 *   few minutes and try the next one immediately
 * - per-minute 429: one wait (the server's own retryDelay, capped), then move on
 * - spent daily quota / retired model: remembered, next model immediately
 * - anything else (bad request, auth): thrown for the provider chain
 *
 * `deadlineMs` bounds the whole walk. Without it a busy afternoon spent the
 * entire request budget on overloaded models and the chain never reached a
 * provider that would have answered.
 *
 * Never set maxOutputTokens here: these are thinking models, and thinking
 * tokens consume the cap before any visible output (see CLAUDE.md).
 */
export async function geminiGenerate(
  contentParts: Part[],
  opts?: { perAttemptTimeoutMs?: number; deadlineMs?: number }
): Promise<string> {
  const perAttemptTimeoutMs = opts?.perAttemptTimeoutMs ?? 120000
  const deadline = Date.now() + (opts?.deadlineMs ?? 150000)
  const client = getClient()

  let lastErr: unknown = new Error('Gemini: no model attempted')
  for (const modelName of usableModels()) {
    const model = client.getGenerativeModel({ model: modelName })

    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining < 5000) throw lastErr
      try {
        const result = await model.generateContent(contentParts, {
          signal: AbortSignal.timeout(Math.min(perAttemptTimeoutMs, remaining)),
        })
        lastGood = modelName
        return result.response.text()
      } catch (err) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        const kind = classifyGeminiError(msg)
        if (kind === 'fatal') throw err

        if (kind === 'rate-limited' && attempt === 0) {
          const waitMs = Math.min(parseRetryDelayMs(msg), Math.max(0, deadline - Date.now() - 5000))
          console.warn(`[Gemini] ${modelName}: rate-limited (429); retrying once in ${Math.round(waitMs / 1000)}s`)
          await new Promise(res => setTimeout(res, waitMs))
          continue
        }

        const recheck =
          kind === 'retired' ? RETIRED_RECHECK_MS
          : kind === 'daily-quota' ? QUOTA_RECHECK_MS
          : OVERLOAD_RECHECK_MS
        unavailableUntil.set(modelName, Date.now() + recheck)
        if (lastGood === modelName) lastGood = null
        console.warn(`[Gemini] ${modelName}: ${kind} — trying the next model`)
        break
      }
    }
  }
  throw lastErr
}

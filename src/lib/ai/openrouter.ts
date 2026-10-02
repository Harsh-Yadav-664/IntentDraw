/**
 * OpenRouter provider — raw `fetch` against an OpenAI-compatible endpoint,
 * same shape as `nvidia.ts` (no SDK).
 *
 * Why it exists: model quality is the ceiling on output quality here. Groq's
 * gpt-oss-120b and NVIDIA's nemotron both emit duplicate declarations, missing
 * imports and malformed string literals in real runs; OpenRouter exposes
 * genuinely strong *coding* models on a free tier, which is the cheapest
 * available lever on generated-code quality.
 *
 * ---------------------------------------------------------------------------
 * MODEL IDs — verified against the live catalogue on 2026-09-19.
 * Re-check with:  curl -s https://openrouter.ai/api/v1/models
 * and keep only entries whose `pricing.prompt` AND `pricing.completion` are
 * both "0". Dead model IDs have broken this project twice already
 * (`llama-3.1-70b-versatile`, `meta/llama-3.1-70b-instruct`) — never edit these
 * strings from memory, always re-query the catalogue.
 * ---------------------------------------------------------------------------
 */

/**
 * Free text models, best first, sent as one `models` list: OpenRouter falls
 * back down the list by itself on rate limits and downtime, in one request.
 * The API accepts at most 3 entries (a longer list is a 400).
 * Re-verified 2026-10-02 — the previous pair (deepseek-v4-flash:free,
 * glm-5.2:free) had been removed from the free catalogue, so every OpenRouter
 * call was failing.
 */
export const OPENROUTER_TEXT_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'poolside/laguna-s-2.1:free',
] as const
export const OPENROUTER_DEFAULT_MODEL: string = OPENROUTER_TEXT_MODELS[0]

/** Free models that accept image input (catalogue `input_modalities` includes "image"). */
export const OPENROUTER_VISION_MODELS = [
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
] as const

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Unlike Groq — whose free tier counts `max_tokens` against an ~8k per-minute
 * budget UP FRONT (which is why groq.ts is pinned to 5000) — OpenRouter meters
 * free models by requests per day, not by a reserved token budget, so a
 * generous cap costs nothing and simply avoids truncation. These models also
 * emit reasoning tokens before any real output, so leave real headroom.
 */
const MAX_TOKENS = 16000

/** Per-attempt socket timeout; the orchestrator layers its own backstop on top. */
const ATTEMPT_TIMEOUT_MS = 90000

const MAX_RETRIES = 2

type OpenRouterMessage = {
  role: 'system' | 'user'
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >
}

/**
 * How long to wait before retrying a 429. OpenRouter reports the reset either
 * as a `Retry-After` header (seconds) or `X-RateLimit-Reset` (epoch ms).
 * Mirrors gemini.ts: honor the server's own number, cap it so we stay inside
 * the caller's time budget, and fall back to exponential backoff.
 */
function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter) {
    const secs = parseFloat(retryAfter)
    if (Number.isFinite(secs) && secs >= 0) {
      // +0.75s cushion so we clear the window edge; 20s cap matches gemini.ts.
      return Math.min(Math.ceil((secs + 0.75) * 1000), 20000)
    }
  }
  const reset = response.headers.get('x-ratelimit-reset')
  if (reset) {
    const resetAt = parseInt(reset, 10)
    if (Number.isFinite(resetAt)) {
      const waitMs = resetAt - Date.now()
      if (waitMs > 0) return Math.min(waitMs + 750, 20000)
    }
  }
  return Math.min(4000 * 2 ** attempt, 20000)
}

/**
 * Turn a non-2xx OpenRouter response into an error whose message is readable on
 * its own. 402 in particular is NOT a bug — it is the free model's daily
 * allowance running out — and must not look like one.
 */
function describeFailure(status: number, body: string): string {
  const detail = body.slice(0, 300).replace(/\s+/g, ' ').trim()
  if (status === 402) {
    return `OpenRouter 402: free-model daily allowance exhausted — this is expected on the free tier, not a bug. Wait for the daily reset (or add credit at https://openrouter.ai/settings/credits to raise the limit). ${detail}`
  }
  if (status === 401 || status === 403) {
    return `OpenRouter ${status}: API key rejected — set OPENROUTER_API_KEY in .env.local (create a key at https://openrouter.ai/keys). ${detail}`
  }
  if (status === 429) {
    return `OpenRouter 429: rate limit reached — free models allow a limited number of requests per minute/day. ${detail}`
  }
  if (status === 404) {
    return `OpenRouter 404: model unavailable — re-check the live catalogue at https://openrouter.ai/api/v1/models. ${detail}`
  }
  return `OpenRouter API Error (${status}): ${detail}`
}

export interface OpenRouterOptions {
  /** Raw base64 PNG (no data-URL prefix). Forces a vision-capable model. */
  imageBase64?: string
}

/**
 * Generate a completion via OpenRouter.
 *
 * Takes the system prompt and user prompt separately for the same reason the
 * other providers do: user input never goes into the system message.
 */
export async function openrouterGenerate(
  systemPrompt: string,
  userPrompt: string,
  modelId: string = OPENROUTER_DEFAULT_MODEL,
  options: OpenRouterOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is missing from environment variables — create a free key at https://openrouter.ai/keys and add OPENROUTER_API_KEY=... to .env.local'
    )
  }

  const { imageBase64 } = options
  // Sending an image to a text-only model is silently dropped upstream, so an
  // image means the vision list. A caller's explicit pick goes first.
  const preferred: readonly string[] = imageBase64 ? OPENROUTER_VISION_MODELS : OPENROUTER_TEXT_MODELS
  const models = [...new Set([...(preferred.includes(modelId) ? [modelId] : []), ...preferred])].slice(0, 3)

  const userContent: OpenRouterMessage['content'] = imageBase64
    ? [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ]
    : userPrompt

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  let lastErr: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        // Fresh signal per attempt — an AbortSignal that already fired can't be
        // reused. Abort the socket so the fallback chain can move on.
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          // OpenRouter asks for these for attribution / leaderboard ranking.
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://intentdraw.app',
          'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'IntentDraw',
        },
        body: JSON.stringify({
          models,
          messages,
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: MAX_TOKENS,
          // These are reasoning models. Thinking tokens are billed against the
          // output cap before any real code appears — the same trap that
          // truncated Gemini when maxOutputTokens was set. We want code, not a
          // chain of thought, so ask for reasoning to be off; OpenRouter drops
          // this for models that don't support toggling it.
          reasoning: { enabled: false },
        }),
      })
    } catch (err) {
      // Network error / AbortSignal timeout: not retryable here, the fallback
      // chain owns cross-provider retries.
      throw err instanceof Error
        ? new Error(`OpenRouter request failed: ${err.message}`)
        : new Error(`OpenRouter request failed: ${String(err)}`)
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const waitMs = retryDelayMs(response, attempt)
      console.warn(
        `[OpenRouter] rate-limited (429); retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`
      )
      await new Promise(res => setTimeout(res, waitMs))
      continue
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      lastErr = new Error(describeFailure(response.status, body))
      throw lastErr
    }

    const result = await response.json()

    // OpenRouter can answer 200 with an `error` object when the upstream
    // provider fails mid-route, so an ok status is not enough.
    if (result?.error) {
      const message = result.error.message || JSON.stringify(result.error)
      throw new Error(describeFailure(result.error.code ?? response.status, message))
    }

    const content: string = result?.choices?.[0]?.message?.content ?? ''
    if (!content) {
      const finish = result?.choices?.[0]?.finish_reason ?? 'unknown'
      throw new Error(`OpenRouter returned no content (finish_reason: ${finish})`)
    }
    return content
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('OpenRouter: rate limit persisted after retries')
}

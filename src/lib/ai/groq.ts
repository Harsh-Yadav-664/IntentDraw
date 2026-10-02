import Groq from 'groq-sdk'

let _instance: Groq | null = null

/**
 * Returns a singleton Groq client.
 * Lazy initialization — same pattern as Gemini client.
 */
function getClient(): Groq {
  if (!_instance) {
    const key = process.env.GROQ_API_KEY
    if (!key) throw new Error('Missing GROQ_API_KEY environment variable')
    // timeout: cap a single request so a hung call fails over quickly.
    // maxRetries: 0 — the provider fallback chain already handles failover,
    // so we don't want the SDK stacking its own retries/backoff on top.
    _instance = new Groq({ apiKey: key, timeout: 60000, maxRetries: 0 })
  }
  return _instance
}

/**
 * Text: gpt-oss-120b — fast (~7s), returns clean fenced TSX. (llama-3.1-70b-
 * versatile was decommissioned; verified against the live API 2026-08-30.)
 *
 * Vision: qwen3.8-27b. Verified 2026-10-02 by sending it an image (it named the
 * shape correctly in under a second). This matters more than it looks: when
 * Gemini's free tier is overloaded, Groq used to be the provider that wrote the
 * whole site — reading a drawing it could not see.
 */
export const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b'
export const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b'

/**
 * Generates a completion on Groq.
 * Used as fallback when Gemini fails or hits rate limits.
 * 
 * Takes a system prompt and user prompt separately to enforce
 * the prompt injection rule: user input never goes in system message.
 */
export async function groqGenerate(
  systemPrompt: string,
  userPrompt: string,
  options: { imageBase64?: string } = {}
): Promise<string> {
  const client = getClient()
  const { imageBase64 } = options

  const completion = await client.chat.completions.create({
    // An attached image switches to the vision model — see GROQ_VISION_MODEL.
    model: imageBase64 ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      imageBase64
        ? {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,' + imageBase64 } },
            ],
          }
        : { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    top_p: 0.7,
    // Groq's free tier enforces a per-minute token budget (~8k TPM for
    // gpt-oss-120b) and counts `max_tokens` against it UP FRONT — so
    // input(~2-3k) + max_tokens(8000) blew past the cap and Groq rejected the
    // whole request with "please reduce your message size". 5000 leaves room
    // for the prompt while still fitting a full single-page site (~18KB of TSX,
    // comfortably more than the ~13KB a rich page needs).
    max_tokens: 5000,
  })

  return completion.choices[0]?.message?.content || ''
}
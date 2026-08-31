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
 * Generates a completion using Groq's Llama model.
 * Used as fallback when Gemini fails or hits rate limits.
 * 
 * Takes a system prompt and user prompt separately to enforce
 * the prompt injection rule: user input never goes in system message.
 */
export async function groqGenerate(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = getClient()

  const completion = await client.chat.completions.create({
    // llama-3.1-70b-versatile was decommissioned by Groq. gpt-oss-120b is a
    // fast (~7s), high-quality instruct model currently live on this account
    // and returns clean fenced TSX. Verified against the live API 2026-08-30.
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
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
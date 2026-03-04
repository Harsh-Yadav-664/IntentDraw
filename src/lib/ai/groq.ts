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
    _instance = new Groq({ apiKey: key })
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
    model: 'llama-3.1-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  })

  return completion.choices[0]?.message?.content || ''
}
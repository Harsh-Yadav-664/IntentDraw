export async function nvidiaGenerate(
  systemPrompt: string,
  userPrompt: string,
  modelId: string = 'nvidia/nemotron-3.5-lightning-30b-a3b' // Default, overridden by UI. NOTE: meta/llama-3.1-70b-instruct reached EOL 2026-08-26; NVIDIA models are currently slow/unreliable — prefer Gemini or Groq.
): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY
  if (!apiKey) {
    throw new Error('NVIDIA_NIM_API_KEY is missing from environment variables')
  }

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    // Abort the socket if NVIDIA doesn't respond in time so the provider
    // fallback chain can move on instead of hanging.
    signal: AbortSignal.timeout(60000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 8000,
    }),
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`NVIDIA API Error (${response.status}): ${errorData}`)
  }

  const result = await response.json()
  return result.choices[0].message.content
}

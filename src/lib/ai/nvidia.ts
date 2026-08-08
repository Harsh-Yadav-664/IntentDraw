export async function nvidiaGenerate(
  systemPrompt: string,
  userPrompt: string,
  modelId: string = 'meta/llama-3.1-70b-instruct'
): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY
  if (!apiKey) {
    throw new Error('NVIDIA_NIM_API_KEY is missing from environment variables')
  }

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
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
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`NVIDIA API Error (${response.status}): ${errorData}`)
  }

  const result = await response.json()
  return result.choices[0].message.content
}

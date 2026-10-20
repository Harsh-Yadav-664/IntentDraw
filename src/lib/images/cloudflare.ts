/**
 * Image generation on Cloudflare Workers AI — FLUX.1 [schnell].
 *
 * Chosen 2026-10-20: the weights are Apache-2.0 (no credit line on the site),
 * the free allocation (10,000 neurons/day) is roughly 170 images a day at the
 * default 4 steps, and an image takes a few seconds. Gemini's image models are
 * limit 0 on the free key; Pollinations' free tier drew the wrong subject.
 *
 * Output is a 1024×1024 JPEG; pages crop it with object-cover, which is why
 * prompts ask for the subject well inside the frame.
 */

const MODEL = '@cf/black-forest-labs/flux-1-schnell'

export interface CloudflareImageConfig {
  accountId: string
  token: string
}

export function cloudflareImageConfig(): CloudflareImageConfig | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  return accountId && token ? { accountId, token } : null
}

/** One image as JPEG bytes. Throws with the provider's message on failure. */
export async function generateFluxImage(
  config: CloudflareImageConfig,
  prompt: string,
  seed: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 4, seed: Math.max(1, Math.floor(seed)) }),
    signal,
  })
  const data = (await res.json().catch(() => null)) as {
    success?: boolean
    result?: { image?: string }
    errors?: Array<{ message?: string }>
  } | null
  const image = data?.result?.image
  if (!res.ok || !image) {
    const message = data?.errors?.map(e => e.message).filter(Boolean).join('; ') || `HTTP ${res.status}`
    throw new Error(`cloudflare: ${message}`)
  }
  return Uint8Array.from(Buffer.from(image, 'base64'))
}

/**
 * Generated images live in a public Supabase Storage bucket, addressed by a
 * hash of what was asked for — the same prompt never costs a second
 * generation, and a page keeps working as a plain URL (preview, share link,
 * exported HTML).
 *
 * Server-only: uploads use the service-role key, which never leaves the server.
 */
import { createHash } from 'crypto'

export const IMAGE_BUCKET = 'site-images'

interface StoreConfig {
  url: string
  serviceKey: string
}

export function imageStoreConfig(): StoreConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && serviceKey ? { url, serviceKey } : null
}

/** Where the image for this prompt and seed lives (or will). */
export function imagePath(prompt: string, seed: number): string {
  return `gen/${createHash('sha256').update(`flux-1-schnell\n${seed}\n${prompt}`).digest('hex').slice(0, 40)}.jpg`
}

export function publicImageUrl(config: StoreConfig, path: string): string {
  return `${config.url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`
}

const headers = (config: StoreConfig) => ({ Authorization: `Bearer ${config.serviceKey}`, apikey: config.serviceKey })

let bucketReady: Promise<void> | null = null

/** Creates the public bucket the first time it is needed; "already exists" is fine. */
export function ensureImageBucket(config: StoreConfig): Promise<void> {
  bucketReady ??= (async () => {
    const res = await fetch(`${config.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...headers(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: IMAGE_BUCKET,
        name: IMAGE_BUCKET,
        public: true,
        file_size_limit: 2 * 1024 * 1024,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (!/already exists|Duplicate/i.test(body)) throw new Error(`storage bucket: HTTP ${res.status} ${body.slice(0, 160)}`)
    }
  })().catch(error => {
    bucketReady = null
    throw error
  })
  return bucketReady
}

export async function imageExists(config: StoreConfig, path: string): Promise<boolean> {
  const res = await fetch(publicImageUrl(config, path), { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null)
  return !!res?.ok
}

export async function uploadImage(config: StoreConfig, path: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch(`${config.url}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...headers(config), 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`storage upload: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`)
}

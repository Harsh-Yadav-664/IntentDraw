import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cloudflareImageConfig, generateFluxImage } from '@/lib/images/cloudflare'
import { findImageSlots, imagePrompt, type ImageSlot } from '@/lib/images/slots'
import { ensureImageBucket, imageExists, imagePath, imageStoreConfig, publicImageUrl, uploadImage } from '@/lib/images/store'

export const maxDuration = 60

const MAX_CODE_CHARS = 60000
const MAX_IMAGES_PER_BLOCK = 8
const PARALLEL = 3
// The browser builds the next section meanwhile; this only bounds the wait at
// the end of a run.
const BUDGET_MS = 40000

/**
 * Makes the pictures one built block asks for, and answers with a map from
 * each keyword URL's key to the stored image. The block itself is not
 * touched — the browser adds the map to it (`withImageMap`).
 *
 * Runs while the next section is being built, so it adds no wait. Not
 * rate-limited: it is part of the generation the shell already charged.
 *
 * Our Cloudflare account pays for these, so a hosted deployment serves them
 * only when IMAGE_GENERATION_HOSTED=true (the owner's rule: our provider keys
 * are never spent on hosted visitors — BYOK covers that later).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown; imagery?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code.slice(0, MAX_CODE_CHARS) : ''
  const imagery = typeof body?.imagery === 'string' ? body.imagery.slice(0, 240) : ''
  if (!code) return NextResponse.json({ success: false, error: 'code is required' }, { status: 400 })

  const flux = cloudflareImageConfig()
  const store = imageStoreConfig()
  const allowed = process.env.NODE_ENV !== 'production' || process.env.IMAGE_GENERATION_HOSTED === 'true'
  if (!flux || !store || !allowed) {
    // Not an error: the page draws its pictures in code instead.
    return NextResponse.json({ success: true, data: { images: {}, skipped: 'not configured' } })
  }

  // One picture per subject: a carousel often shows the same dish at two sizes,
  // and the model's output is square anyway — every size maps to one image.
  const bySubject = new Map<string, ImageSlot[]>()
  for (const slot of findImageSlots(code)) {
    const subject = `${slot.description.toLowerCase()}|${slot.seed}`
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), slot])
  }
  const subjects = [...bySubject.values()].slice(0, MAX_IMAGES_PER_BLOCK)
  if (subjects.length === 0) return NextResponse.json({ success: true, data: { images: {} } })

  try {
    await ensureImageBucket(store)
  } catch (error) {
    console.warn('[api/generate/images]', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: true, data: { images: {}, skipped: 'storage unavailable' } })
  }

  const deadline = AbortSignal.timeout(BUDGET_MS)
  const images: Record<string, string> = {}
  const failures: string[] = []

  const make = async (slots: ImageSlot[]) => {
    // Framed for the largest place it appears.
    const [largest] = [...slots].sort((a, b) => b.width * b.height - a.width * a.height)
    const prompt = imagePrompt(largest, imagery)
    const path = imagePath(prompt, largest.seed)
    try {
      if (!(await imageExists(store, path))) {
        const bytes = await generateFluxImage(flux, prompt, largest.seed || 1, deadline)
        await uploadImage(store, path, bytes)
      }
      for (const slot of slots) images[slot.key] = publicImageUrl(store, path)
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }

  const queue = [...subjects]
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      for (let next = queue.shift(); next && !deadline.aborted; next = queue.shift()) await make(next)
    })
  )
  if (failures.length > 0) console.warn(`[api/generate/images] ${failures.length}/${subjects.length} failed:`, failures[0])

  return NextResponse.json({ success: true, data: { images, failed: failures.length } })
}

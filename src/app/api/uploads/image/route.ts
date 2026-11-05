import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureImageBucket, imageStoreConfig, publicImageUrl, uploadImage } from '@/lib/images/store'

export const maxDuration = 30

/** The bucket's own limit (store.ts); the editor shrinks larger pictures before sending. */
const MAX_BYTES = 2 * 1024 * 1024

/** The type a file really is, read from its first bytes — the browser's claim is not trusted. */
function sniff(bytes: Uint8Array): { type: 'image/jpeg' | 'image/png' | 'image/webp'; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: 'image/png', ext: 'png' }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { type: 'image/webp', ext: 'webp' }
  return null
}

/**
 * A picture of the user's own, put into their site in edit mode (issue #17).
 *
 * Stored in the same public bucket as generated images, under the user's own
 * folder and a hash of the bytes (the same picture is stored once), so the
 * site keeps working as a plain URL in the preview, share link and export.
 * JPEG, PNG and WebP only, up to 2 MB, checked by content.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 })
  }

  const store = imageStoreConfig()
  if (!store) {
    return NextResponse.json({ success: false, error: 'Picture uploads are not set up on this server (Supabase Storage keys are missing).' }, { status: 503 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ success: false, error: 'No picture was sent.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ success: false, error: 'That picture is larger than 2 MB.' }, { status: 413 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(bytes)
  if (!kind) return NextResponse.json({ success: false, error: 'Only JPEG, PNG and WebP pictures can be used.' }, { status: 415 })

  const path = `user/${user.id}/${createHash('sha256').update(bytes).digest('hex').slice(0, 40)}.${kind.ext}`
  try {
    await ensureImageBucket(store)
    await uploadImage(store, path, bytes, kind.type)
  } catch (error) {
    console.warn('[api/uploads/image]', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, error: 'The picture could not be stored. Try again in a moment.' }, { status: 502 })
  }
  return NextResponse.json({ success: true, data: { url: publicImageUrl(store, path) } })
}

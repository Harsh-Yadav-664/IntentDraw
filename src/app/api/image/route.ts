import { NextResponse } from 'next/server'

/**
 * Keyword → a real, on-topic photo, as a redirect.
 *
 * Generated pages keep portable `loremflickr.com/{w}/{h}/{keyword}?lock=n` URLs
 * (so an exported site still works anywhere); inside the app the preview runtime
 * rewrites them to this route, which fixes the two problems with using them
 * directly:
 *
 *   - Licensing: LoremFlickr serves Flickr Creative Commons photos with mixed
 *     licences — some attribution-only, some non-commercial. With
 *     PEXELS_API_KEY set, photos come from Pexels instead: a real keyword
 *     search, free for commercial use, no attribution required.
 *   - Reliability: LoremFlickr answers some keyword/lock pairs with one default
 *     stock photo (a cat statue), so unrelated cards showed the same picture.
 *     Without a Pexels key this route resolves the URL server-side, spots that
 *     default, and tries other photos for the same keyword.
 *
 * Only a redirect is returned — image bytes never pass through this server —
 * and lookups are cached, so each keyword costs one upstream call.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 2000

interface CacheEntry {
  value: string[]
  expires: number
}

// Per-instance memory. Serverless instances are short-lived, which is fine: the
// redirect itself is also cached by the browser/CDN for a day.
const cache = new Map<string, CacheEntry>()

function cached(key: string): string[] | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expires < Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.value
}

function remember(key: string, value: string[]) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)))

function redirect(url: string) {
  const res = NextResponse.redirect(url, 302)
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  return res
}

/** Pexels search results for a keyword: base photo URLs, resized per request. */
async function pexelsPhotos(query: string, key: string): Promise<string[]> {
  const hit = cached(`pexels:${query}`)
  if (hit) return hit

  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`pexels ${res.status}`)
  const data = (await res.json()) as { photos?: Array<{ src?: { original?: string } }> }
  const photos = (data.photos ?? []).map(p => p.src?.original).filter((u): u is string => !!u)
  remember(`pexels:${query}`, photos)
  return photos
}

/**
 * The final image URL LoremFlickr serves for a keyword and lock, skipping its
 * "no match" default. A few locks are tried because a miss is per-lock, not
 * per-keyword: the same tag works with one lock and falls back with another.
 */
async function loremflickrPhoto(query: string, w: number, h: number, lock: number): Promise<string | null> {
  const key = `lf:${query}:${w}x${h}:${lock}`
  const hit = cached(key)
  if (hit) return hit[0] ?? null

  for (let attempt = 0; attempt < 3; attempt++) {
    const tryLock = lock + attempt * 97
    try {
      const res = await fetch(`https://loremflickr.com/${w}/${h}/${encodeURIComponent(query)}?lock=${tryLock}`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok && !res.url.includes('defaultImage')) {
        remember(key, [res.url])
        return res.url
      }
    } catch {
      // Try the next lock.
    }
  }
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  // A keyword is plain text: this value goes into upstream URLs.
  const query = (url.searchParams.get('q') ?? '').toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().slice(0, 40)
  const w = clamp(Number(url.searchParams.get('w')) || 800, 16, 2400)
  const h = clamp(Number(url.searchParams.get('h')) || 600, 16, 2400)
  const i = clamp(Number(url.searchParams.get('i')) || 0, 0, 999)

  if (!query) return new NextResponse('q is required', { status: 400 })

  const pexelsKey = process.env.PEXELS_API_KEY
  if (pexelsKey) {
    try {
      const photos = await pexelsPhotos(query, pexelsKey)
      if (photos.length > 0) {
        const base = photos[i % photos.length]
        return redirect(`${base}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`)
      }
    } catch (err) {
      console.warn('[api/image] Pexels failed, falling back:', err instanceof Error ? err.message : err)
    }
  }

  const photo = await loremflickrPhoto(query, w, h, i)
  if (photo) return redirect(photo)

  // Nothing matched: a 404 makes the preview runtime show its labelled tile
  // rather than an unrelated photo.
  return new NextResponse('no image found', { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } })
}

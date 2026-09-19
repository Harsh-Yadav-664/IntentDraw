/**
 * Rewrites a keyword-photo URL from generated code into the URL the preview
 * should actually load.
 *
 * Generated pages use portable `https://loremflickr.com/{w}/{h}/{keyword}?lock=n`
 * URLs. Two things are wrong with loading them directly: the service matches
 * ALL of several keywords and answers a miss with one stock photo, and its
 * photos carry mixed Creative Commons licences. So:
 *   - with an app origin, the URL goes through `/api/image`, which serves Pexels
 *     photos when configured and otherwise resolves LoremFlickr server-side,
 *     skipping its "no match" default
 *   - without one (offline rendering), it stays direct, cut to one keyword
 *
 * This function is embedded into the sandboxed preview as source text
 * (`rewriteImageUrl.toString()`), so it must stay self-contained: no imports,
 * no references to anything outside its own body.
 */
export function rewriteImageUrl(url: string, origin: string): string {
  const m = /^https?:\/\/loremflickr\.com\/(\d+)\/(\d+)\/([^/?#]+)(?:\/(?:all|any))?(?:\?(?:[^#]*&)?lock=(\d+))?/.exec(url)
  if (!m) return url
  let first = m[3]
  try {
    first = decodeURIComponent(m[3])
  } catch {
    // keep the raw segment
  }
  first = first.split(',')[0].trim()
  if (origin) {
    return `${origin}/api/image?q=${encodeURIComponent(first)}&w=${m[1]}&h=${m[2]}&i=${m[4] || '0'}`
  }
  return `https://loremflickr.com/${m[1]}/${m[2]}/${encodeURIComponent(first)}${m[4] ? `?lock=${m[4]}` : ''}`
}

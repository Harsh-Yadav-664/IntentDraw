/**
 * The user's own pictures, put in place of generated ones in edit mode
 * (issue #17). A block carries a map from the original image — its keyword key
 * (`imageKey` in lib/images/slots.ts) or its exact URL — to the upload; the
 * preview runtime looks there before anything else, so the model's code is
 * never rewritten and a rebuilt section keeps the user's pictures.
 *
 * No parser here: page-parts.ts (main bundle) imports it.
 */

const USER_MARKER = '/* intentdraw:user-images */'
export const SAFE_USER_IMAGE_URL = /^https:\/\/[^"'`\s\\<>]+$/
/** A keyword key (`800x600/espresso/3`) or an image URL the page loads. */
export const SAFE_IMAGE_KEY = /^(?:\d+x\d+\/[^"'`\\]+\/\d+|https?:\/\/[^"'`\s\\<>]+)$/
export const MAX_IMAGE_KEY = 500

/** The pictures the user put in place of generated ones in this block. */
export function userImagesOf(code: string): Record<string, string> {
  const at = code.indexOf(USER_MARKER)
  if (at < 0) return {}
  const m = /\),\s*(\{[^;]*\})\);/.exec(code.slice(at))
  try {
    const parsed = m ? (JSON.parse(m[1]) as Record<string, unknown>) : {}
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string' && SAFE_IMAGE_KEY.test(e[0]) && SAFE_USER_IMAGE_URL.test(e[1])))
  } catch {
    return {}
  }
}

/** The block without its map of user pictures. */
export function withoutUserImages(code: string): string {
  const at = code.indexOf(USER_MARKER)
  if (at < 0) return code
  const end = code.indexOf(';\n', at)
  return (code.slice(0, at) + (end < 0 ? '' : code.slice(end + 2))).trimEnd() + '\n'
}

/** The block with this map of user pictures (replacing any it had). Unsafe entries are dropped. */
export function withUserImages(code: string, images: Record<string, string>): string {
  const base = withoutUserImages(code)
  const entries = Object.entries(images).filter(([key, url]) => key.length <= MAX_IMAGE_KEY && SAFE_IMAGE_KEY.test(key) && SAFE_USER_IMAGE_URL.test(url))
  if (entries.length === 0) return base
  return `${base.trimEnd()}\n\n${USER_MARKER}\nObject.assign((globalThis.__intentdrawUserImages = globalThis.__intentdrawUserImages || {}), ${JSON.stringify(Object.fromEntries(entries))});\n`
}

/** Adds one picture to a block's map. */
export function setUserImage(code: string, key: string, url: string): string {
  return withUserImages(code, { ...userImagesOf(code), [key]: url })
}

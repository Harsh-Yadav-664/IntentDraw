/**
 * Where a generated page wants a picture, and what that picture should show.
 *
 * Sections write portable keyword URLs (`https://loremflickr.com/{w}/{h}/{keyword}?lock={n}`,
 * see the IMAGES rule in prompts.ts). That URL is the hook: each one becomes a
 * generated image, described by the alt text next to it — the keyword alone
 * ("tacos") says far less than "three tacos al pastor on a clay plate, close-up".
 *
 * The code itself is never rewritten. Each block gets one statement that maps
 * its keyword URLs to the images made for them, and the preview runtime looks
 * every image up there (`imageKey`) as React sets its src. That is what makes
 * URLs built at runtime work too — models very often write
 * `…/${item.imageKeyword}?lock=${item.lockNum}` over a data array, which no
 * string replacement could reach.
 *
 * Pure and client-safe: the browser adds the map to a block once its images exist.
 */

export interface ImageSlot {
  /** Lookup key: the same one `imageKey` computes from the URL at runtime. */
  key: string
  keyword: string
  width: number
  height: number
  /** The lock number — keeps two pictures of one subject different. */
  seed: number
  /** What the picture shows: its alt, or the text fields of the item it belongs to. */
  description: string
}

const LITERAL_URL = /(["'`])https?:\/\/loremflickr\.com\/(\d{2,4})\/(\d{2,4})\/([a-z0-9%,+_-]+)(?:\/(?:all|any))?(?:\?lock=(\d{1,4}))?\1/gi
// `https://loremflickr.com/300/200/${imageKeyword}?lock=${item.lockNum}` — the
// keyword (and maybe the lock) read from the item being rendered.
const TEMPLATE_URL = /`https?:\/\/loremflickr\.com\/(\d{2,4})\/(\d{2,4})\/\$\{\s*(?:[\w$]+\.)*([\w$]+)\s*\}(?:\?lock=(?:(\d{1,4})|\$\{\s*(?:[\w$]+\.)*([\w$]+)\s*\}))?`/g

// Item fields that say what an item's picture shows.
const DESCRIBING_KEYS = /^(?:alt|imageAlt|name|title|dish|subject|caption|label|description|desc)$/

const MAX_DESCRIPTION = 200
const MAP_MARKER = '/* intentdraw:site-images */'

const clean = (text: string) =>
  text
    .replace(/\\(["'`])/g, '$1')
    .replace(/[\u0000-\u001f<>{}`$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The lookup key for a keyword image URL, or null for any other URL. Embedded
 * in the preview runtime from its source text, so it must stay self-contained.
 */
export function imageKey(url: string): string | null {
  const m = /^https?:\/\/loremflickr\.com\/(\d+)\/(\d+)\/([^/?#]+)(?:\/(?:all|any))?(?:\?(?:[^#]*&)?lock=(\d+))?/i.exec(url)
  if (!m) return null
  let keyword = m[3]
  try {
    keyword = decodeURIComponent(keyword)
  } catch {
    // keep the raw segment
  }
  keyword = keyword.split(',')[0].replace(/[+_-]+/g, ' ').trim().toLowerCase()
  return m[1] + 'x' + m[2] + '/' + keyword + '/' + (m[4] || '0')
}

/** The alt="…" (or alt={'…'}) of the JSX element whose src holds this URL. */
function altOfElement(code: string, at: number): string {
  const open = code.lastIndexOf('<', at)
  if (open < 0 || /[^=]>/.test(code.slice(open, at))) return ''
  const close = code.indexOf('/>', at)
  const tag = code.slice(open, close < 0 ? at + 600 : close)
  const alt = /\balt=(?:"([^"]*)"|'([^']*)'|\{\s*["']([^"']*)["']\s*\})/.exec(tag)
  return alt ? clean(alt[1] ?? alt[2] ?? alt[3] ?? '') : ''
}

/**
 * The `{ … }` object literal the text at `at` sits in, if any, by brace
 * matching that skips strings. '' when it is not inside one.
 */
function enclosingObject(code: string, at: number): string {
  let depth = 0
  let start = -1
  for (let i = at - 1; i >= 0 && i > at - 2000; i--) {
    const ch = code[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth--
    } else if (ch === ';' && depth === 0) return ''
  }
  if (start < 0) return ''
  depth = 0
  for (let i = start; i < code.length && i < start + 4000; i++) {
    const ch = code[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      let end = i + 1
      while (end < code.length && code[end] !== ch) end += code[end] === '\\' ? 2 : 1
      if (end >= code.length) return ''
      i = end
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return code.slice(start, i + 1)
  }
  return ''
}

/** Every `key: 'string'` and `key: 123` field of an object literal, in order. */
function fieldsOf(object: string): Array<[string, string]> {
  const found: Array<[string, string]> = []
  const field = /([A-Za-z_$][\w$]*)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\d{1,6})\b)/g
  for (const m of object.matchAll(field)) found.push([m[1], clean(m[2] ?? m[3] ?? m[4] ?? '')])
  return found
}

/** What an item says about its own picture: its alt, else its name and description. */
function describingFields(object: string): string {
  const found = fieldsOf(object).filter(([key]) => DESCRIBING_KEYS.test(key))
  const alt = found.find(([key]) => /alt/i.test(key))
  if (alt?.[1]) return alt[1]
  return found
    .filter(([, value]) => value && !/^https?:/.test(value) && !/^\d+$/.test(value))
    .map(([, value]) => value)
    .join(' — ')
}

function slotFor(width: string, height: string, keyword: string, lock: string | undefined, description: string): ImageSlot | null {
  const key = imageKey(`https://loremflickr.com/${width}/${height}/${keyword}${lock ? `?lock=${lock}` : ''}`)
  if (!key) return null
  const [, word] = key.split('/')
  return {
    key,
    keyword: word,
    width: Number(width),
    height: Number(height),
    seed: Number(lock ?? 0),
    description: (description || word).slice(0, MAX_DESCRIPTION),
  }
}

/** Every keyword picture in a block of generated code, one slot per distinct image. */
export function findImageSlots(code: string): ImageSlot[] {
  const slots = new Map<string, ImageSlot>()
  const add = (slot: ImageSlot | null) => {
    if (slot && !slots.has(slot.key)) slots.set(slot.key, slot)
  }

  for (const m of code.matchAll(LITERAL_URL)) {
    const at = m.index ?? 0
    add(slotFor(m[2], m[3], m[4], m[5], altOfElement(code, at) || describingFields(enclosingObject(code, at))))
  }

  // A URL built from an item's fields: every object literal holding that
  // keyword field is one picture, described by its own name and text.
  for (const m of code.matchAll(TEMPLATE_URL)) {
    const [, width, height, keywordField, fixedLock, lockField] = m
    const holders = new RegExp(`\\b${keywordField.replace(/\$/g, '\\$')}\\s*:\\s*["']`, 'g')
    for (const h of code.matchAll(holders)) {
      const object = enclosingObject(code, (h.index ?? 0) + 1)
      if (!object) continue
      const fields = new Map(fieldsOf(object))
      const keyword = fields.get(keywordField)
      if (!keyword || !/^[a-z0-9 ,+_-]+$/i.test(keyword)) continue
      const lock = fixedLock ?? (lockField ? fields.get(lockField) : undefined)
      if (lockField && !/^\d+$/.test(lock ?? '')) continue
      add(slotFor(width, height, encodeURIComponent(keyword), lock, describingFields(object)))
    }
  }
  return [...slots.values()]
}

/** The prompt an image model gets for one slot. */
export function imagePrompt(slot: ImageSlot, imagery: string): string {
  const shape = slot.width > slot.height * 1.3 ? 'wide landscape framing' : slot.height > slot.width * 1.3 ? 'tall portrait framing' : 'square framing'
  const direction = clean(imagery) || 'Editorial photograph, natural light, considered composition'
  const subject = slot.description.toLowerCase().includes(slot.keyword) ? slot.description : `${slot.description} (${slot.keyword})`
  return `${subject}. ${direction}. ${shape}, subject well inside the frame. No text, no lettering, no logos, no watermark.`
}

const SAFE_IMAGE_URL = /^https:\/\/[^"'`\s\\<>]+$/

/**
 * The block with its image map: keyword-URL key → the image made for it.
 * Replaces the block's previous map; unsafe URLs are dropped.
 */
export function withImageMap(code: string, made: Record<string, string>): string {
  const base = withoutImageMap(code)
  const entries = Object.entries(made).filter(([key, url]) => /^\d+x\d+\/[^"'`\\]+\/\d+$/.test(key) && SAFE_IMAGE_URL.test(url))
  if (entries.length === 0) return base
  const map = JSON.stringify(Object.fromEntries(entries))
  return `${base.trimEnd()}\n\n${MAP_MARKER}\nObject.assign((globalThis.__intentdrawImages = globalThis.__intentdrawImages || {}), ${map});\n`
}

/** The block without its image map. */
export function withoutImageMap(code: string): string {
  const at = code.indexOf(MAP_MARKER)
  if (at < 0) return code
  const end = code.indexOf(';\n', at)
  return (code.slice(0, at) + (end < 0 ? '' : code.slice(end + 2))).trimEnd() + '\n'
}

/** The image map a block already carries. */
export function imageMapOf(code: string): Record<string, string> {
  const at = code.indexOf(MAP_MARKER)
  if (at < 0) return {}
  const m = /\),\s*(\{[^;]*\})\);/.exec(code.slice(at))
  try {
    return m ? (JSON.parse(m[1]) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

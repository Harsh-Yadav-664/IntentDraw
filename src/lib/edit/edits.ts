import { parse } from '@babel/parser'
import type { PageParts } from '@/lib/ai/page-parts'
import { MAX_IMAGE_KEY, SAFE_IMAGE_KEY, SAFE_USER_IMAGE_URL, setUserImage, userImagesOf, withUserImages } from './user-images'

/**
 * Edit mode: small changes to a built site with no model call (issue #17).
 *
 * - **Text** is changed in the section's own source, through the AST: the one
 *   string the clicked words came from (JSX text, a string literal, a plain
 *   template) is replaced. Nothing is matched with regexes, the change lives in
 *   the code itself, so it survives a reload, the share link and the export.
 * - **Pictures** are never rewritten in code. Each block may carry a map from
 *   the original image (its keyword key, or its exact URL) to the user's own
 *   upload; the preview runtime looks there first (`__fixImageUrl`). A rebuilt
 *   section keeps the user's pictures (`replaceSection` carries the map over).
 *
 * Pure and client-safe; the editor loads it on demand (it pulls in the parser).
 */

/** Longest text one edit may write. Headlines, prices, an address — not articles. */
export const MAX_EDIT_CHARS = 600

interface Node {
  type: string
  start?: number | null
  end?: number | null
  [key: string]: unknown
}

/** Text as a reader sees it: entities decoded, whitespace collapsed. */
export function visibleText(raw: string): string {
  return raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** What the user typed, made safe to write: one line, no control characters, capped. */
export function cleanEditText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_EDIT_CHARS)
}

// Attributes whose strings a reader sees; class names, ids, hrefs and the like are never edited.
const VISIBLE_ATTRIBUTES = new Set(['alt', 'title', 'placeholder', 'aria-label', 'label', 'value'])

interface Candidate {
  start: number
  end: number
  /** The source written in its place. */
  write: (text: string) => string
}

/** Every piece of source text that renders as words, in source order. */
function candidates(code: string, ast: Node, wanted: string): Candidate[] {
  const out: Candidate[] = []
  const visit = (node: unknown, parent: Node | null, key: string) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) visit(child, parent, key)
      return
    }
    const n = node as Node
    if (typeof n.type !== 'string') return
    // Module paths, type positions and class names never render as words.
    if (n.type === 'ImportDeclaration' || n.type === 'ExportAllDeclaration' || n.type.startsWith('TS')) return
    if (n.type === 'JSXAttribute') {
      const name = (n.name as Node)?.name
      if (typeof name !== 'string' || !VISIBLE_ATTRIBUTES.has(name)) return
    }

    const start = n.start ?? -1
    const end = n.end ?? -1
    if (start >= 0 && end > start) {
      if (n.type === 'JSXText') {
        const raw = code.slice(start, end)
        if (visibleText(raw) === wanted) {
          const lead = raw.match(/^\s*/)![0]
          const trail = raw.slice(lead.length).match(/\s*$/)![0]
          out.push({ start, end, write: text => `${lead}{${JSON.stringify(text)}}${trail}` })
        }
      } else if (n.type === 'StringLiteral' && typeof n.value === 'string') {
        const objectKey = (parent?.type === 'ObjectProperty' || parent?.type === 'ObjectMethod') && key === 'key'
        if (!objectKey && visibleText(n.value) === wanted) {
          const inAttribute = parent?.type === 'JSXAttribute'
          out.push({ start, end, write: text => (inAttribute ? `{${JSON.stringify(text)}}` : JSON.stringify(text)) })
        }
      } else if (n.type === 'TemplateLiteral' && Array.isArray(n.expressions) && n.expressions.length === 0 && parent?.type !== 'TaggedTemplateExpression') {
        const cooked = ((n.quasis as Node[])[0]?.value as { cooked?: string } | undefined)?.cooked
        if (typeof cooked === 'string' && visibleText(cooked) === wanted) {
          out.push({ start, end, write: text => JSON.stringify(text) })
        }
      }
    }

    for (const [childKey, child] of Object.entries(n)) {
      if (childKey === 'loc' || childKey === 'extra' || childKey === 'leadingComments' || childKey === 'trailingComments' || childKey === 'innerComments') continue
      if (child && typeof child === 'object') visit(child, n, childKey)
    }
  }
  visit(ast, null, '')
  return out.sort((a, b) => a.start - b.start)
}

export type TextEditResult =
  | { ok: true; code: string; matches: number }
  | { ok: false; reason: 'unparsable' | 'not-found' | 'unchanged' }

/**
 * Replaces the words `before` (as rendered) with `after` in `code`.
 *
 * When the same words appear several times in the source, `occurrence` (their
 * index among equal words on the page, in reading order) picks one; for static
 * markup source order and page order agree. Words built at runtime (a price
 * computed from a number, a template with values) have no single source and
 * come back `not-found` — the caller offers a section rebuild instead.
 */
export function applyTextEdit(code: string, before: string, after: string, occurrence = 0): TextEditResult {
  const wanted = visibleText(before)
  const text = cleanEditText(after)
  if (!wanted || wanted === text) return { ok: false, reason: 'unchanged' }

  let ast: Node
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true }) as unknown as Node
  } catch {
    return { ok: false, reason: 'unparsable' }
  }

  const found = candidates(code, ast, wanted)
  if (found.length === 0) return { ok: false, reason: 'not-found' }
  const pick = found[Math.min(Math.max(0, Math.floor(occurrence)), found.length - 1)]
  return { ok: true, code: code.slice(0, pick.start) + pick.write(text) + code.slice(pick.end), matches: found.length }
}

// ─── Applying an edit to the page ───────────────────────────────────────────

export type PageEdit =
  | { kind: 'text'; section: string | null; before: string; after: string; occurrence?: number }
  /** `url: ''` puts the original picture back. */
  | { kind: 'image'; section: string | null; key: string; url: string }

export type PageEditResult =
  | { ok: true; parts: PageParts | null; code: string }
  | { ok: false; reason: 'unparsable' | 'not-found' | 'unchanged' | 'unsafe' }

/**
 * Applies one edit to the page. With page parts, only the block that builds
 * the clicked section is changed (falling back to the other blocks for text
 * the section didn't write itself) and the caller reassembles; without parts —
 * an older project — the page's code is edited directly.
 */
export function applyPageEdit(parts: PageParts | null, code: string, edit: PageEdit): PageEditResult {
  const change = (source: string): { ok: true; code: string } | { ok: false; reason: 'unparsable' | 'not-found' | 'unchanged' | 'unsafe' } => {
    if (edit.kind === 'image') {
      if (!SAFE_IMAGE_KEY.test(edit.key) || edit.key.length > MAX_IMAGE_KEY) return { ok: false, reason: 'unsafe' }
      if (edit.url === '') {
        // Put the original picture back.
        const mine = userImagesOf(source)
        if (!(edit.key in mine)) return { ok: false, reason: 'not-found' }
        delete mine[edit.key]
        return { ok: true, code: withUserImages(source, mine) }
      }
      if (!SAFE_USER_IMAGE_URL.test(edit.url)) return { ok: false, reason: 'unsafe' }
      return { ok: true, code: setUserImage(source, edit.key, edit.url) }
    }
    const r = applyTextEdit(source, edit.before, edit.after, edit.occurrence)
    return r.ok ? { ok: true, code: r.code } : r
  }

  if (!parts) {
    const r = change(code)
    return r.ok ? { ok: true, parts: null, code: r.code } : r
  }

  const own = parts.blocks.findIndex(b => edit.section !== null && b.sections.includes(edit.section))
  const order = own >= 0 ? [own, ...parts.blocks.map((_, i) => i).filter(i => i !== own)] : parts.blocks.map((_, i) => i)
  // A new picture goes with its own section; text (or an override being
  // removed) may live in another block.
  const tried = edit.kind === 'image' && edit.url !== '' ? order.slice(0, 1) : order
  let last: PageEditResult = { ok: false, reason: 'not-found' }
  for (const i of tried) {
    const r = change(parts.blocks[i].code)
    if (r.ok) {
      const blocks = parts.blocks.map((b, j) => (j === i ? { ...b, code: r.code } : b))
      return { ok: true, parts: { ...parts, blocks }, code: '' }
    }
    last = r
    if (r.reason !== 'not-found') break
  }
  if (edit.kind === 'image' && tried.length === 0) {
    return { ok: false, reason: 'not-found' }
  }
  return last
}

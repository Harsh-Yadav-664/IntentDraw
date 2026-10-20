import { parse } from '@babel/parser'

/**
 * Layout mistakes a model makes that can be fixed with certainty, in code, for
 * free — run on every section before it ships.
 *
 * A real run (travel site, 2026-10-17) built its featured list as a 12-column
 * grid holding an image at `md:col-span-7` and a card at `md:col-span-6`. That
 * is 13 columns: the card wrapped onto its own row under every image, the right
 * half of the section stayed empty, and four items took 3,487px. Nothing was
 * "badly designed" — the layout was simply broken, and nobody checked.
 *
 * Only fixes with one right answer belong here. Anything needing judgement goes
 * to the prompt or to a rebuild note instead.
 */

const BREAKPOINTS = ['', 'sm', 'md', 'lg', 'xl', '2xl'] as const

interface AstNode {
  type: string
  start?: number | null
  end?: number | null
  [key: string]: unknown
}

/** A stretch of static class text inside a className attribute, with its place in the source. */
interface ClassSpot {
  start: number
  end: number
  text: string
}

export interface LayoutLintResult {
  code: string
  /** One line per fix, for logs and tests. */
  fixes: string[]
}

function walk(node: unknown, visit: (n: AstNode) => void): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach(child => walk(child, visit))
    return
  }
  const n = node as AstNode
  if (typeof n.type === 'string') visit(n)
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'extra') continue
    walk(n[key], visit)
  }
}

/** Every static piece of class text in a className value, including both branches of a ternary. */
function classSpots(value: AstNode | null | undefined): ClassSpot[] {
  if (!value) return []
  const spots: ClassSpot[] = []
  walk(value, n => {
    if (n.type === 'StringLiteral' && typeof n.start === 'number' && typeof n.end === 'number') {
      spots.push({ start: n.start + 1, end: n.end - 1, text: String(n.value) })
    } else if (n.type === 'TemplateElement' && typeof n.start === 'number' && typeof n.end === 'number') {
      spots.push({ start: n.start, end: n.end, text: String((n.value as { raw: string }).raw) })
    }
  })
  return spots
}

function classAttr(element: AstNode): AstNode | null {
  const opening = element.openingElement as AstNode
  const attrs = (opening?.attributes as AstNode[]) ?? []
  const attr = attrs.find(a => a.type === 'JSXAttribute' && (a.name as AstNode)?.name === 'className')
  return (attr?.value as AstNode) ?? null
}

const tokens = (spots: ClassSpot[]) => spots.flatMap(s => s.text.split(/\s+/).filter(Boolean))

/**
 * The value a utility takes at a breakpoint, honouring Tailwind's mobile-first
 * cascade (`md:` applies from md up unless `lg:` overrides it). `null` when it
 * isn't set; `undefined` when branches disagree and the answer isn't knowable.
 */
function valueAt(classes: string[], utility: RegExp, bp: number): { value: string; prefix: string } | null | undefined {
  for (let i = bp; i >= 0; i--) {
    const prefix = BREAKPOINTS[i] ? `${BREAKPOINTS[i]}:` : ''
    const values = new Set<string>()
    for (const c of classes) {
      if (!c.startsWith(prefix)) continue
      const rest = c.slice(prefix.length)
      if (rest.includes(':')) continue // another variant (hover:, another breakpoint)
      const m = rest.match(utility)
      if (m) values.add(m[1])
    }
    if (values.size > 1) return undefined
    if (values.size === 1) return { value: [...values][0], prefix }
  }
  return null
}

const GRID_COLS = /^grid-cols-(\d+)$/
const COL_SPAN = /^col-span-(\d+|full)$/
const MANUAL = /^(?:[a-z0-9]+:)*(?:col-start|col-end|row-span|row-start|grid-flow-dense)/

/** The JSX elements a container renders directly. null when its children are generated (a map, a condition). */
function directChildren(element: AstNode): AstNode[] | null {
  const out: AstNode[] = []
  for (const child of (element.children as AstNode[]) ?? []) {
    if (child.type === 'JSXText') {
      if (String(child.value).trim()) return null
      continue
    }
    if (child.type === 'JSXElement') out.push(child)
    else if (child.type === 'JSXExpressionContainer' && (child.expression as AstNode)?.type === 'JSXEmptyExpression') continue
    else return null
  }
  return out
}

/**
 * Grid rows whose column spans add up to more than the grid has: the last item
 * silently wraps onto a row of its own. When the overflow is under half of any
 * one item — so it was clearly meant as one row, often an overlap done with a
 * negative margin — the widest items give up the excess.
 */
function gridOverflow(ast: AstNode, edits: Array<ClassSpot & { replace: string }>, fixes: string[]) {
  walk(ast, element => {
    if (element.type !== 'JSXElement') return
    const containerClasses = tokens(classSpots(classAttr(element)))
    if (!containerClasses.some(c => /(?:^|:)grid$/.test(c))) return
    const kids = directChildren(element)
    if (!kids || kids.length < 2) return
    const kidSpots = kids.map(k => classSpots(classAttr(k)))
    const kidClasses = kidSpots.map(tokens)
    if (kidClasses.some(cs => cs.some(c => MANUAL.test(c)))) return

    BREAKPOINTS.forEach((bp, i) => {
      const prefix = bp ? `${bp}:` : ''
      // Checked where the grid declares its columns; other breakpoints inherit them.
      const declared = valueAt(containerClasses, GRID_COLS, i)
      if (!declared || declared.prefix !== prefix) return
      const cols = Number(declared.value)
      const spans = kidClasses.map(cs => valueAt(cs, COL_SPAN, i))
      if (spans.some(s => s === undefined || s?.value === 'full')) return
      const widths = spans.map(s => (s ? Number(s.value) : 1))
      const total = widths.reduce((a, b) => a + b, 0)
      const excess = total - cols
      // A small overflow is a row that doesn't add up; a large one (8 + 8 in
      // 12) may be two rows on purpose, and isn't ours to change.
      if (excess <= 0 || excess * 2 >= Math.min(...widths) || widths.some(w => w >= cols)) return

      const fixed = [...widths]
      for (let left = excess; left > 0; left--) {
        const widest = fixed.indexOf(Math.max(...fixed))
        fixed[widest]--
      }
      // Only spans set at exactly this breakpoint are rewritten; one inherited
      // from a smaller screen also sets the smaller layouts, which may be fine.
      if (fixed.some((w, k) => w !== widths[k] && spans[k]?.prefix !== prefix)) return
      const changes: string[] = []
      fixed.forEach((w, k) => {
        if (w === widths[k]) return
        const from = `${prefix}col-span-${widths[k]}`
        const to = `${prefix}col-span-${w}`
        for (const spot of kidSpots[k]) {
          const pattern = new RegExp(`(^|\\s)${from.replace(/[:]/g, '\\:')}(?=\\s|$)`, 'g')
          if (!pattern.test(spot.text)) continue
          edits.push({ ...spot, replace: spot.text.replace(pattern, `$1${to}`) })
        }
        changes.push(`${from} → ${to}`)
      })
      fixes.push(`grid ${prefix}grid-cols-${cols} held ${widths.map(x => `${prefix}col-span-${x}`).join(' + ')} (${total} columns): ${changes.join(', ')}`)
    })
  })
}

/**
 * `h-full` directly inside a screen-tall section with no height of its own: the
 * section only has a MIN height, so 100% of it resolves to nothing and the
 * child — with anything placed inside it by percentages — collapses to 0px. A
 * real run (Wilder House, 2026-10-20) lost a whole section's photo this way.
 * The child plainly meant "fill the section", which `min-h-[inherit]` does.
 */
function collapsedFill(ast: AstNode, edits: Array<ClassSpot & { replace: string }>, fixes: string[]) {
  walk(ast, element => {
    if (element.type !== 'JSXElement') return
    const parent = tokens(classSpots(classAttr(element)))
    if (!parent.includes('min-h-screen') || parent.some(c => /^h-/.test(c))) return
    for (const child of (element.children as AstNode[]) ?? []) {
      if (child.type !== 'JSXElement') continue
      for (const spot of classSpots(classAttr(child))) {
        if (!/(^|\s)h-full(?=\s|$)/.test(spot.text)) continue
        edits.push({ ...spot, replace: spot.text.replace(/(^|\s)h-full(?=\s|$)/, '$1min-h-[inherit]') })
        fixes.push('h-full inside a min-h-screen section (collapses to 0px) → min-h-[inherit]')
      }
    }
  })
}

export function lintLayout(code: string): LayoutLintResult {
  let ast: AstNode
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] }) as unknown as AstNode
  } catch {
    return { code, fixes: [] } // not ours to judge — validate.ts reports syntax
  }
  const edits: Array<ClassSpot & { replace: string }> = []
  const fixes: string[] = []
  gridOverflow(ast, edits, fixes)
  collapsedFill(ast, edits, fixes)
  if (edits.length === 0) return { code, fixes }

  // Several fixes can touch one stretch of text: apply them to it in turn,
  // then splice every stretch back from the end so offsets stay valid.
  const bySpot = new Map<string, ClassSpot & { replace: string }>()
  for (const e of edits) {
    const key = `${e.start}:${e.end}`
    const prev = bySpot.get(key)
    if (!prev) bySpot.set(key, e)
    else {
      // Re-apply this edit's change on top of the previous one.
      const changed = diffToken(e.text, e.replace)
      bySpot.set(key, { ...prev, replace: changed ? prev.replace.replace(changed.from, changed.to) : prev.replace })
    }
  }
  let out = code
  for (const e of [...bySpot.values()].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.replace + out.slice(e.end)
  }
  return { code: out, fixes }
}

function diffToken(before: string, after: string): { from: string; to: string } | null {
  const a = before.split(/(\s+)/)
  const b = after.split(/(\s+)/)
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return { from: a[i], to: b[i] }
  return null
}

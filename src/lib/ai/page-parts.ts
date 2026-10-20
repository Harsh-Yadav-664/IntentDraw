/**
 * The parts a staged generation was assembled from, kept so ONE section can be
 * rebuilt without regenerating the page.
 *
 * A full run is an understanding call, a shell call and one call per section
 * batch — minutes of wall time and a real slice of free-tier quota. When one
 * section comes out weak (or failed and is still a placeholder), swapping just
 * that section costs a single model call.
 *
 * Pure and client-safe: the browser holds the parts and reassembles them.
 */

import type { Region, RegionGroup } from '@/types'
import type { DesignBrief } from './brief'
import { assembleProgressive, splitTopLevelChunks, type AssembleOptions, type AssembleResult } from './assemble'

/** How much of a per-section rebuild note reaches the model. */
export const MAX_SECTION_NOTE_CHARS = 300

/** The code-rendered drawing. Never a rebuildable section — nothing may replace it. */
export const SCENE_NAME = 'IntentScene'

/** One section call's output: a batch can define several sections in one block. */
export interface SectionBlock {
  sections: string[]
  code: string
  /** The provider and model that wrote it, and how long it took — so a weak section can be traced to a weak model. */
  provider?: string
  model?: string
  ms?: number
  /** What still looks generated (ai-look.ts), as a ready rebuild note. */
  note?: string
}

/** Metadata a section call returns alongside its code. */
export type BlockMeta = Pick<SectionBlock, 'provider' | 'model' | 'ms' | 'note'>

export interface PageParts {
  shellCode: string
  /** The user's drawing as a component; always assembled first so it can't be replaced. */
  sceneCode: string | null
  tokenId: string
  brief: DesignBrief | null
  /** Regions as the shell stage classified them — what section calls are given. */
  regions: Region[]
  groups: RegionGroup[]
  /** The prompt as the shell stage resolved it. */
  prompt: string
  /** Every section the page needs, in page order. */
  sections: string[]
  /** Built blocks. A section covered by no block is missing and renders as a placeholder. */
  blocks: SectionBlock[]
  /** Sections whose last attempt failed (subset of the missing ones). */
  failed: string[]
}

export type SectionStatus = 'built' | 'failed' | 'pending'

/** Sections the user may rebuild, in page order. The scene is never one of them. */
export function listSections(parts: PageParts): Array<{ name: string; status: SectionStatus } & BlockMeta> {
  return parts.sections
    .filter(name => name !== SCENE_NAME)
    .map(name => {
      const block = parts.blocks.find(b => b.sections.includes(name))
      if (!block) return { name, status: parts.failed.includes(name) ? 'failed' : 'pending' }
      return { name, status: 'built', ...cleanMeta(block) }
    })
}

/** Sections no block defines yet — they render as placeholders. */
export function missingSections(parts: PageParts): string[] {
  const built = new Set(parts.blocks.flatMap(b => b.sections))
  return parts.sections.filter(name => name !== SCENE_NAME && !built.has(name))
}

/**
 * Assembles the page from its parts. The scene block goes first: assembly keeps
 * the first definition of every name, so no section can replace the drawing.
 */
export function assembleParts(parts: PageParts, options?: AssembleOptions): AssembleResult {
  const blocks = [
    ...(parts.sceneCode ? [parts.sceneCode] : []),
    ...parts.blocks.map(b => b.code),
  ]
  return assembleProgressive(parts.shellCode, blocks, missingSections(parts), options)
}

const IMPORT_START = /^\s*import\s/
const LEADING_COMMENTS = /^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/
const DECLARED_NAME = /^(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/

/** A chunk's declared name, looking past any comment the model put above it. */
function chunkName(code: string): string | null {
  return code.replace(LEADING_COMMENTS, '').match(DECLARED_NAME)?.[1] ?? null
}

/** Removes the top-level declarations named in `names`, keeping imports and everything else. */
function withoutDeclarations(code: string, names: Set<string>): string {
  // Imports are set aside first: an import line without a semicolon would glue
  // itself to the next declaration and hide that declaration's name.
  const lines = code.split('\n')
  const imports = lines.filter(line => IMPORT_START.test(line))
  const body = lines.filter(line => !IMPORT_START.test(line)).join('\n')
  const kept = splitTopLevelChunks(body)
    .filter(chunk => {
      const declared = chunk.name ?? chunkName(chunk.code)
      return !declared || !names.has(declared)
    })
    .map(chunk => chunk.code)
  return [...imports, ...kept].join('\n\n').trim()
}

/**
 * Swaps in a freshly built section.
 *
 * - The new block goes ahead of the older blocks so its definition wins, but
 *   any OTHER section (or the scene) it happens to redefine is stripped first —
 *   rebuilding one section must never silently replace another.
 * - The old definition is removed. A block that held only this section is
 *   dropped whole, helpers included; in a multi-section block only this
 *   section's declaration goes, so its siblings keep their helpers.
 * - A failed section is simply no longer failed.
 */
export function replaceSection(parts: PageParts, name: string, code: string, meta: BlockMeta = {}): PageParts {
  if (name === SCENE_NAME) throw new Error('The drawing cannot be rebuilt as a section.')
  if (!parts.sections.includes(name)) throw new Error(`${name} is not a section of this page.`)

  const others = new Set([SCENE_NAME, ...parts.sections.filter(s => s !== name)])
  const newCode = withoutDeclarations(code, others)

  const oldBlocks = parts.blocks
    .map(block => {
      if (!block.sections.includes(name)) return block
      const remaining = block.sections.filter(s => s !== name)
      if (remaining.length === 0) return null
      return { ...block, sections: remaining, code: withoutDeclarations(block.code, new Set([name])) }
    })
    .filter((b): b is SectionBlock => b !== null)

  return {
    ...parts,
    blocks: [{ sections: [name], code: newCode, ...cleanMeta(meta) }, ...oldBlocks],
    failed: parts.failed.filter(s => s !== name),
  }
}

/** Only short strings and a sane duration survive — this crosses the client and is saved. */
export function cleanMeta(meta: unknown): BlockMeta {
  const m = (meta && typeof meta === 'object' ? meta : {}) as Record<string, unknown>
  const out: BlockMeta = {}
  if (typeof m.provider === 'string' && m.provider) out.provider = m.provider.slice(0, 40)
  if (typeof m.model === 'string' && m.model) out.model = m.model.slice(0, 80)
  if (typeof m.ms === 'number' && Number.isFinite(m.ms) && m.ms >= 0) out.ms = Math.min(Math.round(m.ms), 3_600_000)
  if (typeof m.note === 'string' && m.note) out.note = m.note.slice(0, MAX_SECTION_NOTE_CHARS)
  return out
}

/**
 * Reads parts saved inside a project's canvas_data. Anything malformed — or
 * parts that no longer reproduce the saved page, e.g. an older save — yields
 * null, so a stale set can never overwrite what the user is looking at.
 */
export function parseSavedParts(raw: unknown, generatedCode: string | null | undefined): PageParts | null {
  if (!raw || typeof raw !== 'object' || !generatedCode) return null
  const p = raw as Partial<PageParts>
  const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string')

  if (typeof p.shellCode !== 'string' || typeof p.tokenId !== 'string' || typeof p.prompt !== 'string') return null
  if (!isStringArray(p.sections) || !isStringArray(p.failed)) return null
  if (!Array.isArray(p.blocks) || !p.blocks.every(b => b && typeof b.code === 'string' && isStringArray(b.sections))) return null

  const parts: PageParts = {
    shellCode: p.shellCode,
    sceneCode: typeof p.sceneCode === 'string' ? p.sceneCode : null,
    tokenId: p.tokenId,
    brief: p.brief && typeof p.brief === 'object' ? p.brief : null,
    regions: Array.isArray(p.regions) ? p.regions : [],
    groups: Array.isArray(p.groups) ? p.groups : [],
    prompt: p.prompt,
    sections: p.sections,
    blocks: p.blocks.map(b => ({ sections: b.sections, code: b.code, ...cleanMeta(b) })),
    failed: p.failed,
  }

  if (assembleParts(parts).code === generatedCode) return parts
  // A page saved before assembly resolved import/component name collisions:
  // the parts are genuine (they reproduce the page under the old rules), and
  // reassembling them now repairs it. The caller shows that repaired page.
  return assembleParts(parts, { legacyCollisions: true }).code === generatedCode ? parts : null
}

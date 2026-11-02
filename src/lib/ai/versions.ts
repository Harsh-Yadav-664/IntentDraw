/**
 * Every version of a page the pipeline produced, so they can be compared.
 *
 * A run does not stop at one page. After the sections are built:
 *  - generated pictures replace the palette art the page first showed;
 *  - a section whose first answer looked generated gets one corrective call on
 *    the server, and the second answer silently replaces the first;
 *  - right after the run, the layout check rebuilds up to two sections on its
 *    own (issue.tsx), swapping them in with no comparison;
 *  - the user can rebuild any section.
 * Each of these used to discard what it replaced, so a page that got worse at
 * the last step could not be got back. In development every one is kept, can
 * be shown again, and one can be marked as preferred — which is logged with the
 * prompt and the models that built each section (`preferenceRecord`), so the
 * choices can later steer which model builds what.
 *
 * Nothing here makes a model call: a version exists only if the pipeline
 * already produced it. Pure and client-safe.
 */

import { assembleParts, SCENE_NAME, type PageParts, type SectionBlock } from './page-parts'

/** On in development; `NEXT_PUBLIC_COMPARE_VERSIONS=true` turns it on in a build. */
export const VERSIONS_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_COMPARE_VERSIONS === 'true'

/** Where preferences are kept on a development machine (gitignored): one JSON object per line. */
export const PREFERENCE_LOG = '.system_generated/version-preferences.jsonl'

/** Pages are large; a long session must not hold every one forever. */
export const MAX_VERSIONS = 12

export type VersionKind =
  /** What the run finished with (or what a stop left). */
  | 'run'
  /** The finished page with the palette art it showed before generated pictures arrived. */
  | 'before-pictures'
  /** A section's first answer, replaced by the server's look correction. */
  | 'first-answer'
  /** A section rebuilt by the layout check on its own, right after the run. */
  | 'auto-fix'
  /** A section the user rebuilt. */
  | 'rebuild'
  /** The page as it was loaded or shown before anything in this session replaced it. */
  | 'earlier'

export interface PageVersion {
  id: string
  at: number
  kind: VersionKind
  label: string
  parts: PageParts
  code: string
}

/** Who wrote one section of a page. */
export interface SectionAuthor {
  section: string
  provider?: string
  model?: string
}

let counter = 0

/** A version of the page these parts assemble to, or null if they don't assemble. */
export function makeVersion(kind: VersionKind, label: string, parts: PageParts, at = Date.now()): PageVersion | null {
  const { code } = assembleParts(parts)
  if (!code) return null
  return { id: `v${at.toString(36)}-${(counter++).toString(36)}`, at, kind, label, parts, code }
}

/**
 * Adds a version, newest last. A page identical to one already kept is not
 * added twice (showing an old version must not duplicate it); the oldest are
 * dropped past `MAX_VERSIONS`, but never the first finished run.
 */
export function addVersion(list: PageVersion[], version: PageVersion | null): PageVersion[] {
  if (!version || list.some(v => v.code === version.code)) return list
  const next = [...list, version]
  while (next.length > MAX_VERSIONS) {
    const firstRun = next.findIndex(v => v.kind === 'run')
    next.splice(firstRun === 0 ? 1 : 0, 1)
  }
  return next
}

/** The block that defines a section. */
function blockOf(parts: PageParts, section: string): SectionBlock | undefined {
  return parts.blocks.find(b => b.sections.includes(section))
}

/** Who wrote each built section, in page order. */
export function authors(parts: PageParts): SectionAuthor[] {
  return parts.sections
    .filter(name => name !== SCENE_NAME)
    .flatMap(section => {
      const block = blockOf(parts, section)
      return block ? [{ section, provider: block.provider, model: block.model }] : []
    })
}

/** "gemini-3.6-flash, gpt-oss-120b" — the distinct models behind a page, for a one-line label. */
export function builtByLine(parts: PageParts): string {
  const names = authors(parts).map(a => a.model ?? a.provider).filter((n): n is string => !!n)
  return [...new Set(names)].join(', ')
}

/**
 * The parts with one block's code swapped — the page a discarded answer would
 * have made. `sections` names the block exactly as it was built.
 */
export function withBlockCode(parts: PageParts, sections: string[], code: string, meta: Pick<SectionBlock, 'provider' | 'model'> = {}): PageParts | null {
  const key = sections.join(',')
  const index = parts.blocks.findIndex(b => b.sections.join(',') === key)
  if (index < 0) return null
  const blocks = parts.blocks.slice()
  blocks[index] = { ...blocks[index], code, ...meta, note: undefined }
  return { ...parts, blocks }
}

/** One section that differs between the preferred page and another version. */
export interface ContestedSection {
  section: string
  preferred: string
  over: string
  /** What the losing version was — e.g. a layout auto-fix that made things worse. */
  overKind: VersionKind
}

/** What is logged when a version is marked as preferred. */
export interface PreferenceRecord {
  at: string
  projectId: string | null
  prompt: string
  /** The provider setting the run used ('auto', 'gemini', …). */
  providerChoice: string
  styleId: string | null
  preferred: { kind: VersionKind; label: string; builtBy: SectionAuthor[] }
  others: Array<{ kind: VersionKind; label: string; builtBy: SectionAuthor[] }>
  /**
   * The signal itself: each section that differs between the preferred page
   * and another version, and which model wrote each side. A section both pages
   * share says nothing about either model, so it is left out.
   */
  contested: ContestedSection[]
}

const modelName = (block: SectionBlock | undefined) => block?.model ?? block?.provider ?? 'unknown'

/** The record logged when `preferred` is chosen over the other versions. */
export function preferenceRecord(
  preferred: PageVersion,
  all: PageVersion[],
  context: { projectId: string | null; providerChoice: string; at?: Date }
): PreferenceRecord {
  const others = all.filter(v => v.id !== preferred.id)
  const contested: ContestedSection[] = []
  for (const other of others) {
    for (const section of preferred.parts.sections) {
      if (section === SCENE_NAME) continue
      const mine = blockOf(preferred.parts, section)
      const theirs = blockOf(other.parts, section)
      if (!mine || !theirs || mine.code === theirs.code) continue
      contested.push({ section, preferred: modelName(mine), over: modelName(theirs), overKind: other.kind })
    }
  }
  return {
    at: (context.at ?? new Date()).toISOString(),
    projectId: context.projectId,
    prompt: preferred.parts.prompt.slice(0, 2000),
    providerChoice: context.providerChoice,
    styleId: preferred.parts.tokenId || null,
    preferred: { kind: preferred.kind, label: preferred.label, builtBy: authors(preferred.parts) },
    others: others.map(v => ({ kind: v.kind, label: v.label, builtBy: authors(v.parts) })),
    contested,
  }
}

/** Wins and losses per model across logged preferences — what a later model choice can read. */
export function summarizePreferences(records: Array<Pick<PreferenceRecord, 'contested'>>): Array<{ model: string; wins: number; losses: number }> {
  const tally = new Map<string, { wins: number; losses: number }>()
  const entry = (model: string) => tally.get(model) ?? tally.set(model, { wins: 0, losses: 0 }).get(model)!
  for (const record of records) {
    for (const c of record.contested ?? []) {
      // The same model on both sides (a rebuild by the same model) says nothing about models.
      if (c.preferred === c.over) continue
      entry(c.preferred).wins++
      entry(c.over).losses++
    }
  }
  return [...tally]
    .map(([model, t]) => ({ model, ...t }))
    .sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.wins - a.wins)
}

const KINDS: VersionKind[] = ['run', 'before-pictures', 'first-answer', 'auto-fix', 'rebuild', 'earlier']
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const kind = (v: unknown): VersionKind => (KINDS.includes(v as VersionKind) ? (v as VersionKind) : 'run')
const cleanAuthors = (v: unknown): SectionAuthor[] =>
  (Array.isArray(v) ? v : []).slice(0, 40).flatMap(a => {
    const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
    const section = str(o.section, 80)
    if (!section) return []
    return [{ section, ...(o.provider ? { provider: str(o.provider, 40) } : {}), ...(o.model ? { model: str(o.model, 80) } : {}) }]
  })
const cleanVersionInfo = (v: unknown) => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return { kind: kind(o.kind), label: str(o.label, 160), builtBy: cleanAuthors(o.builtBy) }
}

/**
 * A preference record as the server accepts it: it comes from the browser, so
 * every field is re-checked, capped and typed before it is written anywhere.
 * Null when it isn't a record at all.
 */
export function cleanPreferenceRecord(raw: unknown): PreferenceRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!o.preferred || typeof o.preferred !== 'object') return null
  const at = typeof o.at === 'string' && !Number.isNaN(Date.parse(o.at)) ? new Date(o.at).toISOString() : new Date().toISOString()
  return {
    at,
    projectId: typeof o.projectId === 'string' ? o.projectId.slice(0, 64) : null,
    prompt: str(o.prompt, 2000),
    providerChoice: str(o.providerChoice, 40),
    styleId: typeof o.styleId === 'string' ? o.styleId.slice(0, 40) : null,
    preferred: cleanVersionInfo(o.preferred),
    others: (Array.isArray(o.others) ? o.others : []).slice(0, MAX_VERSIONS).map(cleanVersionInfo),
    contested: (Array.isArray(o.contested) ? o.contested : []).slice(0, 200).flatMap(c => {
      const x = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
      const section = str(x.section, 80)
      return section ? [{ section, preferred: str(x.preferred, 80) || 'unknown', over: str(x.over, 80) || 'unknown', overKind: kind(x.overKind) }] : []
    }),
  }
}

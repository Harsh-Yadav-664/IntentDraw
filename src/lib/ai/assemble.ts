/**
 * Merges independently generated pieces into one valid TSX file.
 *
 * Staged generation asks the model for a shell and each section separately, so
 * nothing guarantees their imports agree. Deduping whole import *lines* is not
 * enough: `import { Star } from 'lucide-react'` and
 * `import { Star, Moon } from 'lucide-react'` are different lines that declare
 * `Star` twice, which is a fatal redeclaration. Imports are merged per module
 * and per specifier instead.
 *
 * Client-safe: no provider SDKs, so the browser can assemble partial results as
 * they stream in.
 */

interface ParsedImports {
  /** module specifier -> local binding names */
  named: Map<string, Map<string, string>>
  defaults: Map<string, string>
  namespaces: Map<string, string>
}

// A trailing comment is allowed: models write `import { X } from './X' // assuming…`,
// and a line that didn't match was kept verbatim as code — a duplicate
// declaration of X the moment the file also defined it.
const IMPORT_LINE = /^\s*import\s+(?:(.+?)\s+from\s+)?['"]([^'"]+)['"]\s*;?\s*(?:\/\/.*|\/\*.*?\*\/)?\s*$/

function emptyImports(): ParsedImports {
  return { named: new Map(), defaults: new Map(), namespaces: new Map() }
}

/**
 * Joins import statements that span several lines into one line each.
 *
 * Models do write `import {\n  Terminal,\n  Github,\n} from 'lucide-react'`.
 * Parsed line by line, that statement was never recognised, stayed in the
 * middle of the assembled file, and re-declared the `Terminal` the shell had
 * already imported — a fatal compile error. Only a run of lines that together
 * form one valid import is joined; anything else is left exactly as it was.
 */
const IMPORT_START = /^\s*import\b(?!\s*\()/
const MAX_IMPORT_LINES = 80

function joinMultilineImports(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!IMPORT_START.test(line) || IMPORT_LINE.test(line)) {
      out.push(line)
      continue
    }
    let joined = line.trim()
    let end = -1
    for (let j = i + 1; j < lines.length && j < i + MAX_IMPORT_LINES; j++) {
      joined += ' ' + lines[j].trim()
      if (/\bfrom\s*['"][^'"]+['"]/.test(lines[j])) {
        end = j
        break
      }
    }
    if (end !== -1 && IMPORT_LINE.test(joined)) {
      out.push(joined)
      i = end
    } else {
      out.push(line)
    }
  }
  return out
}

/** Splits code into its import statements and everything else. */
function splitImports(code: string, into: ParsedImports): string {
  const body: string[] = []

  for (const line of joinMultilineImports(code.split(/\r?\n/))) {
    const match = line.match(IMPORT_LINE)
    if (!match) {
      body.push(line)
      continue
    }

    const [, clause, moduleName] = match
    if (!clause) continue // bare side-effect import — nothing to merge

    // The output is ONE file: a relative or alias import can never resolve. A
    // model thinking in multi-file terms wrote `import HeroSection from
    // './HeroSection'` in the shell while the section pass defined HeroSection
    // in the same file, and Babel rejects that as a duplicate declaration
    // before the runtime's own import stripping ever runs.
    if (/^(?:\.{1,2}\/|\/|@\/|~\/)/.test(moduleName)) continue

    // `React, { useState }` / `* as ns` / `{ a, b as c }` / `Thing`
    const namespaceMatch = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
    if (namespaceMatch) {
      into.namespaces.set(moduleName, namespaceMatch[1])
      continue
    }

    const bracesAt = clause.indexOf('{')
    const defaultPart = (bracesAt === -1 ? clause : clause.slice(0, bracesAt)).replace(/,\s*$/, '').trim()
    if (defaultPart) into.defaults.set(moduleName, defaultPart)

    if (bracesAt !== -1) {
      const inner = clause.slice(bracesAt + 1, clause.lastIndexOf('}'))
      const specifiers = into.named.get(moduleName) ?? new Map<string, string>()
      for (const raw of inner.split(',')) {
        const spec = raw.trim()
        if (!spec) continue
        const asMatch = spec.match(/^(.+?)\s+as\s+(.+)$/)
        // Key by local name: that's what can collide in the merged file.
        if (asMatch) specifiers.set(asMatch[2].trim(), `${asMatch[1].trim()} as ${asMatch[2].trim()}`)
        else specifiers.set(spec, spec)
      }
      into.named.set(moduleName, specifiers)
    }
  }

  return body.join('\n')
}

function renderImports(imports: ParsedImports): string {
  const modules = new Set([
    ...imports.defaults.keys(),
    ...imports.named.keys(),
    ...imports.namespaces.keys(),
  ])

  // Every local name may be bound once across the whole file. Blocks disagree
  // about HOW to import the same thing — the shell wrote `import gsap from 'gsap'`
  // and a section wrote `import { gsap } from 'gsap'`, which merged into
  // `import gsap, { gsap }`: a fatal duplicate declaration. Defaults and
  // namespaces are bound first, so a named specifier that would rebind one of
  // them is dropped (for gsap both names are the same object).
  const bound = new Set<string>([...imports.defaults.values(), ...imports.namespaces.values()])

  const lines: string[] = []
  for (const moduleName of modules) {
    const namespace = imports.namespaces.get(moduleName)
    if (namespace) {
      lines.push(`import * as ${namespace} from '${moduleName}';`)
      continue
    }

    const defaultName = imports.defaults.get(moduleName)
    const named = [...(imports.named.get(moduleName) ?? new Map<string, string>()).entries()]
      .filter(([local]) => {
        if (bound.has(local)) return false
        bound.add(local)
        return true
      })
      .map(([, spec]) => spec)
    const namedClause = named.length > 0 ? `{ ${named.join(', ')} }` : ''
    const clause = [defaultName, namedClause].filter(Boolean).join(', ')
    if (clause) lines.push(`import ${clause} from '${moduleName}';`)
  }

  // React first — it must exist before anything referencing JSX runs.
  return lines.sort((a, b) => (a.includes("'react'") ? -1 : b.includes("'react'") ? 1 : 0)).join('\n')
}

/** Strips a stray `export default ...` from a section, which only the shell may declare. */
function stripDefaultExport(code: string): string {
  return code.replace(/^\s*export\s+default\s+/gm, '')
}

const DECLARATION_START = /^\s*(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/

/**
 * Splits code into top-level chunks, naming each one it can attribute to a
 * declaration. Section batches are generated independently, so two of them can
 * define the same component — a fatal redeclaration. Splitting lets the caller
 * keep the first definition and drop later copies.
 *
 * Brace matching is done with a small scanner rather than a real parser: it
 * only has to survive the subset of TSX these models emit, and a parser
 * dependency isn't worth it for this.
 */
export function splitTopLevelChunks(code: string): Array<{ name: string | null; code: string }> {
  const chunks: Array<{ name: string | null; code: string }> = []
  let depth = 0
  let start = 0
  let i = 0

  const push = (end: number) => {
    const text = code.slice(start, end)
    if (text.trim()) {
      chunks.push({ name: text.match(DECLARATION_START)?.[1] ?? null, code: text.trim() })
    }
    start = end
  }

  while (i < code.length) {
    const char = code[i]
    const next = code[i + 1]

    // Skip over anything that can contain unbalanced braces.
    if (char === '/' && next === '/') {
      i = code.indexOf('\n', i)
      if (i === -1) break
      continue
    }
    if (char === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end === -1 ? code.length : end + 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      i++
      while (i < code.length && code[i] !== char) {
        if (code[i] === '\\') i++
        i++
      }
      i++
      continue
    }

    if (char === '{' || char === '(' || char === '[') depth++
    else if (char === '}' || char === ')' || char === ']') depth--

    // A statement ends at depth 0 on a semicolon, or on the newline after a
    // closing brace (function and class bodies usually have no semicolon).
    if (depth === 0) {
      if (char === ';') {
        push(i + 1)
      } else if (char === '}' && code.slice(i + 1).match(/^\s*\n/)) {
        push(i + 1)
      }
    }
    i++
  }
  push(code.length)

  return chunks
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Points one block's uses of an imported name at its new alias.
 *
 * JSX tags are always renamed. Bare references (`icon: Navigation`,
 * `{Navigation}`) are renamed only in value positions, and only when the block
 * doesn't define the name itself — the same word in visible text or a string
 * ("Navigation") must stay as written.
 */
function renameUses(body: string, from: string, to: string, tagsOnly: boolean): string {
  const name = escapeRegExp(from)
  const renamed = body.replace(new RegExp(`(<\\/?)${name}(?=[\\s/>])`, 'g'), (_, open: string) => open + to)
  if (tagsOnly) return renamed
  return renamed.replace(
    new RegExp(`([=(\\[,:?{|&]\\s*)${name}(?=\\s*[,)\\]};\\n]|\\s*$)`, 'g'),
    (_, before: string) => before + to
  )
}

/**
 * An import and a component cannot share a name in one file.
 *
 * Blocks are written independently, so one section imports the lucide icon
 * `Navigation` (or `Menu`, `Contact`, `Map`, `Gallery`…) while another section
 * IS the component `Navigation`. Merged into one file that is a fatal
 * "Duplicate declaration" — a real run lost the whole page to it. The block
 * that imported the name meant the import, so its import is aliased and its
 * own uses are pointed at the alias; the component keeps its name.
 */
function aliasCollidingImports(
  blocks: Array<{ imports: ParsedImports; body: string }>,
  declared: Set<string>
): void {
  const taken = new Set(declared)
  for (const block of blocks) {
    for (const map of block.imports.named.values()) for (const local of map.keys()) taken.add(local)
    for (const local of block.imports.defaults.values()) taken.add(local)
    for (const local of block.imports.namespaces.values()) taken.add(local)
  }

  // One alias per name across the file, so two blocks importing the same icon agree.
  const aliases = new Map<string, string>()
  const aliasFor = (local: string, moduleName: string) => {
    const known = aliases.get(local)
    if (known) return known
    let alias = local + (moduleName === 'lucide-react' ? 'Icon' : 'Import')
    while (taken.has(alias)) alias += '_'
    taken.add(alias)
    aliases.set(local, alias)
    return alias
  }

  for (const block of blocks) {
    const own = new Set(splitTopLevelChunks(block.body).map(chunk => chunk.name))
    const rename = (local: string, alias: string) => {
      block.body = renameUses(block.body, local, alias, own.has(local))
    }

    for (const [moduleName, specifiers] of block.imports.named) {
      for (const [local, spec] of [...specifiers]) {
        if (!declared.has(local)) continue
        const alias = aliasFor(local, moduleName)
        const imported = spec.split(/\s+as\s+/)[0].trim()
        specifiers.delete(local)
        specifiers.set(alias, `${imported} as ${alias}`)
        rename(local, alias)
      }
    }
    for (const [moduleName, local] of [...block.imports.defaults]) {
      if (!declared.has(local)) continue
      const alias = aliasFor(local, moduleName)
      block.imports.defaults.set(moduleName, alias)
      rename(local, alias)
    }
  }
}

/**
 * One block, before it is stored: an import that shares its name with a
 * section this same block defines is the import (a section never renders
 * itself), so it is aliased and its JSX uses follow. Left to the generic
 * repair, the import would be dropped and `<Navigation className="w-4" />`
 * inside the footer would render the whole navigation bar.
 */
export function aliasSectionImports(code: string, sectionNames: string[]): string {
  const imports = emptyImports()
  const block = { imports, body: splitImports(code, imports) }
  const own = new Set(splitTopLevelChunks(block.body).map(chunk => chunk.name))
  const colliding = new Set(sectionNames.filter(name => own.has(name)))
  const imported = [
    ...[...imports.named.values()].flatMap(map => [...map.keys()]),
    ...imports.defaults.values(),
  ]
  if (!imported.some(local => colliding.has(local))) return code

  aliasCollidingImports([block], colliding)
  const rendered = renderImports(imports)
  return rendered ? `${rendered}\n\n${block.body.trim()}\n` : block.body
}

function mergeImports(into: ParsedImports, from: ParsedImports): void {
  for (const [moduleName, specifiers] of from.named) {
    const merged = into.named.get(moduleName) ?? new Map<string, string>()
    for (const [local, spec] of specifiers) merged.set(local, spec)
    into.named.set(moduleName, merged)
  }
  for (const [moduleName, local] of from.defaults) into.defaults.set(moduleName, local)
  for (const [moduleName, local] of from.namespaces) into.namespaces.set(moduleName, local)
}

/** Keeps the first definition of each name and drops later duplicates. */
function dedupeDeclarations(blocks: string[], alreadyDeclared: Iterable<string> = []): string[] {
  const seen = new Set<string>(alreadyDeclared)
  const kept: string[] = []

  for (const block of blocks) {
    const chunks = splitTopLevelChunks(block)
    const surviving = chunks.filter(chunk => {
      if (!chunk.name) return true
      if (seen.has(chunk.name)) return false
      seen.add(chunk.name)
      return true
    })
    if (surviving.length > 0) kept.push(surviving.map(c => c.code).join('\n\n'))
  }

  return kept
}

/**
 * Stand-in for a section that hasn't been generated yet. Without one, a partly
 * finished page can't render at all — the shell references components that
 * don't exist — so there'd be nothing to show until the very last call lands.
 */
export function placeholderComponent(name: string): string {
  return `const ${name} = () => (
  <div className="w-full min-h-[220px] bg-neutral-500/10 animate-pulse" aria-label="Generating ${name}" />
);`
}

/**
 * Assembles what exists so far, filling not-yet-generated sections with
 * placeholders so the preview can update after every stage.
 */
export function assembleProgressive(
  shellCode: string,
  completedBlocks: string[],
  pendingNames: string[],
  options?: AssembleOptions
): AssembleResult {
  return assembleFile(shellCode, [...completedBlocks, ...pendingNames.map(placeholderComponent)], options)
}

export interface AssembleOptions {
  /**
   * Assemble the way it was done before import/component name collisions were
   * resolved. Only for recognising pages saved back then (see parseSavedParts).
   */
  legacyCollisions?: boolean
}

export interface AssembleResult {
  code: string
  /** Set when the shell was unusable and the caller should treat this as a failure. */
  error?: string
}

/**
 * Builds the final file: merged imports, then every section component, then the
 * shell's `export default App` last so it can reference them.
 */
export function assembleFile(shellCode: string, sectionCodes: string[], options?: AssembleOptions): AssembleResult {
  const shell = { imports: emptyImports(), body: '' }
  shell.body = splitImports(shellCode, shell.imports)
  const shellBody = shell.body
  // The shell's own declarations win: a section that redefines one of them
  // would be a fatal redeclaration.
  const shellDeclared = splitTopLevelChunks(shellBody)
    .map(chunk => chunk.name)
    .filter((name): name is string => name !== null)

  const blocks = sectionCodes
    .filter(code => code && code.trim().length > 0)
    .map(code => {
      const blockImports = emptyImports()
      return { imports: blockImports, body: stripDefaultExport(splitImports(code, blockImports)).trim() }
    })

  if (!options?.legacyCollisions) {
    const declared = new Set(shellDeclared)
    for (const block of blocks) {
      for (const chunk of splitTopLevelChunks(block.body)) if (chunk.name) declared.add(chunk.name)
    }
    // The shell is built in code and imports nothing that collides; only the
    // model-written blocks are rewritten.
    aliasCollidingImports(blocks, declared)
  }

  const imports = emptyImports()
  mergeImports(imports, shell.imports)
  for (const block of blocks) mergeImports(imports, block.imports)

  const sectionBodies = dedupeDeclarations(blocks.map(block => block.body).filter(Boolean), shellDeclared)

  const exportIndex = shellBody.indexOf('export default')
  if (exportIndex === -1) {
    return { code: '', error: 'Shell is missing `export default` — nothing to mount.' }
  }

  const beforeExport = shellBody.slice(0, exportIndex).trim()
  const fromExport = shellBody.slice(exportIndex).trim()

  const parts = [
    renderImports(imports),
    beforeExport,
    sectionBodies.join('\n\n'),
    fromExport,
  ].filter(part => part.trim().length > 0)

  return { code: parts.join('\n\n') + '\n' }
}

/**
 * Re-merges one complete file's imports so no local name is bound twice.
 *
 * Assembly already does this, but files saved before a collision class was
 * handled still carry it — and repairing them at render time costs nothing,
 * where regenerating costs a whole run of free-tier quota.
 */
export function normalizeImports(code: string): string {
  const imports = emptyImports()
  const body = splitImports(code, imports).trim()
  const rendered = renderImports(imports)
  return rendered ? `${rendered}\n\n${body}\n` : `${body}\n`
}

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

const IMPORT_LINE = /^\s*import\s+(?:(.+?)\s+from\s+)?['"]([^'"]+)['"]\s*;?\s*$/

function emptyImports(): ParsedImports {
  return { named: new Map(), defaults: new Map(), namespaces: new Map() }
}

/**
 * Splits code into its import statements and everything else.
 * Only single-line imports are recognised, which is what these models emit.
 */
function splitImports(code: string, into: ParsedImports): string {
  const body: string[] = []

  for (const line of code.split('\n')) {
    const match = line.match(IMPORT_LINE)
    if (!match) {
      body.push(line)
      continue
    }

    const [, clause, moduleName] = match
    if (!clause) continue // bare side-effect import — nothing to merge

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
  pendingNames: string[]
): AssembleResult {
  return assembleFile(shellCode, [...completedBlocks, ...pendingNames.map(placeholderComponent)])
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
export function assembleFile(shellCode: string, sectionCodes: string[]): AssembleResult {
  const imports = emptyImports()
  const shellBody = splitImports(shellCode, imports)
  // The shell's own declarations win: a section that redefines one of them
  // would be a fatal redeclaration.
  const shellDeclared = splitTopLevelChunks(shellBody)
    .map(chunk => chunk.name)
    .filter((name): name is string => name !== null)

  const sectionBodies = dedupeDeclarations(
    sectionCodes
      .filter(code => code && code.trim().length > 0)
      .map(code => stripDefaultExport(splitImports(code, imports)).trim())
      .filter(Boolean),
    shellDeclared
  )

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

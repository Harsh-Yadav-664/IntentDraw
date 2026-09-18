/**
 * Works out which components a shell promises but doesn't define — those are
 * the sections staged generation still has to fill in.
 *
 * Deriving this from the shell costs nothing: the shell already declares the
 * page structure by referencing `<Hero />`, `<Region3 />` and so on. That works
 * the same whether the structure came from a drawing or from the prompt alone,
 * so prompt-only generation gets staged too.
 */

const MANIFEST = /\/\*\s*SECTIONS:\s*([^*]+)\*\//i
const JSX_USAGE = /<([A-Z][\w$]*)[\s/>]/g
const DECLARATIONS = [
  /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
  /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/g,
]
const IMPORTED = /import\s+(?:(.+?)\s+from\s+)?['"][^'"]+['"]/g

/** Components React itself provides, which are never sections. */
const BUILT_INS = new Set(['Fragment', 'Suspense', 'StrictMode', 'Profiler'])

/**
 * The shell is asked to list its sections explicitly, which removes any
 * guesswork about whether an unresolved name is a section or a forgotten icon
 * import.
 */
export function parseSectionManifest(code: string): string[] | null {
  const match = code.match(MANIFEST)
  if (!match) return null
  const names = match[1]
    .split(',')
    .map(name => name.trim())
    .filter(name => /^[A-Z][\w$]*$/.test(name))
  return names.length > 0 ? names : null
}

/** Names bound by import statements, including default and aliased forms. */
function importedNames(code: string): Set<string> {
  const names = new Set<string>()
  for (const match of code.matchAll(IMPORTED)) {
    const clause = match[1]
    if (!clause) continue
    const namespace = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
    if (namespace) {
      names.add(namespace[1])
      continue
    }
    const bracesAt = clause.indexOf('{')
    const defaultPart = (bracesAt === -1 ? clause : clause.slice(0, bracesAt)).replace(/,\s*$/, '').trim()
    if (defaultPart) names.add(defaultPart)
    if (bracesAt !== -1) {
      const inner = clause.slice(bracesAt + 1, clause.lastIndexOf('}'))
      for (const raw of inner.split(',')) {
        const spec = raw.trim()
        if (!spec) continue
        names.add(spec.split(/\s+as\s+/i).pop()!.trim())
      }
    }
  }
  return names
}

/** Components used in JSX but neither declared nor imported in this file. */
export function findUndefinedComponents(code: string): string[] {
  const declared = new Set<string>()
  for (const pattern of DECLARATIONS) {
    for (const match of code.matchAll(pattern)) declared.add(match[1])
  }
  const imported = importedNames(code)

  const missing = new Set<string>()
  for (const match of code.matchAll(JSX_USAGE)) {
    const name = match[1]
    if (declared.has(name) || imported.has(name) || BUILT_INS.has(name)) continue
    missing.add(name)
  }
  return [...missing]
}

/**
 * The sections still to generate. Prefers the shell's own manifest and falls
 * back to inference, so a model that ignores the manifest instruction still
 * produces a working staged run.
 */
export function resolveSections(shellCode: string): string[] {
  const manifest = parseSectionManifest(shellCode)
  const undefinedComponents = findUndefinedComponents(shellCode)

  if (!manifest) return undefinedComponents

  // Trust the manifest, but don't ask for anything the shell already defines.
  const declared = new Set<string>()
  for (const pattern of DECLARATIONS) {
    for (const match of shellCode.matchAll(pattern)) declared.add(match[1])
  }
  const fromManifest = manifest.filter(name => !declared.has(name))

  // A name the shell actually renders but forgot to list still needs building.
  return [...new Set([...fromManifest, ...undefinedComponents])]
}

/** Groups sections into batches so each call stays small and quota-friendly. */
export function batchSections(sections: string[], size = 2): string[][] {
  const batches: string[][] = []
  for (let i = 0; i < sections.length; i += size) {
    batches.push(sections.slice(i, i + size))
  }
  return batches
}

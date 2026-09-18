/**
 * Deterministic repairs for mistakes models reliably make in single-file TSX.
 * The preview has no bundler and no type checker, so these surface to the user
 * as a red "Compilation Error" box — a broken demo, not a styling nit.
 *
 * Only fixes that are unambiguous belong here. Anything requiring a judgement
 * call is a prompt rule instead.
 */

const LUCIDE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]\s*;?/g

/** Names declared at any level as a const/let/function/class. */
function declaredNames(code: string): Set<string> {
  const names = new Set<string>()
  const patterns = [
    /(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|\n)\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
  ]
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) names.add(match[1])
  }
  return names
}

/**
 * Drops lucide imports the file also declares itself. Models often import an
 * icon and then define a component of the same name, which is a fatal
 * "Duplicate declaration". The local definition is what the JSX actually
 * intends, so the import is the safe side to remove.
 */
export function repairGeneratedCode(code: string): string {
  const declared = declaredNames(code)
  if (declared.size === 0) return code

  return code.replace(LUCIDE_IMPORT, (statement, specifiers: string) => {
    const kept = specifiers
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .filter(spec => {
        // Local binding is what can collide: `Sun` or `Sun as SunIcon`.
        const local = spec.split(/\s+as\s+/i).pop()!.trim()
        return !declared.has(local)
      })

    if (kept.length === specifiers.split(',').map(s => s.trim()).filter(Boolean).length) {
      return statement
    }
    return kept.length > 0 ? `import { ${kept.join(', ')} } from 'lucide-react';` : ''
  })
}

import { parse } from '@babel/parser'

/**
 * Checks generated TSX the way the preview will compile it — before it gets
 * there.
 *
 * The preview has no bundler: whatever a model writes is handed to Babel inside
 * the frame, and until this existed the pipeline only checked that the output
 * was non-empty. A section with a stray brace, or two blocks declaring one
 * name, was returned as a success and the user's first sight of their site was
 * a red compile error. This is the same parser the preview's Babel uses, so a
 * file that passes here compiles there.
 *
 * Pure, and safe in the browser (the editor loads it on demand during a build).
 */

export interface SyntaxProblem {
  /** Babel's own message, without the position suffix. */
  message: string
  line: number | null
  column: number | null
}

interface Node {
  type: string
  loc?: { start: { line: number; column: number } } | null
  [key: string]: unknown
}

/** Names a top-level statement binds as values, with the node that binds each. */
function bindings(statement: Node): Array<{ name: string; node: Node; imported: boolean }> {
  const out: Array<{ name: string; node: Node; imported: boolean }> = []
  const pattern = (node: Node | null | undefined) => {
    if (!node) return
    if (node.type === 'Identifier') out.push({ name: node.name as string, node, imported: false })
    else if (node.type === 'ObjectPattern') for (const prop of node.properties as Node[]) pattern((prop.type === 'RestElement' ? prop.argument : prop.value) as Node)
    else if (node.type === 'ArrayPattern') for (const element of node.elements as Array<Node | null>) pattern(element)
    else if (node.type === 'AssignmentPattern') pattern(node.left as Node)
    else if (node.type === 'RestElement') pattern(node.argument as Node)
  }

  if (statement.type === 'ImportDeclaration') {
    if (statement.importKind === 'type') return out
    for (const spec of statement.specifiers as Node[]) {
      if (spec.importKind === 'type') continue
      out.push({ name: (spec.local as Node).name as string, node: spec, imported: true })
    }
  } else if (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration') {
    if (statement.declaration) return bindings(statement.declaration as Node)
  } else if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
    if (statement.id) pattern(statement.id as Node)
  } else if (statement.type === 'VariableDeclaration') {
    for (const declarator of statement.declarations as Node[]) pattern(declarator.id as Node)
  }
  return out
}

export function findSyntaxProblem(code: string): SyntaxProblem | null {
  try {
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })

    // With TypeScript syntax on, the parser lets an import share its name with
    // a declaration (it could be a type). The preview's transform does not: it
    // stops with `Duplicate declaration "Navigation"`. Catch that here.
    const seen = new Map<string, boolean>()
    for (const statement of ast.program.body as unknown as Node[]) {
      for (const { name, node, imported } of bindings(statement)) {
        const before = seen.get(name)
        if (before !== undefined && (before || imported)) {
          return {
            message: `Duplicate declaration "${name}"`,
            line: node.loc?.start.line ?? null,
            column: node.loc?.start.column ?? null,
          }
        }
        seen.set(name, before ?? imported)
      }
    }
    return null
  } catch (error) {
    const e = error as { message?: string; loc?: { line?: number; column?: number } }
    return {
      message: String(e?.message ?? 'does not parse').replace(/\s*\(\d+:\d+\)\s*$/, ''),
      line: typeof e?.loc?.line === 'number' ? e.loc.line : null,
      column: typeof e?.loc?.column === 'number' ? e.loc.column : null,
    }
  }
}

const DECLARATION = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/

/**
 * The top-level declaration a line of the file belongs to — which component a
 * compile error is in. Null when the line sits above the first declaration.
 */
export function declarationAt(code: string, line: number | null): string | null {
  if (!line) return null
  const lines = code.split(/\r?\n/)
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) {
    const name = lines[i].match(DECLARATION)?.[1]
    if (name) return name
  }
  return null
}

/** One line a model can act on, for a retry or a rebuild note. */
export function describeProblem(problem: SyntaxProblem, code: string): string {
  const where = problem.line ? ` at line ${problem.line}` : ''
  const source = problem.line ? (code.split(/\r?\n/)[problem.line - 1] ?? '').trim().slice(0, 160) : ''
  return `${problem.message}${where}${source ? `: ${source}` : ''}`
}

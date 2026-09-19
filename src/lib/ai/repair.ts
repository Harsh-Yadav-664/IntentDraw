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

const OVERLAY_BG = /^bg-(\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\]|white|black|[a-z]+-(\d{2,3}))\/(\d{1,3})$/

function overlayColour(token: RegExpMatchArray): string {
  const [, which, hex, shade, alphaRaw] = token
  const alpha = Math.min(0.85, Number(alphaRaw) / 100)
  let rgb = [255, 255, 255]
  if (hex) {
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex
    const n = parseInt(full, 16)
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  } else if (which === 'black' || (shade && Number(shade) >= 400)) {
    rgb = [0, 0, 0]
  }
  return `rgba(${rgb.join(',')},${alpha})`
}

/**
 * Softens full-bleed translucent overlays on a page that carries the user's
 * drawing (`<IntentScene />`).
 *
 * Asked for a scrim behind the text, models reliably add one across the entire
 * section — `absolute inset-0 bg-[#FBF9F5]/80 backdrop-blur-sm` — which washes
 * the picture the user drew into near-invisibility. The prompt forbids it; this
 * catches it anyway, turning the flat overlay into a radial scrim of the same
 * colour: still dark/light enough behind centred text, clear at the edges where
 * the picture shows. Opaque overlays are left alone — those are deliberate.
 */
export function softenSceneOverlays(code: string): string {
  if (!code.includes('IntentScene')) return code

  return code.replace(/className=(["'`])([^"'`]*)\1/g, (whole, quote: string, classes: string) => {
    const tokens = classes.split(/\s+/).filter(Boolean)
    if (!tokens.includes('absolute') || !tokens.includes('inset-0')) return whole

    const bgIndex = tokens.findIndex(t => OVERLAY_BG.test(t))
    const blurred = tokens.some(t => t.startsWith('backdrop-blur'))
    const alpha = bgIndex >= 0 ? Number(tokens[bgIndex].match(OVERLAY_BG)![4]) : 0
    if (!blurred && alpha < 30) return whole

    const colour = bgIndex >= 0 ? overlayColour(tokens[bgIndex].match(OVERLAY_BG)!) : 'rgba(255,255,255,0.6)'
    const kept = tokens.filter((t, i) => i !== bgIndex && !t.startsWith('backdrop-blur'))
    kept.push(`bg-[radial-gradient(ellipse_at_center,${colour}_0%,transparent_70%)]`)
    return `className=${quote}${kept.join(' ')}${quote}`
  })
}

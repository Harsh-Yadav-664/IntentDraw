/**
 * Offline prompt inspector — builds the EXACT prompt the AI would receive for a
 * given drawing scenario, with zero API calls. Use it to see what the model can
 * actually "see" before spending free-tier quota on a live generation.
 *
 *   npx tsx scripts/diagnose-prompt.ts curves
 *   npx tsx scripts/diagnose-prompt.ts circles
 */
import { buildGenerationUserPrompt } from '../src/lib/ai/prompts'
import { PRESETS } from '../src/lib/ai/design-tokens'
import { parseCanvasData } from '../src/store/canvas-store'
import type { Region, RegionGroup } from '../src/types'

const CANVAS_W = 1280
const CANVAS_H = 800

function makeRegion(
  n: number,
  geometry: Region['geometry'],
  opts: Partial<Pick<Region, 'intent' | 'classificationTag' | 'backgroundScope'>> = {}
): Region {
  return {
    id: `region-${n}`,
    regionNumber: n,
    geometry,
    intent: opts.intent ?? '',
    classificationTag: opts.classificationTag,
    backgroundScope: opts.backgroundScope,
    lockState: { layout: false, style: false, animation: false },
    generatedCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/** A sine-ish stroke sweeping across the canvas, like a hand-drawn wave. */
function curvePath(yBase: number, amplitude: number, points = 24) {
  const path: Array<{ x: number; y: number }> = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    path.push({
      x: Math.round(t * CANVAS_W),
      y: Math.round(yBase + Math.sin(t * Math.PI * 2) * amplitude),
    })
  }
  return path
}

function curveRegion(n: number, yBase: number, amplitude: number): Region {
  const path = curvePath(yBase, amplitude)
  const xs = path.map(p => p.x)
  const ys = path.map(p => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const width = Math.max(...xs) - x
  const height = Math.max(...ys) - y
  return makeRegion(
    n,
    // NOTE: canvas-store re-bases path points to the bbox origin
    { x, y, width, height, type: 'freeform', path: path.map(p => ({ x: p.x - x, y: p.y - y })) },
    // What classifyRegionIntents would return for freeform + "background" wording
    { classificationTag: 'decorative', backgroundScope: 'region' }
  )
}

const SCENARIOS: Record<string, { prompt: string; regions: Region[]; groups?: RegionGroup[] }> = {
  // The user's real failing case: 7 curves swept across the screen, described
  // collectively in the global prompt box as one animated background.
  curves: {
    prompt: 'region 1 to 7 shows the animated background in a neon glowish blur',
    regions: [90, 200, 310, 420, 530, 640, 750].map((yBase, i) =>
      curveRegion(i + 1, yBase, 40 + i * 6)
    ),
  },

  // The "works, but not perfect" case: menu items inside circles.
  circles: {
    prompt: 'a restaurant website, the menu should be visible in circles',
    regions: [
      makeRegion(1, { x: 0, y: 0, width: 1280, height: 120, type: 'rectangle' }),
      makeRegion(2, { x: 120, y: 220, width: 280, height: 280, type: 'circle' }),
      makeRegion(3, { x: 500, y: 220, width: 280, height: 280, type: 'circle' }),
      makeRegion(4, { x: 880, y: 220, width: 280, height: 280, type: 'circle' }),
      makeRegion(5, { x: 0, y: 620, width: 1280, height: 180, type: 'rectangle' }),
    ],
  },
}

/**
 * Loads a real saved project from a running dev server, so the prompt can be
 * inspected against an actual drawing instead of a synthetic one.
 * Region intent tags are not persisted, so absent ones are filled in the way
 * `classifyRegionIntents` would (freeform -> decorative, arrow -> relational).
 */
async function loadProject(id: string, origin = 'http://localhost:3000') {
  const res = await fetch(`${origin}/api/projects/${id}`)
  if (!res.ok) throw new Error(`GET /api/projects/${id} -> ${res.status}`)
  const body = await res.json()
  const project = body.data?.project ?? body.data ?? body
  const stored = parseCanvasData(project.canvas_data ?? project.canvasData ?? project.regions ?? [])
  const regions: Region[] = stored.regions.map((r: Region) => ({
    ...r,
    classificationTag:
      r.classificationTag ??
      (r.geometry.type === 'freeform'
        ? 'decorative'
        : r.geometry.type === 'arrow'
          ? 'relational'
          : 'exact-placement'),
    backgroundScope: r.backgroundScope ?? (r.geometry.type === 'freeform' ? 'region' : undefined),
  }))
  return { prompt: project.prompt ?? '', regions, groups: stored.groups }
}

async function main() {
const name = process.argv[2] ?? 'curves'
const scenario =
  name === 'project'
    ? await loadProject(process.argv[3] ?? '')
    : SCENARIOS[name]

if (!scenario) {
  console.error(`Unknown scenario "${name}". Options: ${Object.keys(SCENARIOS).join(', ')}, or: project <id>`)
  process.exit(1)
}

// glassmorphism is what resolveByKeywords picks for "neon/glow/blur" — hardcoded
// here so this script never makes a model call.
const tokens = PRESETS.glassmorphism

const built = buildGenerationUserPrompt(
  scenario.regions,
  scenario.prompt,
  tokens,
  undefined,
  true, // pretend the canvas image is attached (Gemini-only in practice)
  scenario.groups ?? []
)

console.log('='.repeat(78))
console.log(`SCENARIO: ${name}   |   regions: ${scenario.regions.length}`)
console.log('='.repeat(78))
console.log(built)
console.log('='.repeat(78))
console.log(`prompt length: ${built.length} chars (~${Math.round(built.length / 4)} tokens)`)

// Does the drawn stroke geometry survive into the prompt, or only bounding boxes?
const strokes = scenario.regions.filter(r => (r.geometry.path?.length ?? 0) > 1)
if (strokes.length > 0) {
  const emitted = (built.match(/d="M /g) ?? []).length + (built.match(/"svgPath": "M /g) ?? []).length
  console.log(`stroke regions: ${strokes.length}`)
  console.log(`stroke paths present in prompt: ${emitted > 0 ? `YES (${emitted})` : 'NO — only bounding boxes survive'}`)
}
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

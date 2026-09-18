/**
 * End-to-end check: takes a saved project, runs it through the real
 * /api/generate route, wraps the result in the real preview runtime and writes
 * it to public/ so it can be opened in a browser.
 *
 * Requires `pnpm dev` to be running. Costs one generation against your quota.
 *
 *   npx tsx scripts/generate-preview.ts <projectId> [provider]
 */
import { writeFileSync } from 'fs'
import { wrapReactForPreview } from '../src/lib/utils/sanitize'
import { buildShapePath } from '../src/lib/ai/shape-path'
import { parseCanvasData } from '../src/store/canvas-store'
import type { Region } from '../src/types'

const ORIGIN = 'http://localhost:3000'
const OUT = 'public/preview-harness.html'

async function main() {
  const projectId = process.argv[2]
  const provider = process.argv[3] ?? 'gemini'
  if (!projectId) {
    console.error('usage: npx tsx scripts/generate-preview.ts <projectId> [provider]')
    process.exit(1)
  }

  const projectRes = await fetch(`${ORIGIN}/api/projects/${projectId}`)
  if (!projectRes.ok) throw new Error(`GET project -> ${projectRes.status}`)
  const body = await projectRes.json()
  const project = body.data?.project ?? body.data ?? body
  const { regions, groups } = parseCanvasData(
    project.canvas_data ?? project.canvasData ?? project.regions ?? []
  )

  console.log(`project: ${project.name ?? projectId}`)
  console.log(`regions: ${regions.length}   groups: ${groups.length}   prompt: ${String(project.prompt).slice(0, 80)}...`)
  console.log(`generating via ${provider} (no canvas image — geometry only)...`)

  const started = Date.now()
  const genRes = await fetch(`${ORIGIN}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regions, groups, imageData: null, prompt: project.prompt, provider }),
  })
  const result = await genRes.json()
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  if (!result.success) {
    console.error(`FAILED after ${seconds}s: ${result.error}`)
    process.exit(1)
  }

  const code: string = result.data.code
  console.log(`ok in ${seconds}s via ${result.data.provider} — ${code.length} chars`)

  // Did the model actually honour the drawn geometry, or invent its own shapes?
  const drawn = regions
    .map(r => buildShapePath(r, 14, { canvasWidth: canvasW(regions), canvasHeight: canvasH(regions) }))
    .filter((s): s is NonNullable<typeof s> => s !== null)
  const reused = drawn.filter(s => code.includes(s.d.split(' L ')[0])).length

  console.log(`drawn strokes reused verbatim: ${reused}/${drawn.length}`)
  console.log(`uses gsap: ${/\bgsap\./.test(code)}   imports framer-motion: ${/framer-motion/.test(code)}`)

  writeFileSync(OUT, wrapReactForPreview(code), 'utf8')
  console.log(`wrote ${OUT} — open ${ORIGIN}/preview-harness.html`)
}

const canvasW = (regions: Region[]) =>
  Math.max(...regions.map(r => r.geometry.x + r.geometry.width), 1)
const canvasH = (regions: Region[]) =>
  Math.max(...regions.map(r => r.geometry.y + r.geometry.height), 1)

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

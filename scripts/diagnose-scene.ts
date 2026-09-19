/**
 * Renders what the scene block will hand the model for a saved drawing — with
 * zero API calls — so the computed geometry can be checked by eye.
 *
 *   npx tsx scripts/diagnose-scene.ts <project.json> [brief.json] [out.svg]
 *
 * project.json: a `GET /api/projects/:id` response (or its `data.project`).
 * brief.json:   a brief as the understanding stage returns it. Without one, a
 *               stand-in reading is used so the geometry itself can be checked.
 * out.svg:      defaults to public/_scene-debug.svg (serve with `pnpm dev`).
 */
import { readFileSync, writeFileSync } from 'fs'
import { describeScene, normalizeBrief } from '../src/lib/ai/brief'
import type { Region } from '../src/types'

async function main() {
  const [projectPath, briefPath, outPath = 'public/_scene-debug.svg'] = process.argv.slice(2)
  if (!projectPath) throw new Error('usage: diagnose-scene.ts <project.json> [brief.json] [out.svg]')

  const json = JSON.parse(readFileSync(projectPath, 'utf8'))
  const project = json.data?.project ?? json
  const canvas = project.canvas_data
  const regions: Region[] = Array.isArray(canvas) ? canvas : canvas.regions

  const rawBrief = briefPath
    ? JSON.parse(readFileSync(briefPath, 'utf8'))
    : {
        concept: 'stand-in',
        drawing: {
          reading: 'stand-in reading',
          elements: regions.map((r, i) => ({ name: `R${r.regionNumber}`, regions: [r.regionNumber], role: 'illustration', form: 'line', depth: i })),
        },
      }
  const brief = normalizeBrief(rawBrief, regions, project.prompt ?? '')
  const scene = describeScene(brief, regions)
  console.log(scene || '(no illustration elements in this brief)')

  // Pull the <svg> out of the block and give each shape a visible debug style.
  const svg = scene.match(/<svg[\s\S]*<\/svg>/)?.[0]
  if (!svg) return
  const palette = ['#F4B942', '#E07A5F', '#6B8F71', '#3D5A80', '#98C1D9', '#9C6644', '#5E548E']
  let n = 0
  const styled = svg
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1280" ')
    .replace('<defs>{/* your gradients and filters */}</defs>', '<rect width="100%" height="100%" fill="#FFF8EE"/>')
    .replace(/<!--([^>]*?), (fill|stroke)([^>]*?)-->\s*((?:<(?:path|circle)[^>]*\/>\s*)+)/g, (_m, _label, paint, _rest, shapes: string) => {
      const color = palette[n++ % palette.length]
      const style = paint === 'fill' ? `fill="${color}" fill-opacity="0.85" stroke="none"` : `fill="none" stroke="${color}" stroke-width="5"`
      return shapes.replace(/\/>/g, ` ${style}/>`)
    })
  writeFileSync(outPath, styled)
  console.log(`\nwrote ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

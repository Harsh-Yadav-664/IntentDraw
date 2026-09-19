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
import { renderSceneComponent } from '../src/lib/ai/scene-render'
import type { Region } from '../src/types'

/** Our own generated JSX → plain SVG, just enough to open the scene in a browser. */
function jsxToSvg(component: string): string {
  const svg = component.match(/<svg[\s\S]*<\/svg>/)?.[0] ?? ''
  return svg
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/className=\{`[^`]*`\}/g, '')
    .replace(/className="[^"]*"/g, '')
    .replace(/style=\{\{[^}]*\}\}/g, '')
    .replace(/<style>\{`([\s\S]*?)`\}<\/style>/, '<style>$1</style>')
    .replace(/([a-z])([A-Z])(?=[a-zA-Z]*=)/g, (_m, a, b) => `${a}-${b.toLowerCase()}`)
    .replace(/=\{([^}]+)\}/g, '="$1"')
    .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1280"')
    .replace(/view-box=/, 'viewBox=')
    .replace(/preserve-aspect-ratio=/, 'preserveAspectRatio=')
}

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
  console.log(describeScene(brief, regions) || '(no illustration elements in this brief)')

  const component = renderSceneComponent(brief.drawing.elements, regions, brief.palette)
  if (!component) return
  console.log(`
--- IntentScene: ${component.length} chars`)
  writeFileSync(outPath, jsxToSvg(component))
  console.log(`wrote ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

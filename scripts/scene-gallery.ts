/**
 * Re-renders a saved project's page with today's scene renderer and page shell,
 * in every scene style, with zero API calls — so changes to how drawings are
 * painted can be judged by eye on a real page.
 *
 *   npx tsx scripts/scene-gallery.ts <project.json> [--scene-only]
 *
 * project.json: a `GET /api/projects/:id` response (or its `data.project`), or a
 *               fixture with `prompt`, `regions` and `brief`.
 * Writes public/_scene-<style>.html for each style (serve with `pnpm dev`; a
 * file:// URL will not run its scripts). The saved sections are reused, so only
 * the drawing, the shell and the runtime are new; --scene-only swaps them for
 * placeholders to look at the picture alone.
 */
import { readFileSync, writeFileSync } from 'fs'
import { normalizeBrief } from '../src/lib/ai/brief'
import { SCENE_STYLES, renderSceneComponent } from '../src/lib/ai/scene-render'
import { buildPageShell } from '../src/lib/ai/page-shell'
import { renderObjects } from '../src/lib/ai/objects'
import { assembleProgressive } from '../src/lib/ai/assemble'
import { wrapReactForPreview } from '../src/lib/utils/sanitize'
import type { Region } from '../src/types'

const [path, ...flags] = process.argv.slice(2)
if (!path) throw new Error('usage: scene-gallery.ts <project.json> [--scene-only]')
const json = JSON.parse(readFileSync(path, 'utf8'))
const project = json.data?.project ?? json
const canvas = typeof project.canvas_data === 'string' ? JSON.parse(project.canvas_data) : project.canvas_data
const regions: Region[] = (canvas ? (Array.isArray(canvas) ? canvas : canvas.regions) : project.regions) as Region[]
const savedBrief = canvas?.pageParts?.brief ?? project.brief
const savedBlocks: string[] = flags.includes('--scene-only') ? [] : (canvas?.pageParts?.blocks ?? []).map((b: { code: string }) => b.code)

const brief = normalizeBrief(savedBrief, regions, project.prompt ?? '')
console.log(brief.drawing.elements.map(e => `${e.name}: R${e.regions.join('+R')} ${e.role}/${e.form} ${e.placement}`).join('\n'))

for (const style of SCENE_STYLES) {
  const scene = renderSceneComponent(brief.drawing.elements, regions, brief.palette, { style })
  const objects = renderObjects(brief.drawing.elements, regions, brief.palette)
  const shell = buildPageShell(brief, regions, !!scene, objects.objects)
  const built = new Set(savedBlocks.join('\n').match(/(?<=\bconst |\bfunction )[A-Z]\w*/g) ?? [])
  const missing = shell.sections.filter(s => !built.has(s))
  const { code } = assembleProgressive(shell.shellCode, [scene, objects.code, ...savedBlocks].filter(Boolean), missing)
  const out = `public/_scene-${style}.html`
  // Debug pages only: a compile or render error is printed on the page itself,
  // so a headless screenshot (scripts/shoot.mjs) shows it.
  const show = '<script>addEventListener("message",function(e){if(e.data&&e.data.type==="IFRAME_ERROR"&&e.data.kind!=="script"){var p=document.createElement("pre");p.id="__err";p.style.cssText="position:fixed;inset:auto 0 0 0;z-index:99999;background:#300;color:#fdd;font:12px monospace;white-space:pre-wrap;margin:0;padding:8px";p.textContent=e.data.message;document.documentElement.appendChild(p)}});addEventListener("load",function(){var m=location.hash.match(/__scroll=(\d+)/);if(m)setTimeout(function(){scrollTo(0,m[1]*innerHeight)},2500)})</script>'
  writeFileSync(out, wrapReactForPreview(code, { appOrigin: '' }).replace('<head>', '<head>' + show))
  console.log(`wrote ${out}${missing.length ? ` (placeholders: ${missing.join(', ')})` : ''}`)
}

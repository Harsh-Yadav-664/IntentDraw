/**
 * Writes a saved project's page to an HTML file through the real preview
 * runtime, zero API calls — for screenshotting a generated site:
 *
 *   npx tsx scripts/render-project.ts <project.json> public/_project.html
 *   node scripts/shoot.mjs <outDir> http://localhost:3000/_project.html --size 1280x800
 *
 * Animations are frozen at their end state (headless Chrome advances only a
 * few frames, so scroll reveals would otherwise stay invisible).
 *
 * `project.json` is a `GET /api/projects/:id` response.
 */
import { readFileSync, writeFileSync } from 'fs'
import { wrapReactForPreview } from '../src/lib/utils/sanitize'

const [input, out = 'public/_project.html'] = process.argv.slice(2)
if (!input) {
  console.error('usage: npx tsx scripts/render-project.ts <project.json> [out.html]')
  process.exit(1)
}
const json = JSON.parse(readFileSync(input, 'utf8'))
const project = json.data?.project ?? json.project ?? json
if (!project.generated_code) {
  console.error('no generated_code in that file')
  process.exit(1)
}
// Lets scripts/shoot.mjs --scroll=N shoot further screens (`#__scroll=N`).
// Headless Chrome won't scroll this page, so the body is shifted up instead,
// and reveals that wait for the reader to scroll (opacity 0) are shown.
const scrollHook = '<script>addEventListener("load",function(){setTimeout(function(){document.querySelectorAll("[data-section] *").forEach(function(e){if(getComputedStyle(e).opacity==="0"){e.style.setProperty("opacity","1","important");e.style.setProperty("transform","none","important")}});var m=location.hash.match(/__scroll=(\\d+)/);if(m){document.body.style.transform="translateY(-"+(m[1]*innerHeight)+"px)"}},2500)})</script>'
writeFileSync(out, wrapReactForPreview(project.generated_code, { freeze: true }).replace('</body>', scrollHook + '</body>'))
console.log(`wrote ${out}`)

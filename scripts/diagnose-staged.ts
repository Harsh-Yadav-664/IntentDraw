/**
 * Shows what the staged pipeline will build for a drawing — with ZERO API calls.
 *
 *   npx tsx scripts/diagnose-staged.ts <project.json> [brief.json] [--prompts]
 *
 * project.json: a `GET /api/projects/:id` response, or a raw projects row
 * (needs `canvas_data` and `prompt`). brief.json: a brief to test with; without
 * one, the brief saved in the project's page parts is used. The brief goes
 * through normalizeBrief exactly as it does on the server, so this also shows
 * what the code corrects on its own (handwriting, spheres, section assignment).
 *
 * Prints the normalized drawing reading, the page skeleton, the batches, and
 * for every section the block telling it what was drawn there. --prompts also
 * prints each batch's full section prompt.
 */
import fs from 'fs'
import { normalizeBrief } from '../src/lib/ai/brief'
import { generateShellStage } from '../src/lib/ai/staged'
import { describeDrawnSections } from '../src/lib/ai/page-shell'
import { buildStagedSectionUserPrompt } from '../src/lib/ai/prompts'
import { designTokens } from '../src/lib/ai/site-design'
import { parseCanvasData } from '../src/store/canvas-store'

async function main() {
  const [projectPath, briefPath] = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const showPrompts = process.argv.includes('--prompts')
  if (!projectPath) {
    console.error('usage: npx tsx scripts/diagnose-staged.ts <project.json> [brief.json] [--prompts]')
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(projectPath, 'utf8'))
  const project = raw.data ?? raw
  const { regions, groups } = parseCanvasData(project.canvas_data)
  const prompt: string = project.prompt ?? ''
  const sentBrief = briefPath
    ? JSON.parse(fs.readFileSync(briefPath, 'utf8'))
    : project.canvas_data?.pageParts?.brief
  if (!sentBrief) throw new Error('no brief: pass brief.json or use a project with saved page parts')

  const brief = normalizeBrief(sentBrief, regions, prompt)
  console.log('== READING:', brief.drawing.reading)
  for (const e of brief.drawing.elements) {
    console.log(`   ${e.name.padEnd(28)} ${e.regions.map(n => 'R' + n).join('+').padEnd(26)} ${e.role}${e.form ? '/' + e.form : ''} → ${e.section ?? '(no section)'}`)
  }
  console.log('== DESIGN:', JSON.stringify(brief.design))

  const tokens = designTokens(brief.design, brief.styleId)
  const shell = await generateShellStage({ regions, groups, prompt, tokens, provider: 'gemini', brief })
  console.log('\n== SHELL (built in code)\n' + shell.shellCode)
  console.log('== SCENE:', shell.sceneCode ? `${shell.sceneCode.length} chars${/Sphere0/.test(shell.sceneCode) ? ', with a 3D sphere' : ''}` : 'none')
  console.log('== BATCHES:', JSON.stringify(shell.batches))

  for (const batch of shell.batches ?? []) {
    const drawn = describeDrawnSections(batch, brief, regions, groups)
    if (drawn) console.log('\n' + drawn)
    if (showPrompts) {
      console.log(`\n---------- FULL PROMPT FOR ${batch.join(' & ')} ----------`)
      console.log(buildStagedSectionUserPrompt(batch, shell.shellCode!, regions, prompt, tokens, undefined, groups, brief))
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

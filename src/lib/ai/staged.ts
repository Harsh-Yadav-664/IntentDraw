import { extractReact } from '@/lib/utils'
import type { Region, RegionGroup } from '@/types'
import type { DesignTokenSet } from './design-tokens'
import type { DesignBrief } from './brief'
import {
  buildFallbackChain,
  callProvider,
  humanizeProviderError,
  type ProviderName,
} from './provider'
import { STAGED_SECTION_SYSTEM_PROMPT, buildStagedSectionUserPrompt } from './prompts'
import { repairGeneratedCode } from './repair'
import { aliasSectionImports } from './assemble'
import { describeProblem, findSyntaxProblem } from './validate'
import { lintLayout } from './layout-lint'
import { fixContrast } from './contrast-fix'
import { aiLookNote, fixAiLook, scanAiLook } from './ai-look'
import { MONOCHROME } from './prompt-rules'
import { renderSceneComponent } from './scene-render'
import { enforceDesign } from './site-design'
import { buildPageShell, ownNavigation } from './page-shell'
import { renderObjects } from './objects'

/**
 * Staged generation: one short call for the page shell, then one short call per
 * batch of sections.
 *
 * This exists for three reasons the single long call can't satisfy:
 *   - the user sees progress and partial output instead of a 2-minute blank wait
 *   - each call is small enough to fit a serverless duration limit
 *   - spacing the calls lets a free-tier per-minute quota recover between them,
 *     and a failed section can be retried without discarding the rest
 */

export interface StageContext {
  regions: Region[]
  groups: RegionGroup[]
  prompt: string
  tokens: DesignTokenSet
  globalTheme?: string
  provider: ProviderName
  nvidiaModelId?: string
  /** The understanding pass's brief. Absent only for callers that predate it. */
  brief?: DesignBrief
}

export interface ShellStageResult {
  success: boolean
  shellCode?: string
  /** The user's drawing as a ready-made component, assembled in ahead of the sections. */
  sceneCode?: string
  sections?: string[]
  batches?: string[][]
  provider?: ProviderName
  error?: string
}

export interface SectionStageResult {
  success: boolean
  code?: string
  provider?: ProviderName
  /** The model that wrote the code that was kept. */
  model?: string
  /** How long the section took, retries included. */
  ms?: number
  /** What still looks generated, as a ready rebuild note. */
  note?: string
  error?: string
}

/** Names this code block declares, used to check a section pass did its job. */
function declares(code: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:const|let|var|function|class)\\s+${escaped}\\b`).test(code)
}

const RATE_LIMITED = /\b429\b|too many requests|resource_exhausted|rate.?limit|\bquota\b/i

/**
 * Free-tier limits are per-minute and recover on their own. Falling straight
 * through the provider chain on a 429 turns a temporary block into a permanently
 * missing section, so a rate-limited batch waits and tries again instead.
 */
const RATE_LIMIT_RETRIES = 2
const RATE_LIMIT_BACKOFF_MS = [8000, 16000]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Stage 1 — the page shell. Built in code from the brief (page-shell.ts): every
 * planned section in order, the drawing's art layer behind the section it
 * belongs to, and the site's font marker. No model call — see page-shell.ts for
 * why the model-written shell was retired.
 */
export async function generateShellStage(context: StageContext): Promise<ShellStageResult> {
  const { regions, brief } = context
  const sceneCode = brief && brief.source !== 'fallback'
    ? renderSceneComponent(brief.drawing.elements, regions, brief.palette, { design: brief.design })
    : ''
  // 3D objects the user drew are built here too, and travel in the same block
  // as the scene — assembled ahead of every section, so none can replace them.
  const objects = brief ? renderObjects(brief.drawing.elements, regions, brief.palette) : { code: '', objects: [] }
  const shell = buildPageShell(brief, regions, !!sceneCode, objects.objects)
  const art = [sceneCode, objects.code].filter(Boolean).join('\n\n')
  return {
    success: true,
    shellCode: shell.shellCode,
    sceneCode: art || undefined,
    sections: shell.sections,
    batches: shell.batches,
  }
}

/**
 * Stage 2 — one batch of section components.
 * Tries the provider that built the shell first, so a run that already hit a
 * rate limit on one provider doesn't keep walking back into it.
 */
export async function generateSectionStage(
  context: StageContext,
  sectionNames: string[],
  shellCode: string,
  /** The user's instruction when rebuilding a single section. */
  note?: string
): Promise<SectionStageResult> {
  const { regions, groups, prompt, tokens, globalTheme, provider, nvidiaModelId, brief } = context

  const userMessage = buildStagedSectionUserPrompt(
    sectionNames,
    shellCode,
    regions,
    prompt,
    tokens,
    globalTheme,
    groups,
    brief,
    note
  )

  const fallbacks = buildFallbackChain(provider)
  let errors: Record<string, string> = {}

  const pageSections = [...new Set([...(brief?.sections ?? []).map(s => s.name), ...sectionNames])]
  // A black-and-white site keeps its desaturated photos; any other loses the habit.
  const monochrome = MONOCHROME.test([prompt, brief?.concept, brief?.signature, ...(brief?.tone ?? [])].join(' '))
  // Text that can't be read on its own button or band gets the palette's ink.
  const inks = brief?.palette ? [brief.palette.text, brief.palette.background] : []
  const finish = (responseText: string) => {
    const repaired = repairGeneratedCode(aliasSectionImports(extractReact(responseText), pageSections))
    return fixContrast(brief ? enforceDesign(repaired, brief.design, { monochrome }) : repaired, inks).code
  }

  const started = Date.now()
  let model: string | undefined
  const onModel = (name: string) => { model = name }

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    errors = {}

    for (const current of fallbacks) {
      try {
        model = undefined
        let code = finish(await callProvider(current, STAGED_SECTION_SYSTEM_PROMPT, userMessage, { nvidiaModelId, onModel }))
        if (!code || code.length < 10) throw new Error('section empty')

        // Nothing that fails to compile leaves this function as a success. The
        // model gets one chance to correct itself with the compiler's own
        // message; a second failure is a failed section (a placeholder the
        // user can rebuild), never a page that will not render.
        let problem = findSyntaxProblem(code)
        if (problem) {
          const said = describeProblem(problem, code)
          console.warn(`[Staged section ${sectionNames.join(',')}] ${current} wrote code that does not compile (${said}) — asking once more`)
          const correction = `${userMessage}\n\nYOUR PREVIOUS ANSWER DID NOT COMPILE: ${said}\nWrite the components again in full. Every brace, bracket, parenthesis, quote and JSX tag must be closed, and no name may be declared or imported twice.`
          code = finish(await callProvider(current, STAGED_SECTION_SYSTEM_PROMPT, correction, { nvidiaModelId, onModel }))
          problem = code ? findSyntaxProblem(code) : null
          if (!code || problem) throw new Error(`does not compile — ${problem ? describeProblem(problem, code) : 'empty answer'}`)
        }

        // Layout mistakes with one right answer (a grid row adding up to more
        // columns than the grid has) are fixed here, for free.
        const lint = lintLayout(code)
        if (lint.fixes.length > 0) {
          console.info(`[Staged section ${sectionNames.join(',')}] layout fixed: ${lint.fixes.join('; ')}`)
          code = lint.code
        }

        // Signs the page was made by AI (ai-look.ts): the mechanical ones are
        // fixed here; a P0 left over gets one corrective call, kept only if it
        // compiles and looks less generated. The rest travel with the section,
        // so the user can rebuild it with the note in one click.
        // A second navigation bar (page-shell.ts ownNavigation) is fixed by the
        // same one call — the two problems never cost two.
        code = fixAiLook(code).code
        let tells = scanAiLook(code)
        let doubled = ownNavigation(code, sectionNames, pageSections)
        const badness = (t: typeof tells, d: string[]) => t.filter(x => x.severity === 'P0').length + d.length
        if (badness(tells, doubled) > 0) {
          const problems = [
            ...(doubled.length > 0 ? [`${doubled.join(', ')} drew its own navigation bar, but the page already has one — remove it and start with the section's own content.`] : []),
            ...(tells.some(t => t.severity === 'P0') ? [`It looked generated. ${aiLookNote(tells)}`] : []),
          ]
          const retry = `${userMessage}\n\nYOUR PREVIOUS ANSWER HAD PROBLEMS: ${problems.join(' ')}\nWrite the components again in full, fixing exactly that and keeping everything else.`
          try {
            let retryModel: string | undefined
            const again = fixAiLook(lintLayout(finish(await callProvider(current, STAGED_SECTION_SYSTEM_PROMPT, retry, { nvidiaModelId, onModel: name => { retryModel = name } }))).code).code
            const ok = again && !findSyntaxProblem(again) && sectionNames.every(name => declares(again, name))
            const againTells = ok ? scanAiLook(again) : null
            const againDoubled = ok ? ownNavigation(again, sectionNames, pageSections) : null
            if (againTells && againDoubled && badness(againTells, againDoubled) < badness(tells, doubled)) {
              code = again
              tells = againTells
              doubled = againDoubled
              model = retryModel ?? model
            }
          } catch (err) {
            console.warn(`[Staged section ${sectionNames.join(',')}] look retry failed, keeping the first answer:`, err instanceof Error ? err.message : err)
          }
        }

        // A response that doesn't declare what was asked for would leave the
        // assembled page referencing an undefined component.
        if (!sectionNames.some(name => declares(code, name))) {
          throw new Error(`did not define ${sectionNames.join(' or ')}`)
        }

        const note = [
          doubled.length > 0 ? 'Draws its own navigation bar under the page\'s real one — remove it and start with the section\'s content.' : '',
          aiLookNote(tells),
        ].filter(Boolean).join(' ')
        return { success: true, code, provider: current, model, ms: Date.now() - started, note: note || undefined }
      } catch (err) {
        errors[current] = err instanceof Error ? err.message : String(err)
        console.warn(`[Staged section ${sectionNames.join(',')}] ${current} failed:`, errors[current])
      }
    }

    // Only a rate limit is worth waiting out — anything else will fail again.
    const rateLimited = Object.values(errors).some(message => RATE_LIMITED.test(message))
    if (!rateLimited || attempt === RATE_LIMIT_RETRIES) break

    const wait = RATE_LIMIT_BACKOFF_MS[attempt] ?? 16000
    console.warn(`[Staged section ${sectionNames.join(',')}] rate limited — retrying in ${wait}ms`)
    await sleep(wait)
  }

  return {
    success: false,
    error: `Could not build ${sectionNames.join(', ')} — ${fallbacks
      .map(p => `${p}: ${humanizeProviderError(errors[p])}`)
      .join(' | ')}`,
  }
}

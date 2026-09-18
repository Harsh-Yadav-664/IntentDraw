import { extractReact } from '@/lib/utils'
import type { Region, RegionGroup } from '@/types'
import type { DesignTokenSet } from './design-tokens'
import {
  buildFallbackChain,
  callProvider,
  humanizeProviderError,
  type ProviderName,
} from './provider'
import {
  STAGED_SECTION_SYSTEM_PROMPT,
  STAGED_SHELL_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  buildStagedSectionUserPrompt,
} from './prompts'
import { repairGeneratedCode } from './repair'
import { batchSections, resolveSections } from './sections'

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
}

export interface ShellStageResult {
  success: boolean
  shellCode?: string
  sections?: string[]
  batches?: string[][]
  provider?: ProviderName
  error?: string
}

export interface SectionStageResult {
  success: boolean
  code?: string
  provider?: ProviderName
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
 * Stage 1 — the page shell: layout, full-page background, and a manifest of the
 * sections still to build.
 */
export async function generateShellStage(
  context: StageContext,
  imageBase64?: string
): Promise<ShellStageResult> {
  const { regions, groups, prompt, tokens, globalTheme, provider, nvidiaModelId } = context
  const hasDrawingImage = regions.length > 0 && !!imageBase64

  const userMessage = buildGenerationUserPrompt(
    regions,
    prompt,
    tokens,
    globalTheme,
    hasDrawingImage,
    groups
  )

  const errors: Record<string, string> = {}
  const fallbacks = buildFallbackChain(provider)

  for (const current of fallbacks) {
    try {
      const responseText = await callProvider(current, STAGED_SHELL_SYSTEM_PROMPT, userMessage, {
        nvidiaModelId,
        // Only Gemini reads the image; the drawing's geometry reaches the others as text.
        imageBase64: current === 'gemini' && hasDrawingImage ? imageBase64 : undefined,
      })

      const shellCode = repairGeneratedCode(extractReact(responseText))
      if (!shellCode || shellCode.length < 20) throw new Error('shell empty')
      if (!shellCode.includes('export default')) throw new Error('shell truncated — no export default')

      const sections = resolveSections(shellCode)
      return {
        success: true,
        shellCode,
        sections,
        batches: batchSections(sections),
        provider: current,
      }
    } catch (err) {
      errors[current] = err instanceof Error ? err.message : String(err)
      console.warn(`[Staged shell] ${current} failed:`, errors[current])
    }
  }

  return {
    success: false,
    error: `Could not build the page shell — ${fallbacks
      .map(p => `${p}: ${humanizeProviderError(errors[p])}`)
      .join(' | ')}`,
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
  shellCode: string
): Promise<SectionStageResult> {
  const { regions, groups, prompt, tokens, globalTheme, provider, nvidiaModelId } = context

  const userMessage = buildStagedSectionUserPrompt(
    sectionNames,
    shellCode,
    regions,
    prompt,
    tokens,
    globalTheme,
    groups
  )

  const fallbacks = buildFallbackChain(provider)
  let errors: Record<string, string> = {}

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    errors = {}

    for (const current of fallbacks) {
      try {
        const responseText = await callProvider(current, STAGED_SECTION_SYSTEM_PROMPT, userMessage, {
          nvidiaModelId,
        })

        const code = repairGeneratedCode(extractReact(responseText))
        if (!code || code.length < 10) throw new Error('section empty')

        // A response that doesn't declare what was asked for would leave the
        // assembled page referencing an undefined component.
        if (!sectionNames.some(name => declares(code, name))) {
          throw new Error(`did not define ${sectionNames.join(' or ')}`)
        }

        return { success: true, code, provider: current }
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

import { geminiGenerate } from './gemini'
import { groqGenerate } from './groq'
import { nvidiaGenerate } from './nvidia'
import { openrouterGenerate, OPENROUTER_DEFAULT_MODEL } from './openrouter'
import { extractReact, withTimeout } from '@/lib/utils'
import type { GenerationResponse } from '@/types'
import type { Part } from '@google/generative-ai'
import {
  GENERATION_SYSTEM_PROMPT,
  REGENERATE_REGION_SYSTEM_PROMPT,
  CHUNKED_SHELL_SYSTEM_PROMPT,
  CHUNKED_REGION_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  buildRegenerateUserPrompt,
  buildShellUserPrompt,
  buildChunkUserPrompt,
} from './prompts'
import { resolveDesignTokens } from './design-tokens'
import { repairGeneratedCode } from './repair'
import { assembleFile } from './assemble'
import type { AIProvider, Region, RegionGroup } from '@/types'

// Per-provider hard cap for a single generation call. Above this we give up on
// that provider and let the fallback chain try the next one, so a slow or dead
// upstream can't stall the whole request. Tuned to measured latencies
// (2026-08-30): Gemini vision generation runs ~30-45s and can exceed 60s on a
// real drawing + full prompt, so it gets the most headroom; Groq (gpt-oss-120b)
// answers in ~7s; NVIDIA models are currently slow/EOL, so cap low to fail over.
//
// openrouter: 90s. Two effects stack on the free tier — free endpoints are
// queued behind paid traffic, and the free models worth using are MoE
// *reasoning* models that spend time before the first output token. So it needs
// more headroom than Groq's dedicated fast endpoint, but not Gemini's: Gemini's
// 120s covers vision plus in-band 429 retries, neither of which applies here
// (openrouter.ts does its own 429 wait, which the backstop below accounts for).
const PROVIDER_TIMEOUT_MS: Record<AIProvider, number> = {
  gemini: 120000,
  groq: 45000,
  nvidia: 75000,
  openrouter: 90000,
}

const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b'

/**
 * Turn a raw provider/SDK error into a short, human-readable reason. The raw
 * errors are giant JSON blobs (429 quota dumps, Groq "request too large", …)
 * that are useless in the UI. This keeps the aggregated failure message clean
 * and actionable — the user should be able to tell a transient rate limit from
 * a genuine misconfiguration at a glance.
 */
function humanizeProviderError(raw: string | undefined): string {
  if (!raw) return 'skipped'
  const m = raw.toLowerCase()
  // Checked before the generic key/quota branches: OpenRouter answers 402 when
  // a *free* model's daily allowance runs out. That is the free tier working as
  // designed, not a broken key and not a bug — say so plainly.
  if (/\b402\b|payment required|insufficient credits|allowance exhausted/.test(m)) {
    return "OpenRouter's free daily allowance is used up — it resets tomorrow, or add credit at openrouter.ai/settings/credits"
  }
  if (/openrouter_api_key is missing/.test(m)) {
    return 'OPENROUTER_API_KEY is not set — add it to .env.local (free key at openrouter.ai/keys)'
  }
  if (/reduce your message size|request too large|context length|maximum context/.test(m)) {
    return 'prompt too large for the free-tier token limit (fewer regions or a shorter prompt may help)'
  }
  if (/\b429\b|too many requests|resource_exhausted|rate.?limit|\bquota\b/.test(m)) {
    return 'free-tier rate limit / quota exceeded — wait ~a minute and retry'
  }
  if (/timed out|timeout|aborted|aborterror/.test(m)) {
    return 'timed out'
  }
  if (/truncat|incomplete/.test(m)) {
    return 'the model returned incomplete output'
  }
  if (/\b401\b|\b403\b|unauthorized|api key|invalid.*key|permission/.test(m)) {
    return 'API key rejected — check the provider credentials'
  }
  if (/\b404\b|\b410\b|decommission|not found|\beol\b|no longer/.test(m)) {
    return 'the selected model is unavailable'
  }
  // Unknown error: surface the first line, capped so the UI stays readable.
  return raw.split('\n')[0].slice(0, 140)
}

export type ProviderName = AIProvider

/**
 * One provider call, with that provider's timeout plus a backstop in case an
 * SDK ignores its own signal. Shared by monolithic and staged generation so
 * timeout and image-attachment behaviour can't drift between them.
 */
export async function callProvider(
  p: ProviderName,
  systemPrompt: string,
  userMessage: string,
  options: { nvidiaModelId?: string; openrouterModelId?: string; imageBase64?: string } = {}
): Promise<string> {
  const {
    nvidiaModelId = DEFAULT_NVIDIA_MODEL,
    openrouterModelId = OPENROUTER_DEFAULT_MODEL,
    imageBase64,
  } = options

  const call = async (): Promise<string> => {
    if (p === 'nvidia') return nvidiaGenerate(systemPrompt, userMessage, nvidiaModelId)
    if (p === 'groq') return groqGenerate(systemPrompt, userMessage)
    // OpenRouter swaps to a vision-capable free model on its own when an image
    // is attached, so the drawing isn't silently dropped.
    if (p === 'openrouter') {
      return openrouterGenerate(systemPrompt, userMessage, openrouterModelId, { imageBase64 })
    }

    const contentParts: Part[] = [{ text: systemPrompt }, { text: userMessage }]
    if (imageBase64) {
      contentParts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } })
    }
    // geminiGenerate retries free-tier 429s (honoring the server's
    // retryDelay) before giving up and letting the chain fall through.
    return geminiGenerate(contentParts, { perAttemptTimeoutMs: PROVIDER_TIMEOUT_MS.gemini })
  }

  // Gemini and OpenRouter both retry through free-tier 429s in-band (honoring
  // the server's delay), so their backstop has to allow for those waits too.
  const backstopMs = p === 'gemini'
    ? PROVIDER_TIMEOUT_MS.gemini + 45000
    : p === 'openrouter'
      ? PROVIDER_TIMEOUT_MS.openrouter + 45000
      : PROVIDER_TIMEOUT_MS[p] + 5000
  return withTimeout(call(), backstopMs, `${p} generation`)
}

/**
 * True only when an OpenRouter key is actually configured. Without it the
 * provider fails instantly, and appending a guaranteed failure to every chain
 * would add noise ("openrouter: key not set") to every existing error message.
 * Server-side only — on the client this env var is undefined, which correctly
 * resolves to "leave it out". The chain is only ever built inside route
 * handlers, so that never changes what actually runs.
 */
function openrouterConfigured(): boolean {
  return typeof process !== 'undefined' && !!process.env.OPENROUTER_API_KEY
}

/**
 * The user's chosen provider first, then the others as fallbacks.
 * OpenRouter goes last when it wasn't the pick: it is the newest of the four
 * and shouldn't displace the known-good Gemini path, but it is worth one more
 * attempt once everything else has failed.
 */
export function buildFallbackChain(provider: ProviderName): ProviderName[] {
  const tail = openrouterConfigured() ? (['openrouter'] as ProviderName[]) : []
  if (provider === 'openrouter') return ['openrouter', 'gemini', 'groq', 'nvidia']
  if (provider === 'nvidia') return ['nvidia', 'gemini', 'groq', ...tail]
  if (provider === 'groq') return ['groq', 'gemini', 'nvidia', ...tail]
  return ['gemini', 'groq', 'nvidia', ...tail]
}

export { humanizeProviderError }

// =============================================================================
// Code Generation — Regions + Prompt → React TSX
// Gemini → Groq → Nvidia fallback chain
// Uses a single monolithic call for <= 12 regions, chunked for > 12.
// A single call is far friendlier to free-tier rate limits than the chunked
// path's burst of calls, so we keep the threshold generous.
// =============================================================================

export async function generateCode(
  regions: Region[],
  userPrompt: string,
  globalTheme?: string,
  provider: ProviderName = 'gemini',
  nvidiaModelId: string = DEFAULT_NVIDIA_MODEL,
  imageBase64?: string,
  groups: RegionGroup[] = []
): Promise<GenerationResponse> {
  const tokens = await resolveDesignTokens(userPrompt)

  // Attach the drawing image whenever the user actually drew something.
  // The image is a visual reference for the character of decorative strokes;
  // region positions remain the source of truth for layout.
  const hasDrawingImage = regions.length > 0 && !!imageBase64

  // Strip the data URL prefix for inlineData
  const rawImageBase64 = imageBase64
    ? imageBase64.replace(/^data:image\/\w+;base64,/, '')
    : undefined

  // Helper to run a specific provider
  // When image is available and provider is Gemini, includes inlineData for vision.
  const runProvider = (p: ProviderName, sysPrompt: string, msg: string, attachImage = false): Promise<string> =>
    callProvider(p, sysPrompt, msg, {
      nvidiaModelId,
      imageBase64: attachImage ? rawImageBase64 : undefined,
    })

  // Fallback chain based on user's selected provider
  const fallbacks = buildFallbackChain(provider)

  // -------------------------------------------------------------------------
  // Monolithic generation path (≤ 12 regions — single call).
  // One call keeps us well under free-tier RPM/TPM limits; the chunked path
  // below fires many calls at once and is what trips 429s on free tiers, so we
  // only fall back to it for genuinely large layouts.
  // -------------------------------------------------------------------------
  if (regions.length <= 12) {
    const userMessage = buildGenerationUserPrompt(regions, userPrompt, tokens, globalTheme, hasDrawingImage, groups)
    const errors: Record<string, string> = {}

    for (const currentProvider of fallbacks) {
      try {
        const responseText = await runProvider(currentProvider, GENERATION_SYSTEM_PROMPT, userMessage, hasDrawingImage)
        const code = repairGeneratedCode(extractReact(responseText))

        if (!code || code.length < 20) throw new Error(`${currentProvider} returned empty response`)
        if (!code.includes('export default')) throw new Error('Generation truncated — output incomplete')

        return { success: true, code, provider: currentProvider }
      } catch (err) {
        errors[currentProvider] = err instanceof Error ? err.message : String(err)
        console.warn(`[AI Gen Monolithic] ${currentProvider} failed:`, errors[currentProvider])
      }
    }
    // Report every provider's failure (selected provider first) so the real
    // root cause is visible instead of only the last fallback's error.
    return { success: false, error: `Generation failed — ${fallbacks.map(p => `${p}: ${humanizeProviderError(errors[p])}`).join(' | ')}` }
  }

  // -------------------------------------------------------------------------
  // Chunked generation path (> 12 regions — for genuinely large layouts)
  // Phase 1: Shell (layout App() + placeholder tags)
  // Phase 2: Component chunks (3 regions each, SERIAL to avoid a rate-limit burst)
  // Phase 3: Assembly (merge imports + inject chunks)
  // -------------------------------------------------------------------------
  console.log(`[AI Gen] Using Chunked Generation for ${regions.length} regions`)

  let shellCode = ''
  let activeProvider = fallbacks[0]
  const shellErrors: Record<string, string> = {}

  // Phase 1: Shell (gets the drawing image so full-page backgrounds
  // and decorative placement can echo the actual strokes)
  const shellMessage = buildShellUserPrompt(regions, userPrompt, tokens, globalTheme, groups)
  let shellSuccess = false

  for (const currentProvider of fallbacks) {
    try {
      const responseText = await runProvider(currentProvider, CHUNKED_SHELL_SYSTEM_PROMPT, shellMessage, hasDrawingImage)
      shellCode = repairGeneratedCode(extractReact(responseText))
      if (!shellCode || shellCode.length < 20) throw new Error('Shell empty')
      if (!shellCode.includes('export default')) throw new Error('Shell truncated')
      activeProvider = currentProvider
      shellSuccess = true
      break
    } catch (err) {
      shellErrors[currentProvider] = err instanceof Error ? err.message : String(err)
      console.warn(`[AI Gen Shell] ${currentProvider} failed:`, shellErrors[currentProvider])
    }
  }

  if (!shellSuccess) {
    return { success: false, error: `Shell generation failed — ${fallbacks.map(p => `${p}: ${humanizeProviderError(shellErrors[p])}`).join(' | ')}` }
  }

  // Phase 2: Chunks — structural regions only; decorative/relational shapes are
  // handled by the shell via the skeleton instructions. Run SERIALLY (not
  // Promise.all): a parallel burst of calls is exactly what trips free-tier
  // rate limits. Try the provider that just built the shell FIRST, so we don't
  // re-hit a provider that already rate-limited us.
  const CHUNK_SIZE = 3
  const structuralRegions = regions.filter(r =>
    !r.classificationTag ||
    r.classificationTag === 'exact-placement' ||
    r.classificationTag === 'approximate-area'
  )
  const chunkTargets = structuralRegions.length > 0 ? structuralRegions : regions

  const chunks: Region[][] = []
  for (let i = 0; i < chunkTargets.length; i += CHUNK_SIZE) {
    chunks.push(chunkTargets.slice(i, i + CHUNK_SIZE))
  }

  const chunkFallbacks: ProviderName[] =
    [activeProvider, ...fallbacks.filter(p => p !== activeProvider)]

  const generatedComponents: string[] = new Array(chunks.length).fill('')

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]
    const chunkMessage = buildChunkUserPrompt(chunk, regions, userPrompt, tokens, globalTheme, groups)

    for (const currentProvider of chunkFallbacks) {
      try {
        const responseText = await runProvider(currentProvider, CHUNKED_REGION_SYSTEM_PROMPT, chunkMessage)
        const chunkCode = extractReact(responseText)
        if (!chunkCode || chunkCode.length < 10) throw new Error(`Chunk ${index} empty`)

        // Kept whole — assembleFile parses and merges each chunk's imports.
        generatedComponents[index] = chunkCode
        break
      } catch (err) {
        console.warn(`[AI Gen Chunk ${index}] ${currentProvider} failed:`, err)
      }
    }
  }

  // Phase 3: Assembly
  const { code: assembledCode, error: assemblyError } = assembleFile(shellCode, generatedComponents)
  if (assemblyError) {
    return { success: false, error: `Could not assemble: ${assemblyError}` }
  }

  // Chunks are generated independently, so their merged imports can collide
  // with names another chunk declared.
  return { success: true, code: repairGeneratedCode(assembledCode), provider: activeProvider }
}

// =============================================================================
// Region Regeneration — Change one region, keep the rest
// =============================================================================

export async function regenerateRegion(
  regionNumber: number,
  userPrompt: string,
  existingCode: string,
  allRegions: Region[],
  provider: ProviderName = 'gemini',
  nvidiaModelId: string = DEFAULT_NVIDIA_MODEL
): Promise<GenerationResponse> {
  const userMessage = buildRegenerateUserPrompt(regionNumber, userPrompt, existingCode, allRegions)

  // Shares callProvider so timeout and provider dispatch can't drift from the
  // generation path (this used to be a hand-rolled if/else that would have
  // routed an unknown provider to Gemini by accident).
  const runProvider = (p: ProviderName): Promise<string> =>
    callProvider(p, REGENERATE_REGION_SYSTEM_PROMPT, userMessage, { nvidiaModelId })

  const fallbacks = buildFallbackChain(provider)

  let lastError = 'Unknown error'

  for (const currentProvider of fallbacks) {
    try {
      const responseText = await runProvider(currentProvider)
      const code = extractReact(responseText)

      if (!code || code.length < 20) {
        throw new Error(`${currentProvider} returned empty or too-short response`)
      }

      return { success: true, code, provider: currentProvider }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[AI Regen] ${currentProvider} failed, trying next fallback:`, lastError)
    }
  }

  console.error('[AI Regen] All providers failed. Last error:', lastError)
  return {
    success: false,
    error: `Regeneration failed — ${humanizeProviderError(lastError)}`,
  }
}

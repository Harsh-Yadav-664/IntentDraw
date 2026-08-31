import { geminiGenerate } from './gemini'
import { groqGenerate } from './groq'
import { nvidiaGenerate } from './nvidia'
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
import type { Region } from '@/types'

// Per-provider hard cap for a single generation call. Above this we give up on
// that provider and let the fallback chain try the next one, so a slow or dead
// upstream can't stall the whole request. Tuned to measured latencies
// (2026-08-30): Gemini vision generation runs ~30-45s and can exceed 60s on a
// real drawing + full prompt, so it gets the most headroom; Groq (gpt-oss-120b)
// answers in ~7s; NVIDIA models are currently slow/EOL, so cap low to fail over.
const PROVIDER_TIMEOUT_MS: Record<'gemini' | 'groq' | 'nvidia', number> = {
  gemini: 120000,
  groq: 45000,
  nvidia: 75000,
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
  provider: 'gemini' | 'groq' | 'nvidia' = 'gemini',
  nvidiaModelId: string = DEFAULT_NVIDIA_MODEL,
  imageBase64?: string
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
  const runProvider = async (p: 'gemini' | 'groq' | 'nvidia', sysPrompt: string, msg: string, attachImage = false): Promise<string> => {
    const call = async (): Promise<string> => {
      if (p === 'nvidia') {
        return nvidiaGenerate(sysPrompt, msg, nvidiaModelId)
      } else if (p === 'groq') {
        return groqGenerate(sysPrompt, msg)
      } else {
        // Build content array — attach image when a drawing exists.
        const contentParts: Part[] = [{ text: sysPrompt }, { text: msg }]
        if (attachImage && rawImageBase64) {
          contentParts.push({
            inlineData: { mimeType: 'image/png', data: rawImageBase64 },
          })
        }
        // geminiGenerate retries free-tier 429s (honoring the server's
        // retryDelay) before giving up and letting the chain fall through.
        return geminiGenerate(contentParts, { perAttemptTimeoutMs: PROVIDER_TIMEOUT_MS.gemini })
      }
    }
    // Backstop in case an SDK ignores its own timeout/signal. Gemini can retry
    // through free-tier 429s (each with a short wait), so give it extra headroom.
    const backstopMs = p === 'gemini'
      ? PROVIDER_TIMEOUT_MS.gemini + 45000
      : PROVIDER_TIMEOUT_MS[p] + 5000
    return withTimeout(call(), backstopMs, `${p} generation`)
  }

  // Fallback chain based on user's selected provider
  const fallbacks: Array<'gemini' | 'groq' | 'nvidia'> =
    provider === 'nvidia' ? ['nvidia', 'gemini', 'groq'] :
    provider === 'groq' ? ['groq', 'gemini', 'nvidia'] :
    ['gemini', 'groq', 'nvidia']

  // -------------------------------------------------------------------------
  // Monolithic generation path (≤ 12 regions — single call).
  // One call keeps us well under free-tier RPM/TPM limits; the chunked path
  // below fires many calls at once and is what trips 429s on free tiers, so we
  // only fall back to it for genuinely large layouts.
  // -------------------------------------------------------------------------
  if (regions.length <= 12) {
    const userMessage = buildGenerationUserPrompt(regions, userPrompt, tokens, globalTheme, hasDrawingImage)
    const errors: Record<string, string> = {}

    for (const currentProvider of fallbacks) {
      try {
        const responseText = await runProvider(currentProvider, GENERATION_SYSTEM_PROMPT, userMessage, hasDrawingImage)
        const code = extractReact(responseText)

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
  const shellMessage = buildShellUserPrompt(regions, userPrompt, tokens, globalTheme)
  let shellSuccess = false

  for (const currentProvider of fallbacks) {
    try {
      const responseText = await runProvider(currentProvider, CHUNKED_SHELL_SYSTEM_PROMPT, shellMessage, hasDrawingImage)
      shellCode = extractReact(responseText)
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

  const chunkFallbacks: Array<'gemini' | 'groq' | 'nvidia'> =
    [activeProvider, ...fallbacks.filter(p => p !== activeProvider)]

  const generatedComponents: string[] = new Array(chunks.length).fill('')
  const allImports = new Set<string>()

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]
    const chunkMessage = buildChunkUserPrompt(chunk, regions, userPrompt, tokens, globalTheme)

    for (const currentProvider of chunkFallbacks) {
      try {
        const responseText = await runProvider(currentProvider, CHUNKED_REGION_SYSTEM_PROMPT, chunkMessage)
        const chunkCode = extractReact(responseText)
        if (!chunkCode || chunkCode.length < 10) throw new Error(`Chunk ${index} empty`)

        const lines = chunkCode.split('\n')
        lines.filter(l => l.trim().startsWith('import ')).forEach(l => allImports.add(l.trim()))

        const componentLines = lines.filter(
          l => !l.trim().startsWith('import ') && !l.trim().startsWith('export default')
        )
        generatedComponents[index] = componentLines.join('\n')
        break
      } catch (err) {
        console.warn(`[AI Gen Chunk ${index}] ${currentProvider} failed:`, err)
      }
    }
  }

  // Phase 3: Assembly
  const shellLines = shellCode.split('\n')
  const finalImports = new Set<string>()
  const nonImportLines: string[] = []

  for (const line of shellLines) {
    if (line.trim().startsWith('import ')) {
      finalImports.add(line.trim())
    } else {
      nonImportLines.push(line)
    }
  }
  for (const imp of allImports) finalImports.add(imp)

  const mergedImports = Array.from(finalImports).join('\n')
  const shellBody = nonImportLines.join('\n')
  const exportIndex = shellBody.indexOf('export default')

  if (exportIndex === -1) {
    return { success: false, error: 'Could not assemble: shell is missing export default' }
  }

  const assembledCode =
    mergedImports + '\n\n' +
    shellBody.substring(0, exportIndex) + '\n\n' +
    generatedComponents.filter(Boolean).join('\n\n') + '\n\n' +
    shellBody.substring(exportIndex)

  return { success: true, code: assembledCode, provider: activeProvider }
}

// =============================================================================
// Region Regeneration — Change one region, keep the rest
// =============================================================================

export async function regenerateRegion(
  regionNumber: number,
  userPrompt: string,
  existingCode: string,
  allRegions: Region[],
  provider: 'gemini' | 'groq' | 'nvidia' = 'gemini',
  nvidiaModelId: string = DEFAULT_NVIDIA_MODEL
): Promise<GenerationResponse> {
  const userMessage = buildRegenerateUserPrompt(regionNumber, userPrompt, existingCode, allRegions)

  const runProvider = async (p: 'gemini' | 'groq' | 'nvidia'): Promise<string> => {
    const call = async (): Promise<string> => {
      if (p === 'nvidia') {
        return nvidiaGenerate(REGENERATE_REGION_SYSTEM_PROMPT, userMessage, nvidiaModelId)
      } else if (p === 'groq') {
        return groqGenerate(REGENERATE_REGION_SYSTEM_PROMPT, userMessage)
      } else {
        return geminiGenerate(
          [{ text: REGENERATE_REGION_SYSTEM_PROMPT }, { text: userMessage }],
          { perAttemptTimeoutMs: PROVIDER_TIMEOUT_MS.gemini }
        )
      }
    }
    const backstopMs = p === 'gemini'
      ? PROVIDER_TIMEOUT_MS.gemini + 45000
      : PROVIDER_TIMEOUT_MS[p] + 5000
    return withTimeout(call(), backstopMs, `${p} regeneration`)
  }

  const fallbacks: Array<'gemini' | 'groq' | 'nvidia'> =
    provider === 'nvidia' ? ['nvidia', 'gemini', 'groq'] :
    provider === 'groq' ? ['groq', 'gemini', 'nvidia'] :
    ['gemini', 'groq', 'nvidia']

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

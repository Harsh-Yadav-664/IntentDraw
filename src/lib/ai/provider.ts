import { getVisionModel, getProModel } from './gemini'
import { groqGenerate } from './groq'
import { nvidiaGenerate } from './nvidia'
import { extractJson, extractReact } from '@/lib/utils'
import type { AnalysisResponse, GenerationResponse } from '@/types'
import {
  VISION_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
  REGENERATE_REGION_SYSTEM_PROMPT,
  CHUNKED_SHELL_SYSTEM_PROMPT,
  CHUNKED_REGION_SYSTEM_PROMPT,
  buildVisionUserPrompt,
  buildGenerationUserPrompt,
  buildRegenerateUserPrompt,
  buildShellUserPrompt,
  buildChunkUserPrompt,
} from './prompts'
import { resolveDesignTokens } from './design-tokens'
import type { Region } from '@/types'

// =============================================================================
// Vision Analysis — Canvas PNG → Shape detection
// =============================================================================

/**
 * Sends canvas image to Gemini Vision for shape detection.
 *
 * Fallback strategy:
 *   Gemini Vision fails → return error with fallback flag.
 *   The CLIENT then uses local canvas data (shapes already known from Zustand)
 *   instead of AI-detected regions. See Phase 3 workflow for this logic.
 *
 * Groq cannot process images, so it's not a viable vision fallback.
 */
export async function analyzeDrawing(
  imageBase64: string,
  additionalContext?: string
): Promise<AnalysisResponse> {
  try {
    const model = getVisionModel()

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const userPrompt = buildVisionUserPrompt(additionalContext)

    const result = await model.generateContent([
      { text: VISION_SYSTEM_PROMPT },
      { text: userPrompt },
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      },
    ])

    const responseText = result.response.text()
    const jsonStr = extractJson(responseText)
    const regions = JSON.parse(jsonStr) as AnalysisResponse['regions']

    if (!Array.isArray(regions)) {
      return { success: false, error: 'AI returned invalid format' }
    }

    return { success: true, regions }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vision analysis failed'
    console.error('[AI Vision]', message)

    if (message.includes('429') || message.includes('quota') || message.includes('rate')) {
      return { success: false, error: 'Rate limit reached. Using local region data instead.' }
    }

    return { success: false, error: `Vision failed: ${message}. Using local region data instead.` }
  }
}

// =============================================================================
// Code Generation — Regions + Prompt → React TSX
// Gemini Pro → Groq → Nvidia fallback chain
// Uses monolithic generation for <= 5 regions, chunked for > 5.
// =============================================================================

export async function generateCode(
  regions: Region[],
  userPrompt: string,
  globalTheme?: string,
  provider: 'gemini' | 'groq' | 'nvidia' = 'gemini',
  nvidiaModelId: string = 'meta/llama-3.1-70b-instruct'
): Promise<GenerationResponse> {
  const tokens = await resolveDesignTokens(userPrompt)

  // Helper to run a specific provider
  const runProvider = async (p: 'gemini' | 'groq' | 'nvidia', sysPrompt: string, msg: string): Promise<string> => {
    if (p === 'nvidia') {
      return nvidiaGenerate(sysPrompt, msg, nvidiaModelId)
    } else if (p === 'groq') {
      return groqGenerate(sysPrompt, msg)
    } else {
      const model = getProModel()
      const result = await model.generateContent([{ text: sysPrompt }, { text: msg }])
      return result.response.text()
    }
  }

  // Fallback chain based on user's selected provider
  const fallbacks: Array<'gemini' | 'groq' | 'nvidia'> =
    provider === 'nvidia' ? ['nvidia', 'gemini', 'groq'] :
    provider === 'groq' ? ['groq', 'gemini', 'nvidia'] :
    ['gemini', 'groq', 'nvidia']

  // -------------------------------------------------------------------------
  // Monolithic generation path (≤ 5 regions — fast, cheap, single call)
  // -------------------------------------------------------------------------
  if (regions.length <= 5) {
    const userMessage = buildGenerationUserPrompt(regions, userPrompt, tokens, globalTheme)
    let lastError = 'Unknown error'

    for (const currentProvider of fallbacks) {
      try {
        const responseText = await runProvider(currentProvider, GENERATION_SYSTEM_PROMPT, userMessage)
        const code = extractReact(responseText)

        if (!code || code.length < 20) throw new Error(`${currentProvider} returned empty response`)
        if (!code.includes('export default')) throw new Error('Generation truncated — output incomplete')

        return { success: true, code, provider: currentProvider }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.warn(`[AI Gen Monolithic] ${currentProvider} failed:`, lastError)
      }
    }
    return { success: false, error: `Generation failed: ${lastError}` }
  }

  // -------------------------------------------------------------------------
  // Chunked generation path (> 5 regions — parallel, scalable)
  // Phase 1: Shell (layout App() + placeholder tags)
  // Phase 2: Component chunks (3 regions per batch, in parallel)
  // Phase 3: Assembly (merge imports + inject chunks)
  // -------------------------------------------------------------------------
  console.log(`[AI Gen] Using Chunked Generation for ${regions.length} regions`)

  let shellCode = ''
  let activeProvider = fallbacks[0]
  let lastError = 'Unknown error'

  // Phase 1: Shell
  const shellMessage = buildShellUserPrompt(regions, userPrompt, tokens, globalTheme)
  let shellSuccess = false

  for (const currentProvider of fallbacks) {
    try {
      const responseText = await runProvider(currentProvider, CHUNKED_SHELL_SYSTEM_PROMPT, shellMessage)
      shellCode = extractReact(responseText)
      if (!shellCode || shellCode.length < 20) throw new Error('Shell empty')
      if (!shellCode.includes('export default')) throw new Error('Shell truncated')
      activeProvider = currentProvider
      shellSuccess = true
      break
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[AI Gen Shell] ${currentProvider} failed:`, lastError)
    }
  }

  if (!shellSuccess) {
    return { success: false, error: `Shell generation failed: ${lastError}` }
  }

  // Phase 2: Chunks (parallel)
  const CHUNK_SIZE = 3
  const chunks: Region[][] = []
  for (let i = 0; i < regions.length; i += CHUNK_SIZE) {
    chunks.push(regions.slice(i, i + CHUNK_SIZE))
  }

  const generatedComponents: string[] = new Array(chunks.length).fill('')
  const allImports = new Set<string>()

  await Promise.all(chunks.map(async (chunk, index) => {
    const chunkMessage = buildChunkUserPrompt(chunk, userPrompt, tokens, globalTheme)

    for (const currentProvider of fallbacks) {
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
  }))

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
  nvidiaModelId: string = 'meta/llama-3.1-70b-instruct'
): Promise<GenerationResponse> {
  const userMessage = buildRegenerateUserPrompt(regionNumber, userPrompt, existingCode, allRegions)

  const runProvider = async (p: 'gemini' | 'groq' | 'nvidia'): Promise<string> => {
    if (p === 'nvidia') {
      return nvidiaGenerate(REGENERATE_REGION_SYSTEM_PROMPT, userMessage, nvidiaModelId)
    } else if (p === 'groq') {
      return groqGenerate(REGENERATE_REGION_SYSTEM_PROMPT, userMessage)
    } else {
      const model = getProModel()
      const result = await model.generateContent([{ text: REGENERATE_REGION_SYSTEM_PROMPT }, { text: userMessage }])
      return result.response.text()
    }
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
    error: 'Regeneration failed. Please check API keys or try again.',
  }
}
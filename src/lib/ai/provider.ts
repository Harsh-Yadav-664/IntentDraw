import { getVisionModel, getProModel } from './gemini'
import { groqGenerate } from './groq'
import { nvidiaGenerate } from './nvidia'
import { extractJson, extractReact } from '@/lib/utils'
import type { AnalysisResponse, GenerationResponse } from '@/types'
import {
  VISION_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
  REGENERATE_REGION_SYSTEM_PROMPT,
  buildVisionUserPrompt,
  buildGenerationUserPrompt,
  buildRegenerateUserPrompt,
} from './prompts'
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
// Code Generation — Regions + Prompt → HTML/CSS
// Gemini Pro → Groq fallback
// =============================================================================

export async function generateCode(
  regions: Region[],
  userPrompt: string,
  globalTheme?: string,
  provider: 'gemini' | 'groq' | 'nvidia' = 'gemini',
  nvidiaModelId: string = 'meta/llama-3.1-70b-instruct'
): Promise<GenerationResponse> {
  const userMessage = buildGenerationUserPrompt(regions, userPrompt, globalTheme)

  // Helper to run a specific provider
  const runProvider = async (p: 'gemini' | 'groq' | 'nvidia', msg: string): Promise<string> => {
    if (p === 'nvidia') {
      return nvidiaGenerate(GENERATION_SYSTEM_PROMPT, msg, nvidiaModelId)
    } else if (p === 'groq') {
      return groqGenerate(GENERATION_SYSTEM_PROMPT, msg)
    } else {
      const model = getProModel()
      const result = await model.generateContent([{ text: GENERATION_SYSTEM_PROMPT }, { text: msg }])
      return result.response.text()
    }
  }

  // Define fallback chain based on selected provider
  const fallbacks: Array<'gemini' | 'groq' | 'nvidia'> = 
    provider === 'nvidia' ? ['nvidia', 'gemini', 'groq'] :
    provider === 'groq' ? ['groq', 'gemini', 'nvidia'] :
    ['gemini', 'groq', 'nvidia']

  let lastError = 'Unknown error'

  for (const currentProvider of fallbacks) {
    try {
      const responseText = await runProvider(currentProvider, userMessage)
      let code = extractReact(responseText)

      if (!code || code.length < 20) {
        throw new Error(`${currentProvider} returned empty or too-short response`)
      }

      // POST-GENERATION CHECK: Verify all regions from drawing exist in code
      if (regions.length > 0) {
        const missingRegions = regions.filter(r => {
          return !code.includes(`Region${r.regionNumber}`) && !code.includes(`locked-r${r.regionNumber}`)
        })

        if (missingRegions.length > 0) {
          console.warn(`[AI Gen] ${currentProvider} missing regions:`, missingRegions.map(r => r.regionNumber))
          
          const missingIds = missingRegions.map(r => `Region${r.regionNumber}`).join(', ')
          const correctionMsg = `${userMessage}\n\nYOUR PREVIOUS OUTPUT:\n\`\`\`tsx\n${code}\n\`\`\`\n\nCRITICAL ERROR: You dropped the following components from the layout skeleton: ${missingIds}. You MUST include ALL RegionX placeholders from the skeleton exactly as provided. Fix the code to include them now.`
          
          const correctedText = await runProvider(currentProvider, correctionMsg)
          const correctedCode = extractReact(correctedText)
          if (correctedCode && correctedCode.length > 20) {
            code = correctedCode
          }
        }
      }

      return { success: true, code, provider: currentProvider }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[AI Gen] ${currentProvider} failed, trying next fallback:`, lastError)
    }
  }

  console.error('[AI Gen] All providers failed. Last error:', lastError)
  return {
    success: false,
    error: 'Generation failed with all AI providers. Please check API keys or try again.',
  }
}

// =============================================================================
// Region Regeneration — Change one region, keep the rest
// Gemini Pro → Groq fallback
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

  // Helper to run a specific provider
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

  // Define fallback chain based on selected provider
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
import { getVisionModel, getProModel } from './gemini'
import { groqGenerate } from './groq'
import { extractJson, extractHtml } from '@/lib/utils'
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
  globalTheme?: string
): Promise<GenerationResponse> {
  const userMessage = buildGenerationUserPrompt(regions, userPrompt, globalTheme)

  // Attempt 1: Gemini Pro
  try {
    const model = getProModel()
    const result = await model.generateContent([
      { text: GENERATION_SYSTEM_PROMPT },
      { text: userMessage },
    ])

    const responseText = result.response.text()
    const code = extractHtml(responseText)

    if (!code || code.length < 20) {
      throw new Error('Gemini returned empty or too-short response')
    }

    return { success: true, code, provider: 'gemini' }
  } catch (geminiError) {
    const geminiMsg = geminiError instanceof Error ? geminiError.message : 'Gemini failed'
    console.warn('[AI Gen] Gemini failed, trying Groq:', geminiMsg)

    // Attempt 2: Groq
    try {
      const responseText = await groqGenerate(GENERATION_SYSTEM_PROMPT, userMessage)
      const code = extractHtml(responseText)

      if (!code || code.length < 20) {
        throw new Error('Groq returned empty or too-short response')
      }

      return { success: true, code, provider: 'groq' }
    } catch (groqError) {
      const groqMsg = groqError instanceof Error ? groqError.message : 'Groq failed'
      console.error('[AI Gen] Both providers failed. Gemini:', geminiMsg, 'Groq:', groqMsg)

      return {
        success: false,
        error: 'Generation failed with both AI providers. Please try again.',
      }
    }
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
  allRegions: Region[]
): Promise<GenerationResponse> {
  const userMessage = buildRegenerateUserPrompt(regionNumber, userPrompt, existingCode, allRegions)

  // Attempt 1: Gemini Pro
  try {
    const model = getProModel()
    const result = await model.generateContent([
      { text: REGENERATE_REGION_SYSTEM_PROMPT },
      { text: userMessage },
    ])

    const responseText = result.response.text()
    const code = extractHtml(responseText)

    if (!code || code.length < 20) {
      throw new Error('Gemini returned empty or too-short response')
    }

    return { success: true, code, provider: 'gemini' }
  } catch (geminiError) {
    const geminiMsg = geminiError instanceof Error ? geminiError.message : 'Gemini failed'
    console.warn('[AI Regen] Gemini failed, trying Groq:', geminiMsg)

    // Attempt 2: Groq
    try {
      const responseText = await groqGenerate(REGENERATE_REGION_SYSTEM_PROMPT, userMessage)
      const code = extractHtml(responseText)

      if (!code || code.length < 20) {
        throw new Error('Groq returned empty or too-short response')
      }

      return { success: true, code, provider: 'groq' }
    } catch (groqError) {
      const groqMsg = groqError instanceof Error ? groqError.message : 'Groq failed'
      console.error('[AI Regen] Both failed. Gemini:', geminiMsg, 'Groq:', groqMsg)

      return {
        success: false,
        error: 'Regeneration failed. Please try again.',
      }
    }
  }
}
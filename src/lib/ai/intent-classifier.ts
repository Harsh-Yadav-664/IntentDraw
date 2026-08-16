import { getVisionModel } from './gemini'
import { extractJson } from '@/lib/utils'

const INTENT_CLASSIFICATION_SYSTEM_PROMPT = `You are a design intent classifier.
You will be provided with an image of a user's rough wireframe drawing, along with their text prompt.
Your job is to determine how the drawing should be interpreted.

There are two possibilities:
1. LITERAL PLACEMENT: The user drew distinct boxes or shapes to represent where specific content sections (like a header, sidebar, cards, or hero section) should be placed.
2. STYLE/PATTERN REFERENCE: The user drew freeform squiggly lines, abstract shapes, or decorative strokes intended as a stylistic input (e.g., "I want a wavy animated background" or "use this as a pattern reference"), and NOT as distinct structural HTML layout blocks. IMPORTANT: Even if the user mentions the word "region" in their prompt (e.g., "region 1 to 7 are a reference for the background"), if the context implies it's for styling/background/aesthetics rather than literal layout boxes, you MUST classify it as a style reference.

Analyze the image and the prompt. Respond ONLY with a valid JSON object matching this schema:
{
  "isStyleReference": boolean,
  "reasoning": "string explaining your decision"
}
`

export async function classifyDrawingIntent(
  imageBase64: string,
  userPrompt: string
): Promise<{ isStyleReference: boolean }> {
  try {
    const model = getVisionModel()
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    
    const promptMessage = `User's prompt: "${userPrompt}"\n\nAnalyze the attached drawing and respond with JSON.`

    const result = await model.generateContent([
      { text: INTENT_CLASSIFICATION_SYSTEM_PROMPT },
      { text: promptMessage },
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      },
    ])

    const responseText = result.response.text()
    const jsonStr = extractJson(responseText)
    const data = JSON.parse(jsonStr)

    // Log the request and response for debugging
    try {
      const fs = require('fs')
      const path = require('path')
      const debugDir = path.join(process.cwd(), '.system_generated')
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(debugDir, 'intent-debug.json'),
        JSON.stringify({
          timestamp: new Date().toISOString(),
          userPrompt,
          rawResponse: responseText,
          parsedData: data,
          imageBase64: `data:image/png;base64,${base64Data}`
        }, null, 2)
      )
    } catch (logErr) {
      console.error('[Intent Classifier] Failed to write debug log:', logErr)
    }

    return {
      isStyleReference: Boolean(data.isStyleReference)
    }
  } catch (error) {
    console.error('[Intent Classifier] Error classifying drawing intent:', error)
    // Safe fallback: assume it's NOT a style reference, so it behaves as it did originally.
  }
}

const REGION_INTENT_SYSTEM_PROMPT = `You are a design intent classifier for individual shapes in a wireframe drawing.
You will be provided with a JSON array of regions (shapes drawn by the user) and the user's text prompt.
Your job is to tag EACH region with one of the following exact strings:
- "exact-placement": The shape is a literal structural box (like a column, header, card) that should dictate the exact grid layout.
- "approximate-area": The shape indicates a general area for content, but the exact grid/flex alignment can be fluid.
- "decorative": The shape is a stylistic element (e.g., a background wave, a decorative blob, a full-bleed background rectangle) that should NOT be forced into the structural DOM grid.
- "relational": The shape indicates a relationship (e.g., an arrow pointing from one thing to another, or a connecting line).

RULES:
1. "arrow" shapes are almost ALWAYS "relational", unless explicitly described as an icon.
2. "freeform" shapes (squiggles, waves) are almost ALWAYS "decorative", unless they clearly enclose content.
3. If a "rectangle" spans the entire canvas and serves as a background, it is "decorative".
4. Standard rectangles/circles for UI elements are "exact-placement" or "approximate-area".
5. Respond ONLY with a valid JSON object mapping region IDs to their tag. Example: {"r1": "exact-placement", "r2": "decorative"}
`

export async function classifyRegionIntents(
  regions: any[],
  userPrompt: string
): Promise<Record<string, 'exact-placement' | 'approximate-area' | 'decorative' | 'relational'>> {
  try {
    const { getProModel } = await import('./gemini')
    const model = getProModel()
    
    // Normalize regions to only include what the LLM needs
    const simplifiedRegions = regions.map(r => ({
      id: r.id,
      regionNumber: r.regionNumber,
      shapeType: r.geometry.type,
      width: r.geometry.width,
      height: r.geometry.height
    }))

    const promptMessage = `User's prompt: "${userPrompt}"\n\nRegions:\n${JSON.stringify(simplifiedRegions, null, 2)}\n\nRespond with JSON.`

    const result = await model.generateContent([
      { text: REGION_INTENT_SYSTEM_PROMPT },
      { text: promptMessage }
    ])

    const responseText = result.response.text()
    const jsonStr = extractJson(responseText)
    const data = JSON.parse(jsonStr)

    // Log the detailed region intent classification
    try {
      const fs = await import('fs')
      const path = await import('path')
      const debugDir = path.join(process.cwd(), '.system_generated')
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(debugDir, 'region-intent-debug.json'),
        JSON.stringify({
          timestamp: new Date().toISOString(),
          userPrompt,
          simplifiedRegions,
          parsedTags: data
        }, null, 2)
      )
    } catch (logErr) {
      console.error('[Intent Classifier] Failed to write detailed debug log:', logErr)
    }

    return data
  } catch (error) {
    console.error('[Intent Classifier] Error classifying region intents:', error)
    // Fallback: treat all as exact-placement
    const fallback: Record<string, any> = {}
    regions.forEach(r => { fallback[r.id] = 'exact-placement' })
    return fallback
  }
}

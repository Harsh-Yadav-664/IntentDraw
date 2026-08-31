import { getVisionModel } from './gemini'
import { extractJson } from '@/lib/utils'
import type { Region } from '@/types'

export type RegionIntentTag = 'exact-placement' | 'approximate-area' | 'decorative' | 'relational'
export type BackgroundScope = 'region' | 'full' | null

export interface RegionIntentResult {
  tags: Record<string, RegionIntentTag>
  backgroundScopes: Record<string, BackgroundScope>
}

const VALID_TAGS: RegionIntentTag[] = ['exact-placement', 'approximate-area', 'decorative', 'relational']

/**
 * Classifies the intent of each drawn region using the drawing image,
 * full spatial data (position + size + canvas dimensions) and the user prompt.
 *
 * Returns per-region tags AND a background scope:
 *   - "region": the decorative element stays confined to where it was drawn
 *     (or behind the structural region it overlaps)
 *   - "full":   only when the shape spans ~the whole canvas or the prompt
 *     explicitly asks for a full-page background
 */
export async function classifyRegionIntents(
  regions: Region[],
  userPrompt: string,
  imageBase64?: string
): Promise<RegionIntentResult> {
  const fallbackTags: Record<string, RegionIntentTag> = {}
  regions.forEach(r => { fallbackTags[r.id] = 'exact-placement' })
  const fallback: RegionIntentResult = { tags: fallbackTags, backgroundScopes: {} }

  if (regions.length === 0) return fallback

  try {
    const model = getVisionModel()

    // Canvas bounds derived from the regions themselves
    const allX = regions.flatMap(r => [r.geometry.x, r.geometry.x + r.geometry.width])
    const allY = regions.flatMap(r => [r.geometry.y, r.geometry.y + r.geometry.height])
    const canvasWidth = Math.max(...allX, 1)
    const canvasHeight = Math.max(...allY, 1)

    const simplifiedRegions = regions.map(r => ({
      id: r.id,
      regionNumber: r.regionNumber,
      shapeType: r.geometry.type,
      x: Math.round(r.geometry.x),
      y: Math.round(r.geometry.y),
      width: Math.round(r.geometry.width),
      height: Math.round(r.geometry.height),
      // Per-region intent label written by the user in the UI, if any
      userIntent: r.intent?.trim() || null,
    }))

    const systemPrompt = `You are a design intent classifier for shapes in a wireframe drawing.
You receive: the user's text prompt, a JSON list of drawn regions with EXACT positions (x, y, width, height in canvas pixels, origin top-left), the canvas size, and (when available) an image of the drawing itself.

Tag EACH region with exactly one of:
- "exact-placement": a literal structural box (header, card, column, section) that should dictate exact grid layout.
- "approximate-area": a general area for content; exact grid alignment can be fluid.
- "decorative": a stylistic element (wave, blob, scribble, background wash) that must NOT become a structural DOM grid cell.
- "relational": indicates a relationship (arrow connecting things, connecting line).

For regions tagged "decorative", ALSO decide a backgroundScope:
- "region": the element stays confined to where it was drawn. If it overlaps a structural region, it belongs behind that region only.
- "full": the element is a background for the ENTIRE page.

RULES:
1. Arrows are almost always "relational" (unless the prompt describes one as an icon to render).
2. Freeform shapes (squiggles, waves, scribbles) are almost always "decorative" — UNLESS the prompt says one encloses/represents content (e.g. "region 3 is the pricing table" and region 3 is that shape).
3. A rectangle/circle is "decorative" ONLY when the prompt clearly says it is background/decoration/pattern, or it spans ~the entire canvas with no content assigned to it.
4. The user's PROMPT WINS over shape heuristics: if the prompt assigns content to a region (by number or obvious position), that region is structural ("exact-placement" or "approximate-area") even if it is freeform.
5. backgroundScope is "full" ONLY when the shape covers ~90%+ of the canvas, OR the prompt explicitly says full page/site/overall background. Otherwise it is "region" — a background drawn in one area stays in that area.
6. A decorative shape overlapping a structural region is that region's local background, not a page background.
7. If a region's userIntent field is set, weight it heavily — it is the user's own description of that shape.

Respond ONLY with valid JSON, no markdown fences:
{
  "tags": { "<region id>": "exact-placement" | "approximate-area" | "decorative" | "relational" },
  "backgroundScopes": { "<region id>": "region" | "full" }
}
Include backgroundScopes ONLY for regions tagged "decorative".`

    const promptMessage = `User's prompt: "${userPrompt}"

Canvas size: ${Math.round(canvasWidth)} x ${Math.round(canvasHeight)} px

Regions (positions in canvas pixels):
${JSON.stringify(simplifiedRegions, null, 2)}

Analyze the attached drawing image together with the positions above, then respond with JSON.`

    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: systemPrompt },
      { text: promptMessage },
    ]
    if (imageBase64) {
      contentParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      })
    }

    const result = await model.generateContent(contentParts, {
      // Fail fast: this is a cheap pre-pass; if it stalls we fall back to
      // 'exact-placement' for every region rather than hanging generation.
      signal: AbortSignal.timeout(45000),
    })
    const responseText = result.response.text()
    const data = JSON.parse(extractJson(responseText))

    // Validate + normalize into the known id space
    const tags: Record<string, RegionIntentTag> = {}
    const backgroundScopes: Record<string, BackgroundScope> = {}
    for (const r of regions) {
      const rawTag = data?.tags?.[r.id]
      tags[r.id] = VALID_TAGS.includes(rawTag) ? rawTag : 'exact-placement'
      if (tags[r.id] === 'decorative') {
        backgroundScopes[r.id] = data?.backgroundScopes?.[r.id] === 'full' ? 'full' : 'region'
      }
    }

    // Debug log (local only)
    try {
      const fs = await import('fs')
      const path = await import('path')
      const debugDir = path.join(process.cwd(), '.system_generated')
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true })
      fs.writeFileSync(
        path.join(debugDir, 'region-intent-debug.json'),
        JSON.stringify({
          timestamp: new Date().toISOString(),
          userPrompt,
          canvas: { width: Math.round(canvasWidth), height: Math.round(canvasHeight) },
          simplifiedRegions,
          parsedTags: tags,
          backgroundScopes,
        }, null, 2)
      )
    } catch (logErr) {
      console.error('[Intent Classifier] Failed to write debug log:', logErr)
    }

    return { tags, backgroundScopes }
  } catch (error) {
    console.error('[Intent Classifier] Error classifying region intents:', error)
    return fallback
  }
}

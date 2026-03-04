import { wrapUserPrompt, sanitizeUserPrompt } from './prompt-rules'
import { describeLayout } from './region-analyzer'
import type { Region } from '@/types'

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

export const VISION_SYSTEM_PROMPT = `You are a layout analysis assistant for IntentDraw.

Analyze the canvas drawing and identify all shapes.

Return ONLY a JSON array:
[
  {
    "regionNumber": 1,
    "boundingBox": { "x": 10, "y": 5, "width": 80, "height": 15 },
    "shapeType": "rectangle",
    "visualDescription": "horizontal rectangle at top"
  }
]

Rules:
- boundingBox values are PERCENTAGES (0-100) of canvas dimensions
- shapeType: "rectangle", "circle", "freeform", "arrow"
- Empty canvas = return []`


export const GENERATION_SYSTEM_PROMPT = `You are an expert web developer creating HTML with Tailwind CSS.

CRITICAL RULES — READ CAREFULLY:

1. LAYOUT MUST MATCH THE DRAWING:
   - If regions are drawn SIDE BY SIDE horizontally → use CSS Grid or Flexbox columns
   - If regions are STACKED vertically → use separate sections/rows
   - The spatial arrangement in the drawing IS the layout structure
   - NEVER put side-by-side drawn regions into a single column

2. MULTI-COLUMN LAYOUTS:
   - Use "grid grid-cols-2", "grid grid-cols-3", "flex gap-4", etc.
   - Example: Two regions side by side = "grid grid-cols-2 gap-6"
   - Example: Three regions in a row = "grid grid-cols-3 gap-4"
   - Example: 70%/30% split = "grid grid-cols-[2fr_1fr] gap-6"

3. RESPONSIVE BEHAVIOR:
   - Desktop-first: design for large screens, then adapt
   - Use "lg:grid-cols-2 grid-cols-1" to stack on mobile
   - Keep multi-column on desktop, stack on mobile

4. SECTION SIZING:
   - Use reasonable padding: py-12, py-16, py-20 (NOT py-64 or min-h-screen everywhere)
   - Hero sections: py-16 lg:py-24 max-h-[80vh] is usually enough
   - Content sections: py-12 lg:py-16
   - Only use min-h-screen if specifically requested

5. CODE QUALITY:
   - ONLY Tailwind utility classes, no custom CSS
   - Output HTML fragment only (no <!DOCTYPE>, <html>, <head>, <body>)
   - Semantic HTML: header, main, section, nav, footer, article
   - Real content, no "Lorem ipsum"

6. VISUAL QUALITY — AVOID AI CLICHÉS:
   - No border-radius > 1rem on large elements
   - No gradient text on gradient backgrounds  
   - Max 2 drop shadow layers
   - Max 4-5 colors total
   - No neon/glow effects unless requested
   - Clean, professional, minimal aesthetic

7. SPECIAL SHAPES:
   - Arrows indicate DIRECTION (for gradients, animations, content flow)
   - Circles might be decorative elements, icons, avatars
   - Freeform shapes = interpret based on user's description

Return ONLY the HTML. No explanations, no code fences.`


export const REGENERATE_REGION_SYSTEM_PROMPT = `You are regenerating ONE specific region of an existing HTML design.

RULES:
1. You receive existing HTML and a region number to regenerate
2. ONLY modify the section for that region number
3. Keep ALL other regions exactly as they are
4. The regenerated region must fit seamlessly (same colors, fonts, spacing style)
5. Use only Tailwind CSS classes

Return the COMPLETE HTML with only the target region changed.
No explanations, no code fences.`


// =============================================================================
// USER PROMPT BUILDERS
// =============================================================================

export function buildVisionUserPrompt(additionalContext?: string): string {
  const base = 'Identify all shapes in this canvas drawing with their positions.'
  
  if (additionalContext) {
    return wrapUserPrompt(`${base}\n\nContext: ${sanitizeUserPrompt(additionalContext)}`)
  }
  return wrapUserPrompt(base)
}

export function buildGenerationUserPrompt(
  regions: Region[],
  userPrompt: string,
  globalTheme?: string
): string {
  const sanitized = sanitizeUserPrompt(userPrompt)
  
  // Get structured layout analysis
  const layoutDescription = describeLayout(regions)
  
  // Build individual region details
  const regionDetails = regions.map(r => {
    const parts = [`Region ${r.regionNumber}: ${r.geometry.type}`]
    if (r.intent) parts.push(`Purpose: "${r.intent}"`)
    return parts.join(' — ')
  }).join('\n')

  const sections: string[] = []

  if (regions.length > 0) {
    sections.push(layoutDescription)
    sections.push(`REGION DETAILS:\n${regionDetails}`)
  } else {
    sections.push('NO DRAWING PROVIDED — Create a complete website based only on the prompt.')
  }

  if (globalTheme) {
    sections.push(`THEME/STYLE: ${globalTheme}`)
  }

  sections.push(`USER REQUEST:\n${sanitized}`)

  // Add explicit layout reminder based on analysis
  if (regions.length > 0) {
    const hasMultiColumnRows = regions.length > 1
    if (hasMultiColumnRows) {
      sections.push(`\nREMINDER: The user drew ${regions.length} regions. Check the LAYOUT STRUCTURE above. If regions are on the same row (same ROW number), put them in a multi-column grid. Do NOT stack everything vertically.`)
    }
  }

  return wrapUserPrompt(sections.join('\n\n'))
}

export function buildRegenerateUserPrompt(
  regionNumber: number,
  userPrompt: string,
  existingCode: string,
  allRegions: Region[]
): string {
  const sanitized = sanitizeUserPrompt(userPrompt)

  const regionList = allRegions.map(r => {
    const marker = r.regionNumber === regionNumber ? ' ← REGENERATE THIS ONE' : ''
    const locked = (r.lockState.layout || r.lockState.style || r.lockState.animation) ? ' [LOCKED]' : ''
    return `Region ${r.regionNumber}: ${r.geometry.type}${locked}${marker}`
  }).join('\n')

  const prompt = `EXISTING HTML:
\`\`\`html
${existingCode}
\`\`\`

REGIONS:
${regionList}

REGENERATE Region ${regionNumber} with this change:
${sanitized}

Return the complete HTML with ONLY Region ${regionNumber} modified.`

  return wrapUserPrompt(prompt)
}
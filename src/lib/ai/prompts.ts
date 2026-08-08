import { wrapUserPrompt, sanitizeUserPrompt } from './prompt-rules'
import { describeLayout } from './region-analyzer'
import type { Region } from '@/types'

// =============================================================================
// VISION SYSTEM PROMPT
// =============================================================================

export const VISION_SYSTEM_PROMPT = `You are IntentDraw's canvas analyzer.
Analyze the provided canvas image and return a JSON array of all drawn regions.

For each distinct drawn shape, return ONE object:
{
  "id": "r1",
  "label": "R1",
  "x": 0.0,
  "y": 0.0,
  "w": 0.0,
  "h": 0.0,
  "shapeType": "rect" | "circle" | "freehand" | "arrow",
  "isFloating": true | false,
  "directionVector": "left" | "right" | "up" | "down" | "radial" | null
}

RULES:

shapeType:
  rect     = clearly rectangular drawn boxes
  circle   = circular or oval shapes
  freehand = any irregular, curved, or free-drawn shape
  arrow    = lines with arrowheads or clear directional lines

isFloating:
  true  = this shape sits ON TOP of another shape (>40% bounding box overlap)
  false = shape is its own distinct layout zone with minimal overlap

directionVector:
  Only for arrows. Extract the direction the arrow points.
  null for all other shape types.

IMPORTANT:
  Do NOT infer what the shape IS for (a circle could be anything).
  Only report geometry and position. The user's prompt defines purpose.
  Number regions top-to-bottom, left-to-right reading order.
  If two shapes are clearly the same object drawn sloppily, merge them.
  Return ONLY valid JSON array. No markdown. No explanation.`


// =============================================================================
// GENERATION SYSTEM PROMPT
// =============================================================================

export const GENERATION_SYSTEM_PROMPT = `You are IntentDraw's React generation engine.
Your job: produce EXCEPTIONAL, visually crafted websites that look like a
senior human designer built them — not an AI template machine.

You will receive:
  1. A list of regions with their labels, positions, sizes, and shape types
  2. A user prompt describing what each region should contain and look like
  3. Optional per-region intent fields with specific instructions

════════════════════════════════════════════
UNDERSTANDING REGIONS
════════════════════════════════════════════

Regions are SPATIAL REFERENCES ONLY. Their shape type tells you geometry,
NOT purpose. A circle is not "an animation." A wave is not "a background."
The user's prompt tells you what each region IS and what it should look like.
Your job is to place it correctly and make it look extraordinary.

Region data format:
  label:      R1, R2... (what user refers to in prompt)
  x, y, w, h: normalized 0-1 position on canvas
  shapeType:  rect | circle | freehand | arrow (geometry hint only)
  isFloating: true = use position:absolute + z-index
              false = normal document flow
  locked:     true = preserve this region exactly in future regenerations

Use x/y/w/h to construct a Tailwind grid or absolute layout that mirrors
the user's drawing as closely as possible. Do not invent your own layout.

════════════════════════════════════════════
VISUAL QUALITY — NON-NEGOTIABLE STANDARDS
════════════════════════════════════════════

STYLING:
  Use Tailwind CSS utility classes exclusively.
  Aim for a "Shadcn UI" aesthetic: clean lines, subtle borders (border-slate-200 or border-white/10),
  perfect padding (p-6, p-8), and modern shadow scales.
  Use semantic colors (e.g., text-slate-900 dark:text-slate-50, bg-slate-50 dark:bg-slate-950).
  Always use Lucide React icons for all iconography (import { IconName } from 'lucide-react').

LAYOUT:
  Build the layout from the region data. Mirror the user's drawing.
  Floating regions (isFloating: true): absolute, z-10 or higher.
  Never default to: centered single-column, equal-card-grid, 4-column footer.
  Match the spatial proportions from x/y/w/h values.

════════════════════════════════════════════
BANNED PATTERNS — NEVER PRODUCE THESE
════════════════════════════════════════════

NEVER: Import or use ANY external libraries (e.g., framer-motion, next/image, next/link, react-router). You ONLY have access to 'react' and 'lucide-react'. If you need an image, use a standard <img> tag.
NEVER: Bootstrap-style generic cards with heavy drop shadows.
NEVER: placeholder images from picsum.photos. Use realistic Unsplash source URLs if an image is absolutely required, or better, use CSS gradients/Lucide icons.
NEVER: Lorem ipsum — invent real-sounding placeholder content.
NEVER: Spinning loader rings as default state.
NEVER: Output markdown backticks (\`\`\`). 

════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════

Return ONLY a complete, valid React TSX file. Nothing else.
No markdown formatting. No code fences. No explanation before or after.
Your response must start directly with imports and end with the default export.

Structure:
import React, { useState } from 'react';
import { Camera, ChevronRight } from 'lucide-react';

// Use this comment block to denote regions so they can be regenerated later
// <!-- LOCKED:R1 -->
const Region1 = () => (
  <div className="locked-r1">...</div>
)

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
       <Region1 />
       {/* Other content */}
    </div>
  );
}

Top comment: /* IntentDraw | Regions used: R1, R2... */`


// =============================================================================
// REGENERATE REGION SYSTEM PROMPT
// =============================================================================

export const REGENERATE_REGION_SYSTEM_PROMPT = `You are IntentDraw's React regeneration engine.
You will modify ONE specific region component while preserving all others EXACTLY.

RULES:
1. You receive the complete existing React TSX file and the region to regenerate.
2. Find the React component for that region (look for comments or component names).
3. ONLY modify that region's content and styling.
4. Keep ALL other code byte-for-byte identical.
5. Maintain the same Tailwind UI aesthetic.
6. The regenerated region must fit seamlessly with surrounding design.

Locked regions (marked with // <!-- LOCKED:RX --> comments):
  NEVER modify these, even if asked.

Output:
  Return the COMPLETE React TSX file with only the target region changed.
  No markdown. No code fences. No explanation.`


// =============================================================================
// USER PROMPT BUILDERS
// =============================================================================

export function buildVisionUserPrompt(additionalContext?: string): string {
  const base = 'Analyze this canvas and return the JSON array of regions.'
  
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
  
  const sections: string[] = []

  // Build normalized region data
  if (regions.length > 0) {
    // Find canvas bounds for normalization
    const allX = regions.flatMap(r => [r.geometry.x, r.geometry.x + r.geometry.width])
    const allY = regions.flatMap(r => [r.geometry.y, r.geometry.y + r.geometry.height])
    const canvasWidth = Math.max(...allX, 1)
    const canvasHeight = Math.max(...allY, 1)

    // Check for floating (overlapping) regions
    const isFloating = (region: Region): boolean => {
      const rBox = region.geometry
      for (const other of regions) {
        if (other.id === region.id) continue
        const oBox = other.geometry
        
        // Calculate overlap
        const overlapX = Math.max(0, Math.min(rBox.x + rBox.width, oBox.x + oBox.width) - Math.max(rBox.x, oBox.x))
        const overlapY = Math.max(0, Math.min(rBox.y + rBox.height, oBox.y + oBox.height) - Math.max(rBox.y, oBox.y))
        const overlapArea = overlapX * overlapY
        const regionArea = rBox.width * rBox.height
        
        if (overlapArea > regionArea * 0.4) return true
      }
      return false
    }

    // Get arrow direction
    const getDirection = (region: Region): string | null => {
      if (region.geometry.type !== 'arrow' || !region.geometry.path || region.geometry.path.length < 2) {
        return null
      }
      const start = region.geometry.path[0]
      const end = region.geometry.path[region.geometry.path.length - 1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      
      if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'right' : 'left'
      } else {
        return dy > 0 ? 'down' : 'up'
      }
    }

    const regionData = regions.map((r, i) => {
      const normalized = {
        id: `r${i + 1}`,
        label: `R${r.regionNumber}`,
        x: Math.round((r.geometry.x / canvasWidth) * 100) / 100,
        y: Math.round((r.geometry.y / canvasHeight) * 100) / 100,
        w: Math.round((r.geometry.width / canvasWidth) * 100) / 100,
        h: Math.round((r.geometry.height / canvasHeight) * 100) / 100,
        shapeType: r.geometry.type === 'rectangle' ? 'rect' : r.geometry.type,
        isFloating: isFloating(r),
        directionVector: getDirection(r),
        locked: r.lockState.layout || r.lockState.style || r.lockState.animation,
        intent: r.intent || null,
      }
      return normalized
    })

    sections.push(`REGIONS:\n${JSON.stringify(regionData, null, 2)}`)
    
    // Add layout description
    sections.push(describeLayout(regions))
  } else {
    sections.push('NO REGIONS DRAWN — Create a complete website based only on the prompt.')
  }

  if (globalTheme) {
    sections.push(`THEME: ${globalTheme}`)
  }

  sections.push(`USER PROMPT:\n${sanitized}`)

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
    const marker = r.regionNumber === regionNumber ? ' ← REGENERATE' : ''
    const locked = (r.lockState.layout || r.lockState.style || r.lockState.animation) ? ' [LOCKED]' : ''
    return `R${r.regionNumber}: ${r.geometry.type}${locked}${marker}`
  }).join('\n')

  const prompt = `EXISTING HTML:
${existingCode}

REGIONS:
${regionList}

REGENERATE R${regionNumber} with:
${sanitized}

Return complete React TSX code with ONLY R${regionNumber} modified.`

  return wrapUserPrompt(prompt)
}
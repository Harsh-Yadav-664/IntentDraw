import { wrapUserPrompt, sanitizeUserPrompt } from './prompt-rules'
import { describeLayout } from './region-analyzer'
import { buildShapePath, describeShapePath, pointBudget } from './shape-path'
import type { Region, RegionGroup } from '@/types'
import type { DesignTokenSet } from './design-tokens'

// =============================================================================
// GENERATION SYSTEM PROMPT
// =============================================================================

export const GENERATION_SYSTEM_PROMPT = `You are IntentDraw's React generation engine.
Your job: produce EXCEPTIONAL, visually crafted websites that look like a
senior human designer built them — not an AI template machine.

You will receive:
  1. A list of regions with positions (as % of the page), sizes, shape types,
     intent tags, and optional user intent notes
  2. A CONCRETE LAYOUT SKELETON that you MUST use
  3. A user prompt describing what each region should contain and look like
  4. Optional design tokens (hard style constraints)

════════════════════════════════════════════
UNDERSTANDING REGIONS & SPATIAL INTENT
════════════════════════════════════════════

Regions are SPATIAL REFERENCES. Their shape type tells you geometry, NOT purpose.
A circle is not "an animation." A wave is not automatically "a background."
The user's prompt and each region's "intent" note define what it IS.

Each region carries a classificationTag:
  - "exact-placement" / "approximate-area": structural — it appears in the
    LAYOUT SKELETON as a <RegionX /> placeholder you must fill.
  - "decorative": NOT a content block. It is a stylistic element. Respect its
    backgroundScope EXACTLY:
      * backgroundScope "region": render it ONLY where it was drawn — as a local
        background/decoration inside the region it overlaps, or confined to its
        drawn position. NEVER stretch it across the whole page.
      * backgroundScope "full": render it as the full-page background layer
        behind all content.
  - "relational": an arrow/connection. Express it as a directional cue,
    connector line, or animated hint — not a content block.

DRAWN STROKES — freeform shapes and arrows:
These regions carry an "svgPath" field: the EXACT stroke the user drew, as an
SVG path in a "0 0 100 100" viewBox. This is real geometry, not a hint.
  - RENDER THE PATH. Never substitute your own generic wave, blob or divider.
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      <path d="<the svgPath value>" fill="none" stroke="currentColor" />
    </svg>
  - The geometry is the user's; the STYLING is yours — stroke weight, gradients,
    glow/blur filters, fill vs stroke, opacity layering. Make it beautiful.
  - A stroke is also a MOTION PATH. When the prompt implies movement, animate it:
    stroke-dashoffset draw-on, a gradient sweeping along the path, slow drift, or
    an element travelling the path via CSS offset-path.
  - Several strokes described as one composite background must share a SINGLE
    full-page svg layer, styled as one coherent system.
  - LAYERING (this is the #1 way background layers silently fail): NEVER put a
    full-page background behind an opaque parent using a negative z-index — the
    parent's own background paints over it and the strokes become invisible.
    Correct pattern: the page wrapper carries NO background colour, the
    background sits in <svg className="absolute inset-0 w-full h-full z-0
    pointer-events-none">, and ALL content goes in a sibling with "relative z-10".
    Put the page's background colour on <body> or on the svg layer itself.

CRITICAL REQUIREMENT - THE SKELETON:
You will be provided with a React/Tailwind LAYOUT SKELETON. This skeleton exactly
mirrors the user's drawing. YOU MUST COPY THIS SKELETON EXACTLY.
Do not invent your own layout or grid. Replace the <RegionX /> placeholders
inside the skeleton with the actual components you build for those regions.

════════════════════════════════════════════
VISUAL QUALITY — NON-NEGOTIABLE STANDARDS
════════════════════════════════════════════

STYLING (ANTI-GENERIC DESIGN PRINCIPLE):
  Use Tailwind CSS utility classes exclusively.
  NEVER default to generic "AI aesthetics" (e.g., soft rounded corners, pale gray backgrounds, generic subtle borders, standard Shadcn UI looks) unless the user specifically asks for a simple minimal look.
  Instead, aim for PREMIUM, BOLD, and UNIQUE designs.
  Use striking typography (tight tracking, large font sizes, contrasting weights).
  Use dramatic spacing, bold background sections, sharp corners, or highly stylized dark modes.
  Edit standard component aesthetics to match the user's explicit or implied intent.
  Always use Lucide React icons for all iconography (import { IconName } from 'lucide-react').

LAYOUT:
  Build the layout STRICTLY from the provided skeleton.
  Never default to: centered single-column, equal-card-grid, 4-column footer, unless the skeleton dictates it.
  STRUCTURAL VARIETY: Avoid generic structural patterns. For example, if you generate a feature grid or list, NEVER use the standard 'icon-square + title + description x3 in a row' pattern unless forced by the skeleton. Vary structural presentation heavily using alternate layouts, asymmetric grids, staggered content, masonry, or numbered lists.
  CONCISENESS: If the skeleton contains many regions (e.g. > 4), prioritize concise component implementations to avoid hitting token limits. Do not generate overly repetitive or unnecessarily verbose code.

════════════════════════════════════════════
MOTION — THE PAGE MUST FEEL ALIVE
════════════════════════════════════════════

A completely static page reads as unfinished. Animate deliberately.
Available: GSAP 3 (global \`gsap\`), MotionPathPlugin, ScrollTrigger, CSS transitions.
Drive GSAP from useEffect — never during render — and always clean up:

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-line', { y: 40, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [])

USE MOTION FOR:
  - Entrance: stagger headline lines and cards in. Never animate everything at once.
  - Scroll: ScrollTrigger reveals, parallax depth, pinned sections.
  - Drawn strokes: animate the user's svgPath — stroke-dashoffset draw-on, a gradient
    travelling the path, or an element following it with MotionPathPlugin.
  - Hover and state changes: transforms and colour shifts on a real easing curve.

RULES:
  - Ease everything (power2/power3/expo). Linear and default easing look cheap.
  - Motion must serve hierarchy — guide the eye, never decorate for its own sake.
  - Honour prefers-reduced-motion.

════════════════════════════════════════════
BANNED PATTERNS — NEVER PRODUCE THESE
════════════════════════════════════════════

NEVER: Import libraries outside the allowed set. You have EXACTLY: 'react', 'lucide-react', and 'gsap' (plus MotionPathPlugin and ScrollTrigger). framer-motion / 'motion' is NOT available and will crash the preview — never import it. No next/image, next/link, react-router. If you need an image, use a standard <img> tag.
NEVER: Bootstrap-style generic cards with heavy drop shadows.
NEVER: placeholder images from picsum.photos. Use realistic Unsplash source URLs if an image is absolutely required, or better, use CSS gradients/Lucide icons.
NEVER: Lorem ipsum — invent real-sounding placeholder content.
NEVER: Spinning loader rings as default state.
NEVER: Output markdown backticks (\`\`\`).
NEVER: Declare a component, const or function with the same name as something you imported. If you import { Sun } from 'lucide-react', you may NOT also write "const Sun = ...". This is a fatal duplicate-declaration error. Pick a distinct name (SunGlyph, SunBadge) or just use the imported icon.

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
       {/* YOUR LAYOUT SKELETON GOES HERE */}
       <Region1 />
       {/* Other content */}
    </div>
  );
}

Top comment: /* IntentDraw | Regions used: R1, R2... */`


// =============================================================================
// CHUNKED GENERATION SYSTEM PROMPTS
// =============================================================================

export const CHUNKED_SHELL_SYSTEM_PROMPT = `You are IntentDraw's React layout generation engine.
Your job is to generate ONLY the main layout shell.

You will receive:
  1. A list of regions
  2. A CONCRETE LAYOUT SKELETON
  3. The user prompt

CRITICAL REQUIREMENTS:
1. Generate the 'export default function App()' exactly as the layout skeleton dictates.
2. For EVERY structural region in the list, use it inside the App component as <RegionX />.
3. YOU MUST NOT define the RegionX components (e.g. do not write 'const Region1 = ...'). Another AI will generate those components.
4. Decorative regions with backgroundScope "full" must be rendered by YOU as a full-page background layer behind everything. Decorative regions with backgroundScope "region" should be placed as absolutely-positioned layers inside the region they overlap (you may leave a placeholder comment for the component generator).

Structure:
import React, { useState } from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
       {/* YOUR LAYOUT SKELETON GOES HERE */}
       <Region1 />
       <Region2 />
    </div>
  );
}
`

export const CHUNKED_REGION_SYSTEM_PROMPT = `You are IntentDraw's React component generation engine.
Your job is to generate ONLY the React components for a specific subset of regions.

You will receive:
  1. The user prompt describing the website
  2. The specific regions you need to build, with their positions, sizes, intent tags and notes
  3. The overall layout skeleton for context

CRITICAL REQUIREMENTS:
1. ONLY generate the React components for the requested regions.
2. DO NOT generate the 'export default function App()' component.
3. Follow the same extreme visual quality and anti-generic design rules (bold, unique, Tailwind).
4. If you need icons, include 'import { IconName } from "lucide-react";' at the top.
5. Respect each region's classificationTag and backgroundScope exactly as described in the region data.

Structure:
import { Camera, Star } from 'lucide-react';

// <!-- CHUNK:R1 -->
const Region1 = () => (
  <section className="...">...</section>
)

// <!-- CHUNK:R2 -->
const Region2 = () => (
  <div className="...">...</div>
)
`

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
5. Maintain the existing premium, bold, and unique Tailwind UI aesthetic. Avoid generic soft UI templates.
6. The regenerated region must fit seamlessly with surrounding design.

Locked regions (marked with // <!-- LOCKED:RX --> comments):
  NEVER modify these, even if asked.

Output:
  Return the COMPLETE React TSX file with only the target region changed.
  No markdown. No code fences. No explanation.`


// =============================================================================
// SHARED HELPERS
// =============================================================================

/** Canvas bounds covering all regions. */
function getCanvasBounds(regions: Region[]): { width: number; height: number } {
  const allX = regions.flatMap(r => [r.geometry.x, r.geometry.x + r.geometry.width])
  const allY = regions.flatMap(r => [r.geometry.y, r.geometry.y + r.geometry.height])
  return {
    width: Math.max(...allX, 1),
    height: Math.max(...allY, 1),
  }
}

/** Normalized region data with explicit percentage units and intent notes. */
function buildRegionData(regions: Region[], groups: RegionGroup[] = []) {
  const groupName = (id?: string | null) =>
    (id && groups.find(g => g.id === id)?.name) || null

  const { width: canvasWidth, height: canvasHeight } = getCanvasBounds(regions)

  // A region is floating if it overlaps another region by >40% of its area
  const isFloating = (region: Region): boolean => {
    const rBox = region.geometry
    for (const other of regions) {
      if (other.id === region.id) continue
      const oBox = other.geometry
      const overlapX = Math.max(0, Math.min(rBox.x + rBox.width, oBox.x + oBox.width) - Math.max(rBox.x, oBox.x))
      const overlapY = Math.max(0, Math.min(rBox.y + rBox.height, oBox.y + oBox.height) - Math.max(rBox.y, oBox.y))
      const overlapArea = overlapX * overlapY
      const regionArea = rBox.width * rBox.height
      if (regionArea > 0 && overlapArea > regionArea * 0.4) return true
    }
    return false
  }

  const budget = pointBudget(regions)

  return regions.map((r, i) => {
    const shape = buildShapePath(r, budget)
    return {
      id: `r${i + 1}`,
      label: `R${r.regionNumber}`,
      // All positions are PERCENTAGES of the page (0-100)
      leftPercent: Math.round((r.geometry.x / canvasWidth) * 100),
      topPercent: Math.round((r.geometry.y / canvasHeight) * 100),
      widthPercent: Math.round((r.geometry.width / canvasWidth) * 100),
      heightPercent: Math.round((r.geometry.height / canvasHeight) * 100),
      shapeType: r.geometry.type === 'rectangle' ? 'rect' : r.geometry.type,
      isFloating: isFloating(r),
      // The literal stroke the user drew, as an SVG `d` in a "0 0 100 100"
      // viewBox. Without this a wave and a straight line look identical.
      svgPath: shape?.d ?? null,
      strokeCharacter: shape ? describeShapePath(shape) : null,
      directionVector: shape?.direction ?? null,
      locked: r.lockState.layout || r.lockState.style || r.lockState.animation,
      // The user's own description of this specific region, if provided
      intent: r.intent?.trim() || null,
      // Set when the user grouped this shape with others — see REGION GROUPS.
      group: groupName(r.groupId),
      classificationTag: r.classificationTag || 'exact-placement',
      backgroundScope: r.classificationTag === 'decorative' ? (r.backgroundScope || 'region') : undefined,
    }
  })
}

function buildTokenSection(tokens: DesignTokenSet): string {
  return `HARD DESIGN CONSTRAINTS (PRESET: ${tokens.name}):
You MUST follow these concrete style tokens exactly. Do NOT use generic fallback classes.
- Border Radius: ${tokens.borderRadius}
- Colors: ${tokens.colorPalette}
- Typography: ${tokens.typography}
- Shadows/Borders: ${tokens.shadowTreatment}
- Special Instructions: ${tokens.specialInstructions || 'None'}

CRITICAL - BANNED CLASSES:
You are explicitly BANNED from using the following Tailwind classes anywhere in your output:
${tokens.bannedClasses.join(', ')}`
}

// =============================================================================
// USER PROMPT BUILDERS
// =============================================================================

export function buildGenerationUserPrompt(
  regions: Region[],
  userPrompt: string,
  tokens: DesignTokenSet,
  globalTheme?: string,
  hasDrawingImage?: boolean,
  groups: RegionGroup[] = []
): string {
  const sanitized = sanitizeUserPrompt(userPrompt)

  const sections: string[] = []

  // Add Design Tokens (Aesthetic Enforcement)
  sections.push(buildTokenSection(tokens))

  // Build normalized region data
  if (regions.length > 0) {
    const { width: canvasWidth, height: canvasHeight } = getCanvasBounds(regions)

    sections.push(`REGIONS (all positions/sizes are PERCENTAGES of the page, 0-100):
${JSON.stringify(buildRegionData(regions, groups), null, 2)}`)

    // Add layout description (skeleton + positioned decorative/relational instructions)
    sections.push(describeLayout(regions, canvasWidth, canvasHeight, groups))
  } else {
    sections.push('NO REGIONS DRAWN — Create a complete website based only on the prompt.')
  }

  // Visual reference instruction when canvas image will be attached
  if (hasDrawingImage) {
    sections.push(`VISUAL REFERENCE IMAGE:
An image of the user's canvas drawing is attached to this request.
Use it to understand the VISUAL CHARACTER of any decorative/freeform shapes
(their curves, flow, density, rhythm, colors) and echo that character in CSS/SVG.
The region positions above remain the source of truth for WHERE things go.
Decorative shapes are NOT literal layout boxes unless their tags say so.`)
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
    const intent = r.intent?.trim() ? ` — "${r.intent.trim()}"` : ''
    return `R${r.regionNumber}: ${r.geometry.type}${locked}${intent}${marker}`
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

export function buildShellUserPrompt(
  regions: Region[],
  userPrompt: string,
  tokens: DesignTokenSet,
  globalTheme?: string,
  groups: RegionGroup[] = []
): string {
  const sanitized = sanitizeUserPrompt(userPrompt)

  const sections: string[] = []

  sections.push(buildTokenSection(tokens))

  if (regions.length > 0) {
    const { width: canvasWidth, height: canvasHeight } = getCanvasBounds(regions)

    sections.push(`REGIONS (all positions/sizes are PERCENTAGES of the page, 0-100):
${JSON.stringify(buildRegionData(regions, groups), null, 2)}`)

    sections.push(describeLayout(regions, canvasWidth, canvasHeight, groups))
  } else {
    sections.push('NO REGIONS DRAWN — Create a complete website based only on the prompt.')
  }

  if (globalTheme) {
    sections.push(`THEME: ${globalTheme}`)
  }

  sections.push(`USER PROMPT:\n${sanitized}`)

  return wrapUserPrompt(sections.join('\n\n'))
}

export function buildChunkUserPrompt(
  regions: Region[],
  allRegions: Region[],
  userPrompt: string,
  tokens: DesignTokenSet,
  globalTheme?: string,
  groups: RegionGroup[] = []
): string {
  const sanitized = sanitizeUserPrompt(userPrompt)

  const sections: string[] = []

  sections.push(buildTokenSection(tokens))

  // Full context: this chunk's regions with geometry + intent,
  // plus the overall skeleton so components know where they live.
  const { width: canvasWidth, height: canvasHeight } = getCanvasBounds(allRegions)

  const chunkData = buildRegionData(allRegions, groups).filter(rd =>
    regions.some(r => `R${r.regionNumber}` === rd.label)
  )

  sections.push(`YOUR REGIONS (positions/sizes are PERCENTAGES of the page, 0-100):
${JSON.stringify(chunkData, null, 2)}`)

  sections.push(`OVERALL LAYOUT (for context — build ONLY your regions above):
${describeLayout(allRegions, canvasWidth, canvasHeight, groups)}`)

  if (globalTheme) {
    sections.push(`THEME: ${globalTheme}`)
  }

  sections.push(`USER PROMPT:\n${sanitized}`)

  return wrapUserPrompt(sections.join('\n\n'))
}

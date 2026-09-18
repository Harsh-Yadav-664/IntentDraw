import type { Region, RegionGroup } from '@/types'
import { buildShapePath, describeShapePath, pointBudget } from './shape-path'

interface LayoutGrid {
  rows: LayoutRow[]
  totalWidth: number
  totalHeight: number
}

interface LayoutRow {
  rowIndex: number
  yStart: number
  yEnd: number
  height: number
  columns: LayoutColumn[]
}

interface LayoutColumn {
  regionNumber: number
  region: Region
  xStart: number
  xEnd: number
  width: number
  widthPercent: number
}

/**
 * Analyzes regions and groups them into a grid-like structure based on spatial positions.
 * Regions at similar Y positions are considered the same "row".
 * Within each row, regions are sorted left-to-right as "columns".
 */
export function analyzeRegionLayout(regions: Region[]): LayoutGrid {
  // Only include structural layout shapes in the rigid grid
  const structuralRegions = regions.filter(r =>
    !r.classificationTag ||
    r.classificationTag === 'exact-placement' ||
    r.classificationTag === 'approximate-area'
  )

  if (structuralRegions.length === 0) {
    return { rows: [], totalWidth: 800, totalHeight: 600 }
  }

  // Find canvas bounds from structural regions
  const allX = structuralRegions.flatMap(r => [r.geometry.x, r.geometry.x + r.geometry.width])
  const allY = structuralRegions.flatMap(r => [r.geometry.y, r.geometry.y + r.geometry.height])
  const totalWidth = Math.max(...allX)
  const totalHeight = Math.max(...allY)

  // Sort regions by Y position (top to bottom)
  const sortedByY = [...structuralRegions].sort((a, b) => a.geometry.y - b.geometry.y)

  // Group into rows based on Y overlap
  const rows: LayoutRow[] = []
  const ROW_THRESHOLD = 50 // Regions within 50px Y are considered same row

  for (const region of sortedByY) {
    const regionTop = region.geometry.y
    const regionBottom = region.geometry.y + region.geometry.height
    const regionCenterY = regionTop + region.geometry.height / 2

    // Find existing row this region belongs to
    const foundRow = rows.find(row => {
      const rowCenterY = (row.yStart + row.yEnd) / 2
      return Math.abs(regionCenterY - rowCenterY) < ROW_THRESHOLD ||
             (regionTop < row.yEnd && regionBottom > row.yStart)
    })

    if (foundRow) {
      // Add to existing row, update bounds
      foundRow.yStart = Math.min(foundRow.yStart, regionTop)
      foundRow.yEnd = Math.max(foundRow.yEnd, regionBottom)
      foundRow.height = foundRow.yEnd - foundRow.yStart
      foundRow.columns.push({
        regionNumber: region.regionNumber,
        region,
        xStart: region.geometry.x,
        xEnd: region.geometry.x + region.geometry.width,
        width: region.geometry.width,
        widthPercent: Math.round((region.geometry.width / totalWidth) * 100)
      })
    } else {
      // Create new row
      rows.push({
        rowIndex: rows.length,
        yStart: regionTop,
        yEnd: regionBottom,
        height: regionBottom - regionTop,
        columns: [{
          regionNumber: region.regionNumber,
          region,
          xStart: region.geometry.x,
          xEnd: region.geometry.x + region.geometry.width,
          width: region.geometry.width,
          widthPercent: Math.round((region.geometry.width / totalWidth) * 100)
        }]
      })
    }
  }

  // Sort columns within each row by X position (left to right)
  for (const row of rows) {
    row.columns.sort((a, b) => a.xStart - b.xStart)
  }

  // Sort rows by Y position
  rows.sort((a, b) => a.yStart - b.yStart)

  // Re-index rows
  rows.forEach((row, i) => row.rowIndex = i)

  return { rows, totalWidth, totalHeight }
}

/**
 * Converts analyzed layout into a concrete TSX layout skeleton for the AI.
 * canvasWidth/canvasHeight are the true drawing bounds, used to position
 * decorative/relational elements in percentages.
 */
export function describeLayout(
  regions: Region[],
  canvasWidth?: number,
  canvasHeight?: number,
  groups: RegionGroup[] = []
): string {
  const grid = analyzeRegionLayout(regions)

  // True canvas bounds: prefer explicit values, fall back to all-region bounds
  const allX = regions.flatMap(r => [r.geometry.x, r.geometry.x + r.geometry.width])
  const allY = regions.flatMap(r => [r.geometry.y, r.geometry.y + r.geometry.height])
  const cw = canvasWidth && canvasWidth > 0 ? canvasWidth : Math.max(...allX, 1)
  const ch = canvasHeight && canvasHeight > 0 ? canvasHeight : Math.max(...allY, 1)

  if (regions.length === 0) {
    return 'NO REGIONS DRAWN — Create a complete website based only on the prompt.'
  }

  const structural = regions.filter(r =>
    !r.classificationTag ||
    r.classificationTag === 'exact-placement' ||
    r.classificationTag === 'approximate-area'
  )
  const decorative = regions.filter(r => r.classificationTag === 'decorative')
  const relational = regions.filter(r => r.classificationTag === 'relational')
  const budget = pointBudget(regions)

  const lines: string[] = []

  // Groups come first: they are the user's own account of what the shapes mean,
  // which should frame everything the model reads afterwards.
  const groupLines = describeGroups(regions, groups, cw, ch)
  if (groupLines.length > 0) lines.push(...groupLines, '')

  if (structural.length > 0) {
    lines.push(`LAYOUT SKELETON:`)
    lines.push(`You MUST use this exact HTML structure. Replace the <RegionX /> placeholders with your generated components based on the user's prompt. Do NOT change the layout flex/grid classes unless absolutely necessary for responsiveness.`)
    lines.push(``)
    lines.push(`\`\`\`tsx`)
    lines.push(`<div className="w-full flex flex-col gap-8">`)

    for (const row of grid.rows) {
      if (row.columns.length === 1) {
        const col = row.columns[0]
        lines.push(`  {/* ROW ${row.rowIndex + 1}: Full width */}`)
        lines.push(`  <div className="w-full">`)
        const note = shapeNote(col.region)
        if (note) lines.push(`    {/* ${note} */}`)
        lines.push(`    <Region${col.regionNumber} />`)
        lines.push(`  </div>`)
      } else {
        lines.push(`  {/* ROW ${row.rowIndex + 1}: ${row.columns.length} columns */}`)
        lines.push(`  <div className="w-full flex flex-col md:flex-row gap-6">`)
        for (const col of row.columns) {
          lines.push(`    <div style={{ flexBasis: '${col.widthPercent}%' }} className="flex-grow">`)
          const note = shapeNote(col.region)
          if (note) lines.push(`      {/* ${note} */}`)
          lines.push(`      <Region${col.regionNumber} />`)
          lines.push(`    </div>`)
        }
        lines.push(`  </div>`)
      }
    }

    lines.push(`</div>`)
    lines.push(`\`\`\``)
    lines.push(``)
  } else {
    lines.push(`NO STRUCTURAL REGIONS — the drawing contains only decorative/relational shapes.`)
    lines.push(`Design the page layout freely from the prompt; the shapes below are stylistic inputs only.`)
    lines.push(``)
  }

  // Special instructions for non-structural shapes — with explicit positions
  if (decorative.length > 0 || relational.length > 0) {
    lines.push('SPECIAL SHAPES / FLOATING ELEMENTS:')
    lines.push('The user drew additional non-structural shapes. DO NOT place these in the grid as content blocks. Render them as absolutely-positioned stylistic elements (SVG/CSS) at the positions described below. Positions are percentages of the page, derived from where the user drew them.')

    if (decorative.length > 0) {
      lines.push(`\nDECORATIVE ELEMENTS:`)

      // Several strokes sweeping across the page are one composed background,
      // not N isolated decorations. Confining each to its own box is the exact
      // opposite of what the user drew.
      const composed =
        decorative.length > 1 &&
        (sharesOneGroup(decorative) || spansCanvas(decorative, cw, ch))

      if (composed) {
        lines.push(`  These ${decorative.length} strokes together form ONE composite background layer — the user drew them as a single flowing backdrop, not as separate confined decorations.`)
        lines.push(`  Render them together inside ONE full-page <svg viewBox="0 0 100 100" preserveAspectRatio="none"> positioned fixed/absolute behind ALL content (lowest z-index), using each stroke's page-space path below.`)
        lines.push(`  Style them as one coherent system (shared palette, gradient, blur or glow as the prompt describes). Do NOT emit them as <RegionX /> content blocks.`)
      }

      for (const r of decorative) {
        const pos = describePosition(r, cw, ch)
        const scope = r.backgroundScope === 'full' ? 'full' : 'region'

        if (composed) {
          lines.push(`  • Stroke from <Region${r.regionNumber} /> (${r.geometry.type}) spanning ${pos}`)
        } else if (scope === 'full') {
          lines.push(`  • <Region${r.regionNumber} /> (Type: ${r.geometry.type}): FULL-PAGE BACKGROUND. The user wants this as the background of the entire page. Render it as a fixed/absolute layer behind ALL content (lowest z-index), spanning the full page. Echo its visual character (colors, curves, texture).`)
        } else {
          const overlap = findStructuralOverlap(r, structural)
          if (overlap) {
            lines.push(`  • <Region${r.regionNumber} /> (Type: ${r.geometry.type}): LOCAL BACKGROUND for <Region${overlap.regionNumber} />. Render it as an absolutely-positioned decorative layer INSIDE/behind Region${overlap.regionNumber} only — NOT a page-wide background. Do not let it bleed into other regions.`)
          } else {
            lines.push(`  • <Region${r.regionNumber} /> (Type: ${r.geometry.type}): LOCAL DECORATION at ${pos}. Render it as an absolutely-positioned decorative element confined to that area only — NOT a page-wide background. It should exist only where the user drew it.`)
          }
        }

        const stroke = composed
          ? describeStroke(r, budget, cw, ch)
          : strokePointer(r, budget)
        if (stroke) lines.push(stroke)

        if (r.intent?.trim()) {
          lines.push(`    User's note for this shape: "${r.intent.trim()}"`)
        }
      }
    }

    if (relational.length > 0) {
      lines.push(`\nRELATIONAL ELEMENTS:`)
      for (const r of relational) {
        const pos = describePosition(r, cw, ch)
        let extra = ''
        if (r.geometry.type === 'arrow') {
          extra = ` It points ${getArrowDirection(r)}.`
        }
        const overlap = findStructuralOverlap(r, structural)
        const relTo = overlap ? ` It connects to / points at <Region${overlap.regionNumber} />.` : ''
        lines.push(`  • <Region${r.regionNumber} /> (Type: ${r.geometry.type}) at ${pos}: indicates a relationship or directional flow.${extra}${relTo} Express it as a subtle directional cue, connector, or animated hint — not a content block.`)
        const stroke = strokePointer(r, budget)
        if (stroke) lines.push(stroke)
        if (r.intent?.trim()) {
          lines.push(`    User's note for this shape: "${r.intent.trim()}"`)
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Renders the user's groups. A group is the user saying "these shapes are one
 * thing" — without it the model sees N unrelated boxes and builds N components.
 */
function describeGroups(
  regions: Region[],
  groups: RegionGroup[],
  canvasWidth: number,
  canvasHeight: number
): string[] {
  const populated = groups
    .map(group => ({ group, members: regions.filter(r => r.groupId === group.id) }))
    .filter(entry => entry.members.length > 0)

  if (populated.length === 0) return []

  const lines = ['REGION GROUPS:']
  lines.push(
    'The user grouped these shapes and described each group as a whole. Build each group as ONE cohesive design element composed of its member shapes — NOT as separate unrelated blocks. The group description below overrides any per-shape assumption.'
  )

  for (const { group, members } of populated) {
    const numbers = members.map(m => `R${m.regionNumber}`).join(', ')
    const bounds = describeBounds(members, canvasWidth, canvasHeight)
    lines.push(`  • "${group.name}" — ${numbers} — occupying ${bounds}`)
    lines.push(
      group.intent.trim()
        ? `    User's description: "${group.intent.trim()}"`
        : `    (no description given — infer this group's purpose from the main prompt)`
    )
  }

  return lines
}

/** Combined extent of several regions, as page percentages. */
function describeBounds(regions: Region[], canvasWidth: number, canvasHeight: number): string {
  const minX = Math.min(...regions.map(r => r.geometry.x))
  const maxX = Math.max(...regions.map(r => r.geometry.x + r.geometry.width))
  const minY = Math.min(...regions.map(r => r.geometry.y))
  const maxY = Math.max(...regions.map(r => r.geometry.y + r.geometry.height))
  const pct = (value: number, total: number) => Math.round((value / total) * 100)
  return `left ~${pct(minX, canvasWidth)}%, top ~${pct(minY, canvasHeight)}%, ~${pct(maxX - minX, canvasWidth)}% wide, ~${pct(maxY - minY, canvasHeight)}% tall`
}

/**
 * The grid skeleton turns every region into a rectangular flex child, which
 * silently discards what the user actually drew. A circle became a plain card.
 */
function shapeNote(region: Region): string | null {
  switch (region.geometry.type) {
    case 'circle':
      return 'the user drew this region as a CIRCLE — give it a circular container (aspect-square rounded-full overflow-hidden) rather than flattening it into a rectangular card'
    case 'freeform':
      return "the user drew this region as a FREEFORM shape — use its svgPath (see region data) to clip or outline it instead of a plain rectangle"
    default:
      return null
  }
}

/** True when every one of these regions belongs to the same group. */
function sharesOneGroup(regions: Region[]): boolean {
  const groupId = regions[0]?.groupId
  return !!groupId && regions.every(r => r.groupId === groupId)
}

/**
 * True when a set of strokes collectively covers most of the canvas. Users draw
 * a "flowing background" as several separate strokes, so judging each one alone
 * against its own bounding box always concludes "small local decoration."
 */
function spansCanvas(regions: Region[], canvasWidth: number, canvasHeight: number): boolean {
  const minX = Math.min(...regions.map(r => r.geometry.x))
  const maxX = Math.max(...regions.map(r => r.geometry.x + r.geometry.width))
  const minY = Math.min(...regions.map(r => r.geometry.y))
  const maxY = Math.max(...regions.map(r => r.geometry.y + r.geometry.height))
  return maxX - minX > canvasWidth * 0.6 && maxY - minY > canvasHeight * 0.6
}

/**
 * Emits the literal drawn stroke as an SVG path. Without this the model only
 * ever sees a bounding box, so every freeform shape looks like a rectangle.
 * Passing canvas dimensions switches the path to whole-page coordinates.
 */
function describeStroke(
  region: Region,
  maxPoints: number,
  canvasWidth: number,
  canvasHeight: number
): string | null {
  const shape = buildShapePath(region, maxPoints, { canvasWidth, canvasHeight })
  if (!shape) return null
  return `    Exact stroke (${describeShapePath(shape)}) in PAGE coordinates — use directly inside the shared full-page svg: d="${shape.d}"`
}

/**
 * The region data block already carries every stroke's `svgPath`, so point at it
 * rather than paying for the same path twice in one prompt.
 */
function strokePointer(region: Region, maxPoints: number): string | null {
  const shape = buildShapePath(region, maxPoints)
  if (!shape) return null
  return `    Render its exact "svgPath" from the region data above — ${describeShapePath(shape)}. Do not substitute a generic shape.`
}

/** Human-readable position of a region as percentages of the canvas. */
function describePosition(region: Region, canvasWidth: number, canvasHeight: number): string {
  const g = region.geometry
  const left = Math.round((g.x / canvasWidth) * 100)
  const top = Math.round((g.y / canvasHeight) * 100)
  const width = Math.round((g.width / canvasWidth) * 100)
  const height = Math.round((g.height / canvasHeight) * 100)
  return `left ~${left}%, top ~${top}%, ~${width}% wide, ~${height}% tall`
}

/** Finds the structural region that best overlaps a non-structural one. */
function findStructuralOverlap(region: Region, structural: Region[]): Region | null {
  const g = region.geometry
  const area = g.width * g.height
  let best: Region | null = null
  let bestOverlap = 0

  for (const s of structural) {
    const sg = s.geometry
    const overlapX = Math.max(0, Math.min(g.x + g.width, sg.x + sg.width) - Math.max(g.x, sg.x))
    const overlapY = Math.max(0, Math.min(g.y + g.height, sg.y + sg.height) - Math.max(g.y, sg.y))
    const overlapArea = overlapX * overlapY
    if (overlapArea > bestOverlap && overlapArea > area * 0.2) {
      bestOverlap = overlapArea
      best = s
    }
  }
  return best
}

function getArrowDirection(region: Region): string {
  if (!region.geometry.path || region.geometry.path.length < 2) return 'unknown'

  const start = region.geometry.path[0]
  const end = region.geometry.path[region.geometry.path.length - 1]
  const dx = end.x - start.x
  const dy = end.y - start.y

  const angle = Math.atan2(dy, dx) * 180 / Math.PI

  if (angle > -22.5 && angle <= 22.5) return 'right (→)'
  if (angle > 22.5 && angle <= 67.5) return 'down-right (↘)'
  if (angle > 67.5 && angle <= 112.5) return 'down (↓)'
  if (angle > 112.5 && angle <= 157.5) return 'down-left (↙)'
  if (angle > 157.5 || angle <= -157.5) return 'left (←)'
  if (angle > -157.5 && angle <= -112.5) return 'up-left (↖)'
  if (angle > -112.5 && angle <= -67.5) return 'up (↑)'
  if (angle > -67.5 && angle <= -22.5) return 'up-right (↗)'

  return 'unknown'
}

/**
 * Finds which regions overlap or are near a specific region.
 * Useful for describing spatial relationships.
 */
export function findNearbyRegions(targetRegion: Region, allRegions: Region[]): {
  above: Region[]
  below: Region[]
  left: Region[]
  right: Region[]
  overlapping: Region[]
} {
  const result = {
    above: [] as Region[],
    below: [] as Region[],
    left: [] as Region[],
    right: [] as Region[],
    overlapping: [] as Region[],
  }

  const target = targetRegion.geometry
  const targetCenterX = target.x + target.width / 2
  const targetCenterY = target.y + target.height / 2

  for (const region of allRegions) {
    if (region.id === targetRegion.id) continue

    const other = region.geometry
    const otherCenterX = other.x + other.width / 2
    const otherCenterY = other.y + other.height / 2

    // Check for overlap
    const overlapsX = target.x < other.x + other.width && target.x + target.width > other.x
    const overlapsY = target.y < other.y + other.height && target.y + target.height > other.y

    if (overlapsX && overlapsY) {
      result.overlapping.push(region)
      continue
    }

    // Determine relative position
    if (otherCenterY < targetCenterY - target.height / 2) {
      result.above.push(region)
    } else if (otherCenterY > targetCenterY + target.height / 2) {
      result.below.push(region)
    }

    if (otherCenterX < targetCenterX - target.width / 2) {
      result.left.push(region)
    } else if (otherCenterX > targetCenterX + target.width / 2) {
      result.right.push(region)
    }
  }

  return result
}

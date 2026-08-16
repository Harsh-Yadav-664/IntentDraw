import type { Region } from '@/types'

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
 */
export function describeLayout(regions: Region[]): string {
  const grid = analyzeRegionLayout(regions)
  
  if (grid.rows.length === 0) {
    return 'NO REGIONS DRAWN — Create a complete website based only on the prompt.'
  }

  const lines: string[] = []
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
      lines.push(`    <Region${col.regionNumber} />`)
      lines.push(`  </div>`)
    } else {
      lines.push(`  {/* ROW ${row.rowIndex + 1}: ${row.columns.length} columns */}`)
      lines.push(`  <div className="w-full flex flex-col md:flex-row gap-6">`)
      for (const col of row.columns) {
        // Using inline style for exact width, or just w-full on mobile
        lines.push(`    <div style={{ flexBasis: '${col.widthPercent}%' }} className="flex-grow">`)
        lines.push(`      <Region${col.regionNumber} />`)
        lines.push(`    </div>`)
      }
      lines.push(`  </div>`)
    }
  }

  lines.push(`</div>`)
  lines.push(`\`\`\``)
  lines.push(``)

  // Add special instructions for non-structural shapes
  const decorative = regions.filter(r => r.classificationTag === 'decorative')
  const relational = regions.filter(r => r.classificationTag === 'relational')

  if (decorative.length > 0 || relational.length > 0) {
    lines.push('SPECIAL SHAPES / FLOATING ELEMENTS:')
    lines.push('The user drew additional non-structural shapes. DO NOT place these in the grid. Render them as floating/absolute stylistic elements or background SVG elements instead.')
    
    if (decorative.length > 0) {
      lines.push(`\nDECORATIVE ELEMENTS:`)
      decorative.forEach(r => {
        lines.push(`  • <Region${r.regionNumber} /> (Type: ${r.geometry.type}): Render as a stylistic decorative element.`)
      })
    }
    
    if (relational.length > 0) {
      lines.push(`\nRELATIONAL ELEMENTS:`)
      relational.forEach(r => {
        let extra = ''
        if (r.geometry.type === 'arrow') {
           extra = ` points ${getArrowDirection(r)}.`
        }
        lines.push(`  • <Region${r.regionNumber} /> (Type: ${r.geometry.type}): Indicates a relationship or connection${extra}`)
      })
    }
    lines.push('')
  }

  return lines.join('\n')
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
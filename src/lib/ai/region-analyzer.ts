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
  if (regions.length === 0) {
    return { rows: [], totalWidth: 800, totalHeight: 600 }
  }

  // Find canvas bounds from regions
  const allX = regions.flatMap(r => [r.geometry.x, r.geometry.x + r.geometry.width])
  const allY = regions.flatMap(r => [r.geometry.y, r.geometry.y + r.geometry.height])
  const totalWidth = Math.max(...allX)
  const totalHeight = Math.max(...allY)

  // Sort regions by Y position (top to bottom)
  const sortedByY = [...regions].sort((a, b) => a.geometry.y - b.geometry.y)

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
 * Converts analyzed layout into a clear text description for the AI.
 */
export function describeLayout(regions: Region[]): string {
  const grid = analyzeRegionLayout(regions)
  
  if (grid.rows.length === 0) {
    return 'No regions drawn. Create a complete page layout based on the prompt.'
  }

  const lines: string[] = []
  lines.push(`LAYOUT STRUCTURE (${grid.rows.length} rows detected from your drawing):`)
  lines.push('')

  for (const row of grid.rows) {
    const rowHeight = Math.round((row.height / grid.totalHeight) * 100)
    
    if (row.columns.length === 1) {
      const col = row.columns[0]
      const r = col.region
      lines.push(`ROW ${row.rowIndex + 1}: Full-width section`)
      lines.push(`  → Region ${col.regionNumber} (${r.geometry.type}): spans full width`)
      if (r.geometry.type === 'arrow' && r.geometry.path && r.geometry.path.length >= 2) {
        const direction = getArrowDirection(r)
        lines.push(`    ↳ Arrow direction: ${direction} (use for gradient/animation direction)`)
      }
    } else {
      lines.push(`ROW ${row.rowIndex + 1}: Multi-column layout (${row.columns.length} columns)`)
      
      // Calculate grid template
      const totalRowWidth = row.columns.reduce((sum, c) => sum + c.width, 0)
      const gridCols = row.columns.map(c => {
        const percent = Math.round((c.width / totalRowWidth) * 100)
        return `${percent}%`
      }).join(' | ')
      
      lines.push(`  → Grid: ${gridCols}`)
      
      for (const col of row.columns) {
        const r = col.region
        const position = col.xStart < totalRowWidth / 3 ? 'left' : 
                        col.xStart > totalRowWidth * 2/3 ? 'right' : 'center'
        lines.push(`  → Region ${col.regionNumber} (${r.geometry.type}): ${position} column, ~${col.widthPercent}% width`)
        if (r.geometry.type === 'arrow' && r.geometry.path && r.geometry.path.length >= 2) {
          const direction = getArrowDirection(r)
          lines.push(`    ↳ Arrow direction: ${direction}`)
        }
      }
    }
    lines.push('')
  }

  // Add special shapes description
  const arrows = regions.filter(r => r.geometry.type === 'arrow')
  const circles = regions.filter(r => r.geometry.type === 'circle')
  const freeforms = regions.filter(r => r.geometry.type === 'freeform')

  if (arrows.length > 0 || circles.length > 0 || freeforms.length > 0) {
    lines.push('SPECIAL SHAPES:')
    if (arrows.length > 0) {
      lines.push(`  • ${arrows.length} arrow(s): Use as directional hints for gradients, animations, or content flow`)
    }
    if (circles.length > 0) {
      lines.push(`  • ${circles.length} circle(s): Could be decorative elements, icons, avatars, or rounded sections`)
    }
    if (freeforms.length > 0) {
      lines.push(`  • ${freeforms.length} freeform shape(s): Interpret based on context (decorative, wave patterns, etc.)`)
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
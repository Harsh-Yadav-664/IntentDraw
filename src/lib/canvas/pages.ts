// =============================================================================
// Canvas page system
// =============================================================================
// One "page" is one screenful at the reference device size. The canvas is
// divided into pages so the user can draw against a real fold, but scrolling
// stays continuous: pages are guides, not hard boundaries.
//
// `pageWidth` MUST equal the preview's logical width (1280) and the drawing
// canvas's BASE_WIDTH — change one and drawn coordinates stop matching the
// preview.
//
// `maxPages` is a plan lever (free capped, paid unlocks more). Everything here
// takes the config as a parameter so a subscription plan object can supply its
// own cap later; do not hardcode the number at call sites.
// =============================================================================

import type { Region } from '@/types'

export interface PageConfig {
  /** Logical width of one page — the desktop viewport width. */
  pageWidth: number
  /** Logical height of one page — the desktop viewport height (the fold). */
  pageHeight: number
  /** Pages created up front so there is room to draw. */
  defaultPages: number
  /** Hard cap on the canvas's page count (plan-dependent later). */
  maxPages: number
}

export const PAGE_CONFIG: PageConfig = {
  pageWidth: 1280,
  pageHeight: 800,
  defaultPages: 3,
  maxPages: 8,
}

/** 0-based page a logical y coordinate falls on, clamped to the cap. */
export function pageIndexForY(y: number, config: PageConfig = PAGE_CONFIG): number {
  if (!Number.isFinite(y) || y <= 0) return 0
  return Math.min(config.maxPages - 1, Math.floor(y / config.pageHeight))
}

/** 0-based page a region starts on, from its top edge (`geometry.y`). */
export function pageIndexForRegion(
  region: Pick<Region, 'geometry'>,
  config: PageConfig = PAGE_CONFIG,
): number {
  return pageIndexForY(region.geometry.y, config)
}

/**
 * How many pages the canvas shows: at least `defaultPages`, enough to hold the
 * lowest shape plus one spare page to keep drawing into, at least what the
 * user explicitly asked for via "Add page" — and never more than `maxPages`.
 *
 * Derived from the drawing only. Never feed this the preview iframe's reported
 * height: `min-h-screen` inside the generated page resolves against the frame,
 * so that would be a runaway resize loop.
 */
export function pageCountFor(
  regions: ReadonlyArray<Pick<Region, 'geometry'>>,
  requestedPages = 0,
  config: PageConfig = PAGE_CONFIG,
): number {
  let lowest = 0
  for (const r of regions) {
    const bottom = r.geometry.y + r.geometry.height
    if (Number.isFinite(bottom) && bottom > lowest) lowest = bottom
  }
  const occupied = Math.ceil(lowest / config.pageHeight)
  const wanted = Math.max(config.defaultPages, occupied > 0 ? occupied + 1 : 0, requestedPages)
  return Math.max(1, Math.min(config.maxPages, wanted))
}

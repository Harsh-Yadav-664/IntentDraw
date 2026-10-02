import { createAdminClient } from '@/lib/supabase/server'
import { withTimeout } from '@/lib/utils'
import { findFont } from '@/lib/design/fonts'
import { normalizeDesign, type SiteDesign } from './site-design'

/**
 * The designs of the user's most recent sites, so a new one can be made
 * deliberately different (understand.ts shows them to the agent, and
 * freshDesign() guarantees the typeface doesn't repeat).
 *
 * Reads only the design out of each saved brief — a JSON path, not the whole
 * canvas — and fails open: a slow or failing lookup must never block or fail a
 * generation, it just means nothing is excluded.
 */

const RECENT_LIMIT = 6
const LOOKUP_TIMEOUT_MS = 3000

/** One of the user's recent sites, as far as making the next one different goes. */
export interface RecentSite {
  design: SiteDesign
  /** The name it used — models drift back to the same few ("Kaelen" twice in a row). */
  brand?: string
  accent?: string
}

/** Keeps only rows whose saved design names a real typeface; normalises the rest of each. */
export function parseRecentDesigns(rows: Array<{ design?: unknown; brand?: unknown; accent?: unknown }>): RecentSite[] {
  const out: RecentSite[] = []
  for (const row of rows) {
    const raw = row.design as Record<string, unknown> | null | undefined
    if (!raw || typeof raw !== 'object' || !findFont(raw.displayFont)) continue
    out.push({
      design: normalizeDesign(raw, '', ''),
      brand: typeof row.brand === 'string' && row.brand.trim() ? row.brand.trim().slice(0, 60) : undefined,
      accent: typeof row.accent === 'string' && /^#[0-9a-f]{3,6}$/i.test(row.accent) ? row.accent : undefined,
    })
  }
  return out
}

export async function recentDesigns(userId: string, excludeProjectId?: string): Promise<RecentSite[]> {
  try {
    let query = createAdminClient()
      .from('projects')
      .select('id, design:canvas_data->pageParts->brief->design, brand:canvas_data->pageParts->brief->>brand, accent:canvas_data->pageParts->brief->palette->>accent')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(RECENT_LIMIT + 1)
    if (excludeProjectId) query = query.neq('id', excludeProjectId)

    const { data, error } = await withTimeout(query, LOOKUP_TIMEOUT_MS, 'recent designs')
    if (error || !Array.isArray(data)) return []
    return parseRecentDesigns(data as Array<{ design?: unknown; brand?: unknown; accent?: unknown }>).slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

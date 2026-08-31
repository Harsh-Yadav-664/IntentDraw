// =============================================================================
// Rate Limiting with Supabase Usage Table
// =============================================================================
// Architecture:
// - Layer 1 (IP-based): Vercel Edge Config / middleware - burst protection
// - Layer 2 (User-based): This module - daily cap from usage table
//
// This implements Layer 2: per-user daily generation limits.
// All AI routes MUST call checkRateLimit() and respect the result.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/server'
import { withTimeout } from '@/lib/utils'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_MAX_GENERATIONS = 10
const MAX_GENERATIONS = parseInt(
  process.env.RATE_LIMIT_MAX_GENERATIONS || String(DEFAULT_MAX_GENERATIONS),
  10
)

// Fail-fast cap on every DB round-trip. If Supabase is paused/unreachable, these
// calls must give up in seconds and fail open — never stall the generation
// request for minutes on a dead connection.
const DB_TIMEOUT_MS = 4000

// =============================================================================
// Types
// =============================================================================

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  used: number
  limit: number
  resetAt: string
}

export interface UsageStats {
  used: number
  limit: number
  remaining: number
  resetAt: string
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the start of tomorrow (midnight UTC) as ISO string.
 * This is when the rate limit resets.
 */
function getResetTime(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ))
  return tomorrow.toISOString()
}

/**
 * Get today's date in YYYY-MM-DD format (UTC).
 */
function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

// =============================================================================
// Rate Limit Check
// =============================================================================

/**
 * Checks if a user is allowed to make an AI generation request.
 *
 * @param userId - The authenticated user's ID
 * @returns RateLimitResult with allowed status and usage info
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  if (!userId || userId === 'anonymous') {
    console.warn('[RateLimit] Anonymous user - allowing request (auth required for tracking)')
    return {
      allowed: true,
      remaining: MAX_GENERATIONS,
      used: 0,
      limit: MAX_GENERATIONS,
      resetAt: getResetTime(),
    }
  }

  try {
    const supabase = createAdminClient()
    const today = getTodayUTC()

    const { data: usage, error } = await withTimeout(
      supabase
        .from('usage')
        .select('generation_count')
        .eq('user_id', userId)
        .eq('date', today)
        .single(),
      DB_TIMEOUT_MS,
      'usage read'
    )

    if (error && error.code !== 'PGRST116') {
      console.error('[RateLimit] Database error:', error)
      return {
        allowed: true,
        remaining: MAX_GENERATIONS,
        used: 0,
        limit: MAX_GENERATIONS,
        resetAt: getResetTime(),
      }
    }

    const currentCount = usage?.generation_count ?? 0
    const remaining = Math.max(0, MAX_GENERATIONS - currentCount)
    const allowed = currentCount < MAX_GENERATIONS

    return {
      allowed,
      remaining,
      used: currentCount,
      limit: MAX_GENERATIONS,
      resetAt: getResetTime(),
    }
  } catch (error) {
    console.error('[RateLimit] Unexpected error:', error)
    return {
      allowed: true,
      remaining: MAX_GENERATIONS,
      used: 0,
      limit: MAX_GENERATIONS,
      resetAt: getResetTime(),
    }
  }
}

// =============================================================================
// Increment Usage
// =============================================================================

/**
 * Increments the generation count for a user.
 * Creates a new usage record if none exists for today.
 *
 * @param userId - The authenticated user's ID
 * @returns The updated usage stats, or null if increment failed
 */
export async function incrementUsage(userId: string): Promise<UsageStats | null> {
  if (!userId || userId === 'anonymous') {
    console.warn('[RateLimit] Cannot track usage for anonymous user')
    return null
  }

  try {
    const supabase = createAdminClient()
    const today = getTodayUTC()

    const { data, error } = await withTimeout(
      supabase.rpc('increment_usage', {
        p_user_id: userId,
        p_max_generations: MAX_GENERATIONS,
      }),
      DB_TIMEOUT_MS,
      'usage increment (rpc)'
    )

    if (error) {
      console.error('[RateLimit] RPC error, falling back to manual upsert:', error)
      return await manualIncrementUsage(userId, today)
    }

    const result = data?.[0]
    if (!result) {
      console.error('[RateLimit] RPC returned no data')
      return await manualIncrementUsage(userId, today)
    }

    return {
      used: result.current_count,
      limit: MAX_GENERATIONS,
      remaining: result.remaining,
      resetAt: getResetTime(),
    }
  } catch (error) {
    console.error('[RateLimit] Unexpected error in incrementUsage:', error)
    return null
  }
}

/**
 * Manual fallback for incrementing usage when RPC is not available.
 * Uses upsert with conflict handling.
 */
async function manualIncrementUsage(userId: string, today: string): Promise<UsageStats | null> {
  try {
    const supabase = createAdminClient()

    const { data: existing } = await withTimeout(
      supabase
        .from('usage')
        .select('id, generation_count')
        .eq('user_id', userId)
        .eq('date', today)
        .single(),
      DB_TIMEOUT_MS,
      'usage read (manual)'
    )

    if (existing) {
      const newCount = existing.generation_count + 1
      const { error: updateError } = await withTimeout(
        supabase
          .from('usage')
          .update({
            generation_count: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id),
        DB_TIMEOUT_MS,
        'usage update (manual)'
      )

      if (updateError) {
        console.error('[RateLimit] Update error:', updateError)
        return null
      }

      return {
        used: newCount,
        limit: MAX_GENERATIONS,
        remaining: Math.max(0, MAX_GENERATIONS - newCount),
        resetAt: getResetTime(),
      }
    } else {
      const { error: insertError } = await withTimeout(
        supabase
          .from('usage')
          .insert({
            user_id: userId,
            date: today,
            generation_count: 1,
          }),
        DB_TIMEOUT_MS,
        'usage insert (manual)'
      )

      if (insertError) {
        if (insertError.code === '23505') {
          return await manualIncrementUsage(userId, today)
        }
        console.error('[RateLimit] Insert error:', insertError)
        return null
      }

      return {
        used: 1,
        limit: MAX_GENERATIONS,
        remaining: MAX_GENERATIONS - 1,
        resetAt: getResetTime(),
      }
    }
  } catch (error) {
    console.error('[RateLimit] Manual increment error:', error)
    return null
  }
}

// =============================================================================
// Get Usage Stats (for UI display)
// =============================================================================

/**
 * Gets the current usage stats for a user.
 * Useful for displaying remaining generations in the UI.
 *
 * @param userId - The authenticated user's ID
 * @returns Current usage stats
 */
export async function getUsageStats(userId: string): Promise<UsageStats> {
  const defaultStats: UsageStats = {
    used: 0,
    limit: MAX_GENERATIONS,
    remaining: MAX_GENERATIONS,
    resetAt: getResetTime(),
  }

  if (!userId || userId === 'anonymous') {
    return defaultStats
  }

  try {
    const supabase = createAdminClient()
    const today = getTodayUTC()

    const { data: usage, error } = await withTimeout(
      supabase
        .from('usage')
        .select('generation_count')
        .eq('user_id', userId)
        .eq('date', today)
        .single(),
      DB_TIMEOUT_MS,
      'usage read'
    )

    if (error && error.code !== 'PGRST116') {
      console.error('[RateLimit] Error fetching usage stats:', error)
      return defaultStats
    }

    const used = usage?.generation_count ?? 0
    return {
      used,
      limit: MAX_GENERATIONS,
      remaining: Math.max(0, MAX_GENERATIONS - used),
      resetAt: getResetTime(),
    }
  } catch (error) {
    console.error('[RateLimit] Unexpected error in getUsageStats:', error)
    return defaultStats
  }
}
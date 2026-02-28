// =============================================================================
// Rate Limiting Stub
// =============================================================================
// Architecture:
// - Layer 1 (IP-based): Vercel/middleware config - burst protection
// - Layer 2 (User-based): This function - daily cap from usage table
//
// Currently a stub - full implementation in Phase 4.
// All AI routes MUST call this and respect the result.
// =============================================================================

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: string
}

/**
 * Checks if a user is allowed to make an AI generation request.
 * Stub implementation - returns allowed for development.
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  // TODO Phase 4: Replace with actual usage table check
  console.warn('[RateLimit] Stub: implement in Phase 4, userId:', userId)
  
  return {
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

/**
 * Increments the generation count for a user.
 * Stub implementation - no-op for development.
 */
export async function incrementUsage(userId: string): Promise<void> {
  // TODO Phase 4: Increment usage count in database
  console.warn('[RateLimit] Stub: increment usage for', userId)
}
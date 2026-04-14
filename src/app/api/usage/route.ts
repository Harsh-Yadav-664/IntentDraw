import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUsageStats } from '@/lib/middleware/rate-limit'

/**
 * GET /api/usage
 * Returns the current user's usage stats for rate limiting display.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: true,
        data: {
          used: 0,
          limit: 10,
          remaining: 10,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          authenticated: false,
        },
      })
    }

    const stats = await getUsageStats(user.id)

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        authenticated: true,
      },
    })
  } catch (error) {
    console.error('[API usage] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch usage stats' },
      { status: 500 }
    )
  }
}
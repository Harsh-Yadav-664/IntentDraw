import { NextResponse } from 'next/server'
import { regenerateRegion } from '@/lib/ai/provider'
import { sanitizeHtml } from '@/lib/utils/sanitize'
import { checkAndIncrementUsage } from '@/lib/middleware/rate-limit'
import { createClient } from '@/lib/supabase/server'
import type { Region } from '@/types'

export async function POST(request: Request) {
  try {
    // --- Auth: get real user ID ---
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const userId = user.id

    // --- Rate limiting: atomic check + increment ---
    const rateLimit = await checkAndIncrementUsage(userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Daily limit reached (${rateLimit.limit} generations). Resets at ${new Date(rateLimit.resetAt).toLocaleTimeString()}.`,
          remaining: 0,
          resetAt: rateLimit.resetAt,
        },
        { status: 429 }
      )
    }

    // --- Parse body ---
    const body = await request.json()
    const { regionNumber, prompt, existingCode, regions } = body as {
      regionNumber?: number
      prompt?: string
      existingCode?: string
      regions?: Region[]
    }

    // --- Input validation ---
    if (!regionNumber || typeof regionNumber !== 'number') {
      return NextResponse.json(
        { success: false, error: 'regionNumber is required' },
        { status: 400 }
      )
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!existingCode || typeof existingCode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Existing code is required for region regeneration' },
        { status: 400 }
      )
    }

    if (!Array.isArray(regions) || regions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Regions array is required' },
        { status: 400 }
      )
    }

    if (prompt.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Prompt too long. Max 5000 characters.' },
        { status: 400 }
      )
    }

    console.log(`[Regenerate] user=${userId} | region=${regionNumber} | prompt: "${prompt.substring(0, 100)}..."`)

    // --- Call AI ---
    const result = await regenerateRegion(
      regionNumber,
      prompt.trim(),
      existingCode,
      regions
    )

    if (!result.success || !result.code) {
      return NextResponse.json(
        { success: false, error: result.error || 'Regeneration failed' },
        { status: 502 }
      )
    }

    const sanitizedCode = sanitizeHtml(result.code)

    return NextResponse.json({
      success: true,
      data: {
        code: sanitizedCode,
        provider: result.provider,
        usage: {
          remaining: rateLimit.remaining,
          used: rateLimit.used,
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt,
        },
      },
    })
  } catch (error) {
    console.error('[API regenerate-region]', error)
    return NextResponse.json(
      { success: false, error: 'Regeneration failed. Please try again.' },
      { status: 500 }
    )
  }
}
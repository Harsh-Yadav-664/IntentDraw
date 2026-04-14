import { NextResponse } from 'next/server'
import { generateCode } from '@/lib/ai/provider'
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
    // Uses checkAndIncrementUsage so we reserve the slot before calling AI
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
    const { regions, prompt, globalTheme } = body as {
      regions?: Region[]
      prompt?: string
      globalTheme?: string
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (prompt.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Prompt too long. Max 10000 characters.' },
        { status: 400 }
      )
    }

    const validRegions = Array.isArray(regions) ? regions : []

    console.log(`[Generate] user=${userId} | ${validRegions.length} regions | prompt: "${prompt.substring(0, 100)}..."`)

    // --- Call AI ---
    const result = await generateCode(validRegions, prompt.trim(), globalTheme)

    if (!result.success || !result.code) {
      return NextResponse.json(
        { success: false, error: result.error || 'Generation failed' },
        { status: 502 }
      )
    }

    const sanitizedCode = sanitizeHtml(result.code)

    return NextResponse.json({
      success: true,
      data: {
        code: sanitizedCode,
        provider: result.provider,
        // Return usage info so UI can show remaining count
        usage: {
          remaining: rateLimit.remaining,
          used: rateLimit.used,
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt,
        },
      },
    })
  } catch (error) {
    console.error('[API generate]', error)
    return NextResponse.json(
      { success: false, error: 'Generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
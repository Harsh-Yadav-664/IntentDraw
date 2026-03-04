import { NextResponse } from 'next/server'
import { regenerateRegion } from '@/lib/ai/provider'
import { sanitizeHtml } from '@/lib/utils/sanitize'
import { checkRateLimit, incrementUsage } from '@/lib/middleware/rate-limit'
import type { Region } from '@/types'

export async function POST(request: Request) {
  try {
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

    // --- Rate limiting ---
    const rateLimit = await checkRateLimit('anonymous')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit reached. Try again tomorrow.' },
        { status: 429 }
      )
    }

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

    // --- Sanitize ---
    const sanitizedCode = sanitizeHtml(result.code)

    // --- Track usage ---
    await incrementUsage('anonymous')

    return NextResponse.json({
      success: true,
      data: {
        code: sanitizedCode,
        provider: result.provider,
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
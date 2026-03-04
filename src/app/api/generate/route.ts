import { NextResponse } from 'next/server'
import { generateCode } from '@/lib/ai/provider'
import { sanitizeHtml } from '@/lib/utils/sanitize'
import { checkRateLimit, incrementUsage } from '@/lib/middleware/rate-limit'
import type { Region } from '@/types'

export async function POST(request: Request) {
  try {
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

    const rateLimit = await checkRateLimit('anonymous')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Rate limit reached. Resets tomorrow.`, remaining: rateLimit.remaining },
        { status: 429 }
      )
    }

    // Log the layout being sent (helpful for debugging)
    console.log(`[Generate] ${validRegions.length} regions, prompt: "${prompt.substring(0, 100)}..."`)

    const result = await generateCode(validRegions, prompt.trim(), globalTheme)

    if (!result.success || !result.code) {
      return NextResponse.json(
        { success: false, error: result.error || 'Generation failed' },
        { status: 502 }
      )
    }

    const sanitizedCode = sanitizeHtml(result.code)

    await incrementUsage('anonymous')

    return NextResponse.json({
      success: true,
      data: { code: sanitizedCode, provider: result.provider },
    })
  } catch (error) {
    console.error('[API generate]', error)
    return NextResponse.json(
      { success: false, error: 'Generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
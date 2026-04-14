import { NextResponse } from 'next/server'
import { analyzeDrawing } from '@/lib/ai/provider'
import { checkRateLimit } from '@/lib/middleware/rate-limit'
import { createClient } from '@/lib/supabase/server'

// Max payload size: ~5MB for canvas PNG
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

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

    // --- Rate limiting ---
    // analyze-drawing does NOT count against generation limit
    // (it's a read operation, not a generation)
    // But we still check auth above so anonymous users can't use it
    const rateLimit = await checkRateLimit(userId)
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

    const body = await request.json()
    const { imageData } = body as { imageData?: string }

    // --- Input validation ---
    if (!imageData || typeof imageData !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid imageData' },
        { status: 400 }
      )
    }

    if (imageData.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Image too large. Max 5MB.' },
        { status: 400 }
      )
    }

    if (!imageData.startsWith('data:image/') && !/^[A-Za-z0-9+/=]+$/.test(imageData.slice(0, 100))) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format' },
        { status: 400 }
      )
    }

    // --- Call AI ---
    const result = await analyzeDrawing(imageData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { regions: result.regions },
    })
  } catch (error) {
    console.error('[API analyze-drawing]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze drawing. Please try again.' },
      { status: 500 }
    )
  }
}
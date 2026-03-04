import { NextResponse } from 'next/server'
import { analyzeDrawing } from '@/lib/ai/provider'
import { checkRateLimit } from '@/lib/middleware/rate-limit'

// Max payload size: ~5MB for canvas PNG
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { imageData } = body as { imageData?: string }

    // --- Input validation ---
    if (!imageData || typeof imageData !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid imageData' },
        { status: 400 }
      )
    }

    // Check approximate size (base64 is ~33% larger than binary)
    if (imageData.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Image too large. Max 5MB.' },
        { status: 400 }
      )
    }

    // Must look like a base64 data URL or raw base64
    if (!imageData.startsWith('data:image/') && !/^[A-Za-z0-9+/=]+$/.test(imageData.slice(0, 100))) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format' },
        { status: 400 }
      )
    }

    // --- Rate limiting (stub for now, enforced in Phase 4) ---
    const rateLimit = await checkRateLimit('anonymous')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Rate limit reached. Resets at ${rateLimit.resetAt}` },
        { status: 429 }
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
    // Don't leak internal errors to client
    console.error('[API analyze-drawing]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze drawing. Please try again.' },
      { status: 500 }
    )
  }
}
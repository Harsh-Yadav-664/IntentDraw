import { NextResponse } from 'next/server'
import { generateCode } from '@/lib/ai/provider'
import { sanitizeHtml } from '@/lib/utils/sanitize'
import { checkAndIncrementUsage } from '@/lib/middleware/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { classifyDrawingIntent } from '@/lib/ai/intent-classifier'
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
    const { regions, prompt, globalTheme, provider, nvidiaModelId, imageData } = body as {
      regions?: Region[]
      prompt?: string
      globalTheme?: string
      provider?: 'gemini' | 'groq' | 'nvidia'
      nvidiaModelId?: string
      imageData?: string
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

    let validRegions = Array.isArray(regions) ? regions : []
    let finalPrompt = prompt.trim()

      // Phase 10: Intent Classification per Region
      console.log(`[Generate] Running region intent classification for user=${userId}`)
      
      const { classifyRegionIntents } = await import('@/lib/ai/intent-classifier')
      const regionTags = await classifyRegionIntents(validRegions, finalPrompt)
      
      validRegions = validRegions.map(r => ({
        ...r,
        classificationTag: regionTags[r.id] || 'exact-placement'
      }))
      
      const tagsCounts = validRegions.reduce((acc, r) => {
        acc[r.classificationTag!] = (acc[r.classificationTag!] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      console.log(`[Generate] Region tags:`, tagsCounts)
      
      // If ALL regions are decorative, it's a pure style reference
      if (validRegions.every(r => r.classificationTag === 'decorative')) {
         console.log(`[Generate] Entire drawing classified as style reference.`)
         finalPrompt += `\n\n(Note: The user provided a drawing as a style/pattern/background reference. Do not treat the strokes as literal layout boundaries, but rather as aesthetic inspiration.)`
      }

    console.log(`[Generate] user=${userId} | ${validRegions.length} regions | prompt: "${finalPrompt.substring(0, 100)}..."`)

    // --- Call AI ---
    const result = await generateCode(validRegions, finalPrompt, globalTheme, provider, nvidiaModelId)

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
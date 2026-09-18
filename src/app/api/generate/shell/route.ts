import { NextResponse } from 'next/server'
import { checkRateLimit, getUsageStats, incrementUsage } from '@/lib/middleware/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { resolveDesignTokens } from '@/lib/ai/design-tokens'
import { generateShellStage } from '@/lib/ai/staged'
import type { AIProvider, Region, RegionGroup } from '@/types'

/**
 * Stage 1 of a staged generation: resolve design tokens, classify the drawing,
 * and build the page shell plus the list of sections still to generate.
 *
 * This consumes the generation's single quota slot — the section calls that
 * follow are part of the same generation and must not be charged again.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const userId = user.id

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
    const { regions, groups, prompt, globalTheme, provider, nvidiaModelId, imageData } = body as {
      regions?: Region[]
      groups?: RegionGroup[]
      prompt?: string
      globalTheme?: string
      provider?: AIProvider
      nvidiaModelId?: string
      imageData?: string
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 })
    }
    if (prompt.length > 10000) {
      return NextResponse.json({ success: false, error: 'Prompt too long. Max 10000 characters.' }, { status: 400 })
    }

    let validRegions = Array.isArray(regions) ? regions : []
    const validGroups = Array.isArray(groups) ? groups : []
    let finalPrompt = prompt.trim()

    // Intent classification only when there is a drawing — text-only prompts
    // skip it entirely and spend no extra model call.
    if (validRegions.length > 0) {
      const { classifyRegionIntents } = await import('@/lib/ai/intent-classifier')
      const { tags, backgroundScopes } = await classifyRegionIntents(validRegions, finalPrompt, imageData)

      validRegions = validRegions.map(r => ({
        ...r,
        classificationTag: tags[r.id] || 'exact-placement',
        backgroundScope: backgroundScopes[r.id] ?? undefined,
      }))

      if (validRegions.every(r => r.classificationTag === 'decorative')) {
        finalPrompt += `\n\n(Note: The user provided a drawing as a style/pattern/background reference. Do not treat the strokes as literal layout boundaries — use them as aesthetic inspiration, respecting each element's described scope.)`
      }
    }

    const tokens = await resolveDesignTokens(finalPrompt)

    const result = await generateShellStage(
      {
        regions: validRegions,
        groups: validGroups,
        prompt: finalPrompt,
        tokens,
        globalTheme,
        provider: provider ?? 'gemini',
        nvidiaModelId,
      },
      imageData
    )

    if (!result.success || !result.shellCode) {
      return NextResponse.json({ success: false, error: result.error ?? 'Shell generation failed' }, { status: 502 })
    }

    await incrementUsage(userId)
    const usage = await getUsageStats(userId)

    return NextResponse.json({
      success: true,
      data: {
        shellCode: result.shellCode,
        sections: result.sections ?? [],
        batches: result.batches ?? [],
        provider: result.provider,
        // Echoed so the section calls reuse the same resolved context without
        // re-running classification or token resolution.
        tokenId: tokens.id,
        regions: validRegions,
        prompt: finalPrompt,
        usage: {
          remaining: usage.remaining,
          used: usage.used,
          limit: usage.limit,
          resetAt: usage.resetAt,
        },
      },
    })
  } catch (error) {
    console.error('[API generate/shell]', error)
    return NextResponse.json({ success: false, error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}

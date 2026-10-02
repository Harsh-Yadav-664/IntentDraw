import { NextResponse } from 'next/server'
import { checkRateLimit, getUsageStats, incrementUsage } from '@/lib/middleware/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { designTokens } from '@/lib/ai/site-design'
import { recentDesigns } from '@/lib/ai/recent-designs'
import { applyBriefToRegions, normalizeBrief } from '@/lib/ai/brief'
import { understandRequest } from '@/lib/ai/understand'
import { generateShellStage } from '@/lib/ai/staged'
import type { AIProvider, Region, RegionGroup } from '@/types'

// Model calls here run 20-70s (Gemini thinks before it answers). Vercel caps a
// function at its plan's limit; this asks for the most the plan allows.
export const maxDuration = 300

/**
 * Stage 1 of a staged generation: build the page shell plus the list of
 * sections still to generate, from the brief the understanding stage wrote.
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
    const { regions, groups, prompt, globalTheme, provider, nvidiaModelId, imageData, brief: sentBrief } = body as {
      regions?: Region[]
      groups?: RegionGroup[]
      prompt?: string
      globalTheme?: string
      provider?: AIProvider
      nvidiaModelId?: string
      imageData?: string
      brief?: unknown
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 })
    }
    if (prompt.length > 10000) {
      return NextResponse.json({ success: false, error: 'Prompt too long. Max 10000 characters.' }, { status: 400 })
    }

    const rawRegions = Array.isArray(regions) ? regions : []
    const validGroups = Array.isArray(groups) ? groups : []
    const finalPrompt = prompt.trim()

    // The brief normally arrives from the understanding stage. It crossed the
    // client, so it is re-validated rather than trusted. A caller that skipped
    // that stage gets it run here instead.
    const brief = sentBrief
      ? normalizeBrief(sentBrief, rawRegions, finalPrompt)
      : await understandRequest({
          prompt: finalPrompt,
          regions: rawRegions,
          groups: validGroups,
          provider: provider ?? 'gemini',
          nvidiaModelId,
          imageBase64: imageData,
          recentDesigns: await recentDesigns(userId),
        })

    const validRegions = applyBriefToRegions(rawRegions, brief)
    // This site's own visual system, not one of a fixed set of themes.
    const tokens = designTokens(brief.design, brief.styleId)

    const result = await generateShellStage(
      {
        regions: validRegions,
        groups: validGroups,
        prompt: finalPrompt,
        tokens,
        globalTheme,
        provider: provider ?? 'gemini',
        nvidiaModelId,
        brief,
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
        sceneCode: result.sceneCode ?? null,
        sections: result.sections ?? [],
        batches: result.batches ?? [],
        provider: result.provider,
        // Echoed so the section calls reuse the same resolved context without
        // re-running classification or token resolution.
        tokenId: tokens.id,
        regions: validRegions,
        prompt: finalPrompt,
        brief,
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

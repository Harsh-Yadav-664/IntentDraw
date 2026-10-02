import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/middleware/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { applyBriefToRegions } from '@/lib/ai/brief'
import { understandRequest } from '@/lib/ai/understand'
import { recentDesigns } from '@/lib/ai/recent-designs'
import type { AIProvider, Region, RegionGroup } from '@/types'

// Model calls here run 20-70s (Gemini thinks before it answers). Vercel caps a
// function at its plan's limit; this asks for the most the plan allows.
export const maxDuration = 300

/**
 * Stage 0 of a generation: work out what the user wants before building it.
 *
 * Its own request rather than a prefix of the shell call for two reasons: the
 * user sees what was understood ~15s in instead of after the whole shell, and
 * each serverless request stays short. It reads the quota but doesn't consume
 * it — the shell call does — so a user at their limit finds out immediately
 * instead of after spending a model call on a brief they can't use.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Daily limit reached (${rateLimit.limit} generations). Resets at ${new Date(rateLimit.resetAt).toLocaleTimeString()}.`,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { regions, groups, prompt, provider, nvidiaModelId, imageData, projectId } = body as {
      regions?: Region[]
      groups?: RegionGroup[]
      prompt?: string
      provider?: AIProvider
      nvidiaModelId?: string
      imageData?: string
      projectId?: string
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 })
    }
    if (prompt.length > 10000) {
      return NextResponse.json({ success: false, error: 'Prompt too long. Max 10000 characters.' }, { status: 400 })
    }

    const validRegions = Array.isArray(regions) ? regions : []
    const brief = await understandRequest({
      prompt: prompt.trim(),
      regions: validRegions,
      groups: Array.isArray(groups) ? groups : [],
      provider: provider ?? 'gemini',
      nvidiaModelId,
      imageBase64: imageData,
      // Other projects only: regenerating this one may keep its own look.
      recentDesigns: await recentDesigns(
        user.id,
        typeof projectId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId) ? projectId : undefined
      ),
    })

    return NextResponse.json({
      success: true,
      data: { brief, regions: applyBriefToRegions(validRegions, brief) },
    })
  } catch (error) {
    console.error('[API generate/understand]', error)
    return NextResponse.json({ success: false, error: 'Could not read the request. Please try again.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRESETS } from '@/lib/ai/design-tokens'
import { generateSectionStage } from '@/lib/ai/staged'
import { normalizeBrief } from '@/lib/ai/brief'
import type { AIProvider, Region, RegionGroup } from '@/types'

const MAX_SHELL_CHARS = 40000

/**
 * Stage 2 of a staged generation: build one batch of section components.
 *
 * Deliberately does NOT touch the rate limiter — the shell call already consumed
 * this generation's quota slot, and charging per section would punish the user
 * for a design that happens to have more sections.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const body = await request.json()
    const { regions, groups, prompt, globalTheme, provider, nvidiaModelId, sectionNames, shellCode, tokenId, brief } =
      body as {
        brief?: unknown
        regions?: Region[]
        groups?: RegionGroup[]
        prompt?: string
        globalTheme?: string
        provider?: AIProvider
        nvidiaModelId?: string
        sectionNames?: string[]
        shellCode?: string
        tokenId?: string
      }

    if (!Array.isArray(sectionNames) || sectionNames.length === 0) {
      return NextResponse.json({ success: false, error: 'sectionNames is required' }, { status: 400 })
    }
    if (!shellCode || typeof shellCode !== 'string') {
      return NextResponse.json({ success: false, error: 'shellCode is required' }, { status: 400 })
    }
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 })
    }

    // The client round-trips only a preset id, never a token object, so nothing
    // arbitrary can be injected into the prompt's style constraints.
    const tokens = (tokenId && PRESETS[tokenId]) || PRESETS.neosleek

    const validRegions = Array.isArray(regions) ? regions : []

    const result = await generateSectionStage(
      {
        regions: validRegions,
        groups: Array.isArray(groups) ? groups : [],
        prompt,
        tokens,
        globalTheme,
        provider: provider ?? 'gemini',
        nvidiaModelId,
        // Re-validated: it came back through the client.
        brief: brief ? normalizeBrief(brief, validRegions, prompt) : undefined,
      },
      sectionNames.slice(0, 6).map(String),
      shellCode.slice(0, MAX_SHELL_CHARS)
    )

    if (!result.success || !result.code) {
      return NextResponse.json({ success: false, error: result.error ?? 'Section generation failed' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      data: { code: result.code, provider: result.provider },
    })
  } catch (error) {
    console.error('[API generate/section]', error)
    return NextResponse.json({ success: false, error: 'Section generation failed. Please try again.' }, { status: 500 })
  }
}

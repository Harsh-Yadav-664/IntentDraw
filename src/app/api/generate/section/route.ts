import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRESETS } from '@/lib/ai/design-tokens'
import { generateSectionStage } from '@/lib/ai/staged'
import { normalizeBrief } from '@/lib/ai/brief'
import { designTokens } from '@/lib/ai/site-design'
import { MAX_SECTION_NOTE_CHARS } from '@/lib/ai/page-parts'
import type { AIProvider, Region, RegionGroup } from '@/types'

// Model calls here run 20-70s (Gemini thinks before it answers). Vercel caps a
// function at its plan's limit; this asks for the most the plan allows.
export const maxDuration = 300

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
    const { regions, groups, prompt, globalTheme, provider, nvidiaModelId, sectionNames, shellCode, tokenId, brief, note } =
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
        /** Optional one-line instruction when the user rebuilds a single section. */
        note?: unknown
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

    const validRegions = Array.isArray(regions) ? regions : []
    // Re-validated: it came back through the client. normalizeBrief checks the
    // design's fonts and enums against fixed lists, so nothing arbitrary can
    // reach the prompt's style constraints.
    const validBrief = brief ? normalizeBrief(brief, validRegions, prompt) : undefined

    // The site's own design when there is a brief; a preset id only for
    // callers that predate it.
    const tokens = validBrief
      ? designTokens(validBrief.design, validBrief.styleId)
      : (tokenId && PRESETS[tokenId]) || PRESETS.neosleek

    const result = await generateSectionStage(
      {
        regions: validRegions,
        groups: Array.isArray(groups) ? groups : [],
        prompt,
        tokens,
        globalTheme,
        provider: provider ?? 'gemini',
        nvidiaModelId,
        brief: validBrief,
      },
      sectionNames.slice(0, 6).map(String),
      shellCode.slice(0, MAX_SHELL_CHARS),
      // User input: capped here, sanitized and capped again by the prompt builder.
      typeof note === 'string' ? note.slice(0, MAX_SECTION_NOTE_CHARS) : undefined
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

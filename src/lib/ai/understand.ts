import { buildFallbackChain, callProvider, type ProviderName } from './provider'
import {
  UNDERSTAND_SYSTEM_PROMPT,
  buildUnderstandUserMessage,
  fallbackBrief,
  normalizeBrief,
  parseJsonObject,
  type DesignBrief,
} from './brief'
import type { Region, RegionGroup } from '@/types'
import { freshDesign, type SiteDesign } from './site-design'

/**
 * Runs the understanding pass against the provider chain. See brief.ts for what
 * a brief is and why this stage exists.
 */

export interface UnderstandContext {
  prompt: string
  regions: Region[]
  groups: RegionGroup[]
  provider: ProviderName
  nvidiaModelId?: string
  imageBase64?: string
  /** Designs of the user's recent sites, which this one must not resemble. */
  recentDesigns?: SiteDesign[]
}

/** Providers that can actually see the drawing go first when there is one. */
function understandingChain(provider: ProviderName, hasImage: boolean): ProviderName[] {
  const chain = buildFallbackChain(provider)
  if (!hasImage) return chain
  // Groq reads images through its vision model (groq.ts).
  const canSee = (p: ProviderName) => p === 'gemini' || p === 'groq' || p === 'openrouter'
  return [...chain.filter(canSee), ...chain.filter(p => !canSee(p))]
}

export async function understandRequest(context: UnderstandContext): Promise<DesignBrief> {
  const { prompt, regions, groups, provider, nvidiaModelId, imageBase64 } = context
  const recent = context.recentDesigns ?? []
  const hasImage = regions.length > 0 && !!imageBase64
  const message = buildUnderstandUserMessage(prompt, regions, groups, hasImage, recent)

  // The agent is asked not to repeat a recent typeface; this guarantees it.
  const fresh = (brief: DesignBrief): DesignBrief => ({ ...brief, design: freshDesign(brief.design, recent, prompt) })

  for (const current of understandingChain(provider, hasImage)) {
    try {
      const text = await callProvider(current, UNDERSTAND_SYSTEM_PROMPT, message, {
        nvidiaModelId,
        imageBase64: hasImage && current !== 'nvidia' ? imageBase64 : undefined,
        // Understanding is the first thing the user waits on; Gemini gets ~90s
        // before a provider that answers in seconds takes over.
        geminiDeadlineMs: 90000,
      })
      const brief = normalizeBrief(parseJsonObject(text), regions, prompt)
      // A brief with no concept and no plan is the model failing quietly —
      // worth one more provider before settling for it.
      if (!brief.concept && brief.sections.length === 0) throw new Error('empty brief')
      return fresh(brief)
    } catch (err) {
      console.warn(`[Understand] ${current} failed:`, err instanceof Error ? err.message : err)
    }
  }

  return fresh(fallbackBrief(prompt, regions))
}


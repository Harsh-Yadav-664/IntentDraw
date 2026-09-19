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
}

/** Providers that can actually see the drawing go first when there is one. */
function understandingChain(provider: ProviderName, hasImage: boolean): ProviderName[] {
  const chain = buildFallbackChain(provider)
  if (!hasImage) return chain
  const canSee = (p: ProviderName) => p === 'gemini' || p === 'openrouter'
  return [...chain.filter(canSee), ...chain.filter(p => !canSee(p))]
}

export async function understandRequest(context: UnderstandContext): Promise<DesignBrief> {
  const { prompt, regions, groups, provider, nvidiaModelId, imageBase64 } = context
  const hasImage = regions.length > 0 && !!imageBase64
  const message = buildUnderstandUserMessage(prompt, regions, groups, hasImage)

  for (const current of understandingChain(provider, hasImage)) {
    try {
      const text = await callProvider(current, UNDERSTAND_SYSTEM_PROMPT, message, {
        nvidiaModelId,
        imageBase64: hasImage && (current === 'gemini' || current === 'openrouter') ? imageBase64 : undefined,
      })
      const brief = normalizeBrief(parseJsonObject(text), regions, prompt)
      // A brief with no concept and no plan is the model failing quietly —
      // worth one more provider before settling for it.
      if (!brief.concept && brief.sections.length === 0) throw new Error('empty brief')
      return brief
    } catch (err) {
      console.warn(`[Understand] ${current} failed:`, err instanceof Error ? err.message : err)
    }
  }

  return fallbackBrief(prompt, regions)
}


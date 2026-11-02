/**
 * Which provider builds which part of the page. Pure and client-safe: the
 * browser groups section batches into one lane per provider with the same
 * answer the server gives, so lanes with separate quotas run side by side.
 */
import type { AIProvider } from '@/types'

/** A provider that answers calls — what 'auto' resolves to. */
export type ProviderName = Exclude<AIProvider, 'auto'>

// Words that mark a section whose job is structure — navigation, the footer,
// forms and plain information — rather than the page's look and content.
// Matched per word of the name: models name sections "NavIsobar", "OvenFooter",
// "NeighborhoodPickupVisit".
const STRUCTURAL_WORD = /^(?:nav|navigation|navbar|header|topbar|menubar|footer|contact|form|booking|bookings|reservation|reservations|reserve|visit|location|locations|find|hours|faq|faqs|newsletter|signup|subscribe)$/i

/** "NeighborhoodPickupVisit" → ["Neighborhood", "Pickup", "Visit"] */
const words = (name: string) => name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [name]

export function isStructuralSection(name: string): boolean {
  return words(name).some(word => STRUCTURAL_WORD.test(word))
}

/**
 * Which provider builds a part of the page when the user chose 'auto'. In the
 * owner's side-by-side runs Gemini wrote the richer, more detailed sections and
 * Groq the cleaner, tidier structure — so Gemini builds the first screen and
 * the content, Groq the navigation, footer and forms. Each still falls back to
 * the other. Without section names (understanding, the legacy path): Gemini.
 */
export function resolveProvider(choice: AIProvider | undefined, sectionNames: string[] = []): ProviderName {
  if (choice && choice !== 'auto') return choice
  return sectionNames.length > 0 && sectionNames.every(isStructuralSection) ? 'groq' : 'gemini'
}

/**
 * How many batches a provider's lane builds at once. Gemini's free tier is
 * limited per day, not per burst, and its thinking models take 40–140s a
 * call — run in a row they alone broke the five-minute budget. Groq's free
 * tier counts ~8k tokens a minute and one section uses nearly all of it, so
 * its lane stays one at a time.
 */
export function laneWidth(provider: ProviderName): number {
  return provider === 'gemini' ? 3 : 1
}

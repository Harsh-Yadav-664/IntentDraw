import type { Region } from '@/types'

/**
 * The prompt a run is built from. The owner's rule: a short prompt — or none —
 * must be enough when there is a drawing. With no words at all, the drawing
 * and what the user wrote on its shapes are the brief; the understanding stage
 * already reads every shape, its tag and its note.
 */
export const DRAWING_ONLY_PROMPT =
  'Build a website from my drawing. The shapes, their tags and what I wrote on them are the plan; where something is not said, choose what suits the drawing.'

/** The prompt to build from, or null when there is nothing to build from yet. */
export function promptForRun(prompt: string, regions: Pick<Region, 'regionNumber'>[]): string | null {
  const words = prompt.trim()
  if (words) return words
  return regions.length > 0 ? DRAWING_ONLY_PROMPT : null
}

import type { BriefElement } from '@/lib/ai/brief'

/** How the reading of a drawing is worded in the editor. */

export const ROLE_LABEL: Record<BriefElement['role'], string> = {
  layout: 'layout',
  illustration: 'picture',
  object: '3D object',
  decoration: 'decoration',
  motion: 'motion path',
  connector: 'connector',
}

export const ANCHOR_TEXT: Record<string, string> = {
  exact: 'exactly where drawn',
  anywhere: 'anywhere in its part',
  behind: 'behind',
}

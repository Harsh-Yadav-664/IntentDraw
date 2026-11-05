import { describe, expect, it } from 'vitest'
import { DRAWING_ONLY_PROMPT, promptForRun } from './run-prompt'
import { intentSignals, PAGE_WIDE } from './intent'
import { normalizeBrief } from './brief'
import type { Region } from '@/types'

describe('building from a drawing with no prompt', () => {
  const shape = { id: 'r1', regionNumber: 1, geometry: { type: 'rectangle', x: 100, y: 100, width: 300, height: 200 }, intent: 'my name, big' } as unknown as Region

  it('uses the words when there are any, the drawing when there are none, and refuses an empty canvas', () => {
    expect(promptForRun('  a bakery  ', [])).toBe('a bakery')
    expect(promptForRun('   ', [shape])).toBe(DRAWING_ONLY_PROMPT)
    expect(promptForRun('', [])).toBeNull()
  })

  it('says nothing the shapes did not: no shape named, no background, no page-wide art', () => {
    expect(intentSignals(DRAWING_ONLY_PROMPT, [shape]).filter(s => s.source === 'prompt')).toEqual([])
    expect(PAGE_WIDE.test(DRAWING_ONLY_PROMPT.toLowerCase())).toBe(false)
    // The shape's own note still decides what it is.
    const el = normalizeBrief({}, [shape], DRAWING_ONLY_PROMPT).drawing.elements[0]
    expect(el).toMatchObject({ regions: [1], role: 'layout' })
  })
})

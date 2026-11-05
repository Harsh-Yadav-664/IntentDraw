import { describe, expect, it } from 'vitest'
import type { Region } from '@/types'
import { readingKey } from './use-ai'

describe('reusing the reading after a correction', () => {
  const r = { id: 'r1', regionNumber: 1, geometry: { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }, intent: '' } as unknown as Region

  it('is the same reading when only a tag changed', () => {
    expect(readingKey('a cafe', [{ ...r, tag: { kind: 'object' } }], [])).toBe(readingKey('a cafe', [r], []))
  })

  it('is read afresh when the prompt, a shape, a note or a group changed', () => {
    const base = readingKey('a cafe', [r], [])
    expect(readingKey('a bar', [r], [])).not.toBe(base)
    expect(readingKey('a cafe', [{ ...r, geometry: { ...r.geometry, x: 5 } }], [])).not.toBe(base)
    expect(readingKey('a cafe', [{ ...r, intent: 'my menu' }], [])).not.toBe(base)
    expect(readingKey('a cafe', [r], [{ id: 'g', name: 'g', intent: 'x', createdAt: '', updatedAt: '' }])).not.toBe(base)
  })
})

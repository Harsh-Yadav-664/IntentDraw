import { describe, expect, it } from 'vitest'
import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('keeps same-site paths, query included', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard')
    expect(safeRedirect('/dashboard?example=alpine')).toBe('/dashboard?example=alpine')
    expect(safeRedirect('/project/123')).toBe('/project/123')
  })

  it('rejects anything that could leave the site', () => {
    expect(safeRedirect('https://evil.example')).toBeNull()
    expect(safeRedirect('//evil.example')).toBeNull()
    expect(safeRedirect('/\\evil.example')).toBeNull()
    expect(safeRedirect('javascript:alert(1)')).toBeNull()
    expect(safeRedirect('')).toBeNull()
    expect(safeRedirect(null)).toBeNull()
  })
})

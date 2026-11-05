import { describe, expect, it } from 'vitest'
import { siteCardColors } from './site-card'

describe('the shared-site card colours', () => {
  it('uses the site palette and replaces anything that is not a colour', () => {
    const c = siteCardColors({ background: '#0E1B2C', text: 'red; } body { x', accent: '#E8A33D', secondary: 42 })
    expect(c.background).toBe('#0E1B2C')
    expect(c.accent).toBe('#E8A33D')
    expect(c.text).toBe('#F2EFEA')
    expect(c.secondary).toBe('#7FB7A4')
    expect(siteCardColors(null).background).toBe('#0E1110')
  })
})

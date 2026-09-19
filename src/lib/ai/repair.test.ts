import { describe, expect, it } from 'vitest'
import { repairGeneratedCode, softenSceneOverlays } from './repair'

const withScene = (jsx: string) => `const IntentScene = () => null;\nconst Hero = () => (${jsx});`

describe('softenSceneOverlays', () => {
  it('turns a full-bleed translucent scrim into a radial one (the real failure)', () => {
    const out = softenSceneOverlays(withScene(`<div className="absolute inset-0 bg-[#FBF9F5]/80 backdrop-blur-sm z-0"></div>`))
    expect(out).not.toContain('bg-[#FBF9F5]/80')
    expect(out).not.toContain('backdrop-blur')
    expect(out).toContain('bg-[radial-gradient(ellipse_at_center,rgba(251,249,245,0.8)_0%,transparent_70%)]')
    expect(out).toContain('absolute inset-0')
  })

  it('leaves opaque overlays and ordinary panels alone', () => {
    const opaque = withScene(`<div className="absolute inset-0 bg-[#111111]"></div>`)
    expect(softenSceneOverlays(opaque)).toBe(opaque)
    const panel = withScene(`<div className="max-w-2xl rounded-xl bg-white/80 backdrop-blur-sm"></div>`)
    expect(softenSceneOverlays(panel)).toBe(panel)
  })

  it('does nothing on a page without the user\'s drawing', () => {
    const code = `const Hero = () => <div className="absolute inset-0 bg-black/60"></div>;`
    expect(softenSceneOverlays(code)).toBe(code)
  })
})

describe('repairGeneratedCode', () => {
  it('drops a lucide import the file also declares', () => {
    const out = repairGeneratedCode(`import { Star, Moon } from 'lucide-react';\nconst Star = () => null;`)
    expect(out).toContain("import { Moon } from 'lucide-react';")
  })
})

import { describe, expect, it } from 'vitest'
import { BODY_FONT_NAMES, FONTS, findFont, fontHead, fontMarker, fontStylesheetUrl, readFontMarker } from './fonts'
import { wrapReactForPreview } from '@/lib/utils/sanitize'

describe('fonts', () => {
  it('finds a face by any spelling a model or class name uses', () => {
    expect(findFont('space grotesk')).toBe('Space Grotesk')
    expect(findFont('Space_Grotesk')).toBe('Space Grotesk')
    expect(findFont("'Fraunces'")).toBe('Fraunces')
    expect(findFont('Inter')).toBeNull()
    expect(findFont(42)).toBeNull()
  })

  it('offers only faces with body-text weights for body copy', () => {
    for (const name of BODY_FONT_NAMES) expect(FONTS[name].body).toBe(true)
  })

  it('round-trips the marker a generated file carries', () => {
    const marker = fontMarker({ display: 'Instrument Serif', body: 'Geist' })
    expect(readFontMarker(`${marker}\nexport default function App() {}`)).toEqual({ display: 'Instrument Serif', body: 'Geist' })
    expect(readFontMarker('/* SITE-FONTS: display=Comic Sans; body=Geist */')).toBeNull()
  })

  it("builds one css2 URL with each face's verified weights", () => {
    expect(fontStylesheetUrl(['Fraunces', 'Bebas Neue', 'nope'])).toBe(
      'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Bebas+Neue:wght@400&display=swap'
    )
  })
})

describe('fontHead', () => {
  it('loads both faces and applies them when the file names its fonts', () => {
    const head = fontHead(fontMarker({ display: 'Syne', body: 'Manrope' }))
    expect(head).toContain('family=Syne:wght@400;700&family=Manrope:wght@400;600')
    expect(head).toContain("body{font-family:'Manrope', sans-serif}")
    expect(head).toContain(".font-display{font-family:'Syne', sans-serif}")
  })

  it("loads a listed face an older file names in a class, so it finally renders", () => {
    expect(fontHead(`<h1 className="font-['Playfair_Display']">x</h1>`)).toContain('family=Playfair+Display')
  })

  it('adds nothing to a file that names no listed face', () => {
    expect(fontHead('<h1 className="text-4xl">Interesting</h1>')).toBe('')
  })

  it('reaches the preview document', () => {
    const html = wrapReactForPreview(`${fontMarker({ display: 'Anton', body: 'Figtree' })}\nexport default function App() { return <h1 className="font-display">Hi</h1> }`)
    expect(html).toContain('family=Anton:wght@400&family=Figtree:wght@400;600')
  })
})

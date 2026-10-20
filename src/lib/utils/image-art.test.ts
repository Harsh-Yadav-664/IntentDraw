import { describe, expect, it } from 'vitest'
import { artImage, keywordImage, NEUTRAL_ART_PALETTE, paletteMarker, readPaletteMarker } from './image-art'
import { wrapReactForPreview } from './sanitize'

const palette = ['#0f1a17', '#1c2a25', '#efe6d2', '#d9822b', '#5f7f6e']
const svgOf = (url: string) => decodeURIComponent(url.replace('data:image/svg+xml;charset=utf-8,', ''))

describe('artImage', () => {
  it('draws an SVG in the given palette and nothing else', () => {
    const svg = svgOf(artImage('pottery', 800, 600, 12, palette))
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 800 600"/)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
  })

  it('is the same for the same keyword and lock, and differs across cards', () => {
    expect(artImage('cafe', 600, 400, 3, palette)).toBe(artImage('cafe', 600, 400, 3, palette))
    const cards = new Set([1, 2, 3, 4, 5, 6].map(seed => artImage('cafe', 600, 400, seed, palette)))
    expect(cards.size).toBe(6)
  })

  it('runs from its source text alone — the preview only gets the body', () => {
    const embedded = new Function(`return (${artImage.toString()})`)()
    const parse = new Function(`return (${keywordImage.toString()})`)()
    expect(embedded('river', 400, 300, 2, palette)).toBe(artImage('river', 400, 300, 2, palette))
    expect(parse('https://loremflickr.com/800/600/pottery,clay?lock=12')).toEqual({ keyword: 'pottery', w: 800, h: 600, seed: 12 })
    expect(parse('https://example.com/a.png')).toBeNull()
  })

  it('survives silly sizes', () => {
    expect(svgOf(artImage('x', 0, 99999, 0, palette))).toMatch(/viewBox="0 0 800 2400"/)
  })
})

describe('the palette marker', () => {
  it('round-trips the brief palette', () => {
    const marker = paletteMarker({ background: '#0f1a17', surface: '#1c2a25', text: '#efe6d2', accent: '#d9822b', secondary: '#5f7f6e' })
    expect(readPaletteMarker(`${marker}\nimport React from 'react';`)).toEqual(palette)
    expect(readPaletteMarker('no marker')).toBeNull()
  })
})

describe('in the preview', () => {
  const page = `/* SITE-PALETTE: #0f1a17,#1c2a25,#efe6d2,#d9822b,#5f7f6e */\nexport default function App() { return <img src="https://loremflickr.com/800/600/bread?lock=3" alt="bread" /> }`

  it('draws keyword images in the site palette by default', () => {
    const html = wrapReactForPreview(page, { appOrigin: 'http://localhost:3000' })
    expect(html).toContain('var __ART = true;')
    expect(html).toContain(JSON.stringify(palette))
  })

  it('can still use photos when asked to', () => {
    expect(wrapReactForPreview(page, { appOrigin: 'http://localhost:3000', images: 'photos' })).toContain('var __ART = false;')
  })

  it('falls back to a neutral palette for pages saved before the marker', () => {
    const html = wrapReactForPreview(`export default function App() { return null }`, { appOrigin: '' })
    expect(html).toContain(JSON.stringify(NEUTRAL_ART_PALETTE))
  })
})

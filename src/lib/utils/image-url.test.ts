import { describe, expect, it } from 'vitest'
import { rewriteImageUrl } from './image-url'

const ORIGIN = 'https://app.example'

describe('rewriteImageUrl', () => {
  it('routes keyword photos through the image API, keeping the first keyword and the lock', () => {
    expect(rewriteImageUrl('https://loremflickr.com/400/500/textile,scarf,linen?lock=23', ORIGIN)).toBe(
      'https://app.example/api/image?q=textile&w=400&h=500&i=23'
    )
  })

  it('handles the /all and /any suffixes and a missing lock', () => {
    expect(rewriteImageUrl('https://loremflickr.com/800/600/pottery,mug/all', ORIGIN)).toBe(
      'https://app.example/api/image?q=pottery&w=800&h=600&i=0'
    )
  })

  it('stays direct but single-keyword when rendering offline', () => {
    expect(rewriteImageUrl('https://loremflickr.com/400/500/wood,engraving,board?lock=34', '')).toBe(
      'https://loremflickr.com/400/500/wood?lock=34'
    )
  })

  it('leaves every other URL alone', () => {
    const other = 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg'
    expect(rewriteImageUrl(other, ORIGIN)).toBe(other)
    expect(rewriteImageUrl('data:image/svg+xml,abc', ORIGIN)).toBe('data:image/svg+xml,abc')
  })

  it('is self-contained, because the preview receives it as source text', () => {
    // Exactly how sanitize.ts embeds it: `(${fn.toString()})`.
    const embedded = new Function(`return (${rewriteImageUrl.toString()})`)() as typeof rewriteImageUrl
    expect(embedded('https://loremflickr.com/400/300/tea,cup?lock=5', ORIGIN)).toBe(
      'https://app.example/api/image?q=tea&w=400&h=300&i=5'
    )
  })
})

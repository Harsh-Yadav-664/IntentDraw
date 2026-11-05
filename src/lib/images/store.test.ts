import { afterEach, describe, expect, it, vi } from 'vitest'
import { countImages } from './store'

const config = { url: 'https://x.supabase.co', serviceKey: 'k' }

describe('counting a user’s stored pictures', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks Storage for that folder only and counts what comes back', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([{ name: 'a.jpg' }, { name: 'b.png' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect(await countImages(config, 'user/u1/', 301)).toBe(2)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://x.supabase.co/storage/v1/object/list/site-images')
    expect(JSON.parse(String(init.body))).toEqual({ prefix: 'user/u1/', limit: 301, offset: 0 })
  })

  it('says "unknown" instead of guessing when Storage fails, so uploads fail open', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    expect(await countImages(config, 'user/u1/')).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await countImages(config, 'user/u1/')).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"weird":true}', { status: 200 })))
    expect(await countImages(config, 'user/u1/')).toBeNull()
  })
})

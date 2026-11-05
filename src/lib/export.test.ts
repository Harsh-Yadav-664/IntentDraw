import { describe, expect, it } from 'vitest'
import { exportSource, resolvePictures } from './export'
import { withImageMap } from '@/lib/images/slots'
import { setUserImage } from '@/lib/edit/user-images'
import { findSyntaxProblem } from '@/lib/ai/validate'

const GEN = 'https://x.supabase.co/storage/v1/object/public/site-images/gen/abc.jpg'
const MINE = 'https://x.supabase.co/storage/v1/object/public/site-images/user/u1/me.webp'
const PAGE = `function Hero() {
  const items = [{ k: 'bread', n: 2 }];
  return <section>
    <img src="https://loremflickr.com/800/600/espresso?lock=1" alt="Espresso" />
    <img src="https://loremflickr.com/400/400/croissant?lock=5" alt="Croissant" />
    {items.map(i => <img key={i.k} src={\`https://loremflickr.com/300/200/\${i.k}?lock=\${i.n}\`} alt="" />)}
  </section>
}
export default function App() { return <Hero /> }`

describe('the .tsx export carries the pictures the preview shows', () => {
  const code = setUserImage(withImageMap(PAGE, { '800x600/espresso/1': GEN, '400x400/croissant/5': GEN, '300x200/bread/2': GEN }), '800x600/espresso/1', MINE)

  it('writes the final picture into plain URLs (the user own first) and drops the maps', () => {
    const { code: out, unresolved } = resolvePictures(code)
    expect(out).toContain(`src="${MINE}" alt="Espresso"`)
    expect(out).toContain(`src="${GEN}" alt="Croissant"`)
    expect(out).not.toMatch(/intentdraw:(site|user)-images|__intentdraw/)
    expect(findSyntaxProblem(out)).toBeNull()
    // Built at runtime from the item: listed, not rewritten.
    expect(unresolved).toEqual([['300x200/bread/2', GEN]])
  })

  it('lists the runtime-built ones in the header, and leaves a page with no pictures alone', () => {
    const out = exportSource(code, 'Cafe')
    expect(out).toMatch(/300x200\/bread\/2 {2}→ {2}https:\/\/x\.supabase\.co/)
    expect(resolvePictures(PAGE)).toEqual({ code: PAGE, unresolved: [] })
  })
})

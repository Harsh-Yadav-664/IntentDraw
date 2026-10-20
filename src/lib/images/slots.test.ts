import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { findImageSlots, imageKey, imageMapOf, imagePrompt, withImageMap, withoutImageMap } from './slots'
import { assembleProgressive } from '@/lib/ai/assemble'

// A real generated page (2026-10-20): a taco carousel whose URLs are built at
// runtime from a data array, plus photos written out in full.
const casaDelSol = readFileSync(join(__dirname, '__fixtures__', 'casa-del-sol.tsx.txt'), 'utf8')

describe('imageKey', () => {
  it('is the same for the URL in the code and the URL the page builds', () => {
    expect(imageKey('https://loremflickr.com/800/600/Tacos?lock=12')).toBe('800x600/tacos/12')
    expect(imageKey('https://loremflickr.com/800/600/tacos,food/all')).toBe('800x600/tacos/0')
    expect(imageKey('https://loremflickr.com/300/200/al-pastor?lock=10')).toBe('300x200/al pastor/10')
    expect(imageKey('https://example.com/a.jpg')).toBeNull()
  })

  it('runs from its source text alone — the preview only gets its body', () => {
    const key = new Function(`return (${imageKey.toString()})`)()
    expect(key('https://loremflickr.com/80/60/x?lock=1')).toBe('80x60/x/1')
  })
})

describe('findImageSlots', () => {
  it('describes a picture by its alt', () => {
    const [slot] = findImageSlots(`<img src="https://loremflickr.com/800/600/tacos?lock=12" alt="Three tacos al pastor on a clay plate" />`)
    expect(slot).toMatchObject({ key: '800x600/tacos/12', keyword: 'tacos', width: 800, height: 600, seed: 12, description: 'Three tacos al pastor on a clay plate' })
  })

  it('reads an alt written after the src, past an arrow function', () => {
    const [slot] = findImageSlots(`<img onLoad={() => setReady(true)} src='https://loremflickr.com/400/400/bread?lock=3' alt={"Sourdough loaf, cut"} />`)
    expect(slot.description).toBe('Sourdough loaf, cut')
  })

  it('describes an item in a data array by its own fields', () => {
    const slots = findImageSlots(`const dishes = [
      { name: 'Cochinita Pibil', desc: 'Achiote pork, pickled onion', image: 'https://loremflickr.com/600/400/pork?lock=4' },
      { name: "Birria de Chivo", image: "https://loremflickr.com/600/400/stew?lock=5", alt: "Goat birria in a clay bowl with consommé" },
    ]`)
    expect(slots.map(s => s.description)).toEqual(['Cochinita Pibil — Achiote pork, pickled onion', 'Goat birria in a clay bowl with consommé'])
  })

  it('finds pictures whose URL is built from each item at runtime', () => {
    const slots = findImageSlots(`
      const Card = ({ item }) => <img src={\`https://loremflickr.com/300/200/\${item.imageKeyword}?lock=\${item.lockNum}\`} alt={item.name} />;
      const items = [
        { name: "Tacos al Pastor", description: "Pork, pineapple, cilantro.", imageKeyword: "alpastor", lockNum: 10 },
        { name: "Birria", imageKeyword: "birria", lockNum: 13 },
      ];`)
    expect(slots).toEqual([
      expect.objectContaining({ key: '300x200/alpastor/10', description: 'Tacos al Pastor — Pork, pineapple, cilantro.' }),
      expect.objectContaining({ key: '300x200/birria/13', description: 'Birria' }),
    ])
  })

  it('finds every picture on a real page, the taco carousel included', () => {
    const slots = findImageSlots(casaDelSol)
    const keys = slots.map(s => s.key)
    expect(keys).toContain('300x200/alpastor/10')
    expect(keys).toContain('200x150/suadero/15')
    expect(keys).toContain('600x400/pottery/33')
    expect(slots.find(s => s.key === '300x200/alpastor/10')?.description).toMatch(/^Tacos al Pastor — Marinated pork/)
    for (const slot of slots) expect(slot.description).not.toMatch(/[<>{}`$]/)
  })
})

describe('imagePrompt', () => {
  it('carries the subject, the site art direction and the frame, and forbids text', () => {
    const [slot] = findImageSlots(`<img src="https://loremflickr.com/1200/600/tacos?lock=1" alt="Tacos on a clay plate" />`)
    const prompt = imagePrompt(slot, 'Warm editorial food photography, low side light')
    expect(prompt).toMatch(/^Tacos on a clay plate\. Warm editorial food photography/)
    expect(prompt).toMatch(/wide landscape/)
    expect(prompt).toMatch(/No text/)
    expect(imagePrompt({ ...slot, description: 'A plate' }, '')).toMatch(/\(tacos\)\. Editorial photograph/)
  })
})

describe('the image map', () => {
  const made = { '800x600/tacos/12': 'https://x.supabase.co/storage/v1/object/public/site-images/gen/ab.jpg' }

  it('is added once, read back, replaced and removed', () => {
    const block = 'const Menu = () => <div />;\n'
    const once = withImageMap(block, made)
    expect(imageMapOf(once)).toEqual(made)
    const twice = withImageMap(once, { '1x1/a/0': 'https://x.co/b.jpg' })
    expect(imageMapOf(twice)).toEqual({ '1x1/a/0': 'https://x.co/b.jpg' })
    expect(twice.match(/intentdraw:site-images/g)).toHaveLength(1)
    expect(withoutImageMap(twice).trim()).toBe(block.trim())
  })

  it('drops anything that is not a plain https URL', () => {
    expect(imageMapOf(withImageMap('x;', { '1x1/a/0': 'javascript:alert(1)', '2x2/b/0': 'https://x.co/"b' }))).toEqual({})
  })

  it('survives assembly as a statement of its own', () => {
    const shell = `export default function App() { return <main><Menu /></main>; }\n/* SECTIONS: Menu */`
    const block = withImageMap(`import React from 'react';\nconst Menu = () => <section>Menu</section>;\n`, made)
    const page = assembleProgressive(shell, [block], [])
    expect(page.code).toContain('globalThis.__intentdrawImages')
    expect(page.code).toContain(made['800x600/tacos/12'])
  })
})

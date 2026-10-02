import type { Region, RegionGroup } from '@/types'
import type { BriefElement, DesignBrief } from './brief'
import { sectionForPage } from './brief'
import { SCENE_COMPONENT } from './scene-render'
import { siteFonts } from './site-design'
import { fontMarker } from '@/lib/design/fonts'
import { PAGE_CONFIG, pageIndexForRegion } from '@/lib/canvas/pages'
import { looksHandwritten } from './perception'

/**
 * The page skeleton, built in code from the brief — not by a model.
 *
 * The shell used to be a model call, and it was where whole sites went
 * missing: a real run planned five sections in the brief and the shell
 * referenced one (it copied a placeholder name from its own instructions), so
 * the page ended after a single screen. Which sections exist, in what order,
 * and where the drawing's art layer sits are decisions the brief has already
 * made — writing them down needs no model. It also saves one model call and
 * about a minute per generation.
 */

/** What a site gets when the brief has no section plan (the fallback brief). */
const DEFAULT_SECTIONS = ['HeroSection', 'StorySection', 'DetailsSection', 'ContactSection']

export function planSections(brief?: DesignBrief): string[] {
  const names = (brief?.sections ?? []).map(s => s.name).filter(n => n !== SCENE_COMPONENT && n !== 'App')
  return names.length > 0 ? names : DEFAULT_SECTIONS
}

/** The section an element belongs to: the brief's assignment, else the page it was drawn on. */
export function elementSection(e: BriefElement, regions: Region[], sections: string[]): string | null {
  if (e.section && sections.includes(e.section)) return e.section
  const members = regions.filter(r => e.regions.includes(r.regionNumber))
  if (members.length === 0) return null
  return sectionForPage(Math.min(...members.map(r => pageIndexForRegion(r))), sections)
}

const isArt = (e: BriefElement) => e.role === 'illustration' || e.role === 'motion' || e.role === 'decoration'

/** Where the art layer goes: fixed behind the whole page, or behind one section. */
export function sceneHost(brief: DesignBrief, regions: Region[], sections: string[]): 'page' | string {
  const art = brief.drawing.elements.filter(isArt)
  if (art.some(e => e.role !== 'decoration' && e.placement === 'page-background')) return 'page'
  const first = art.find(e => e.role !== 'decoration') ?? art[0]
  return (first && elementSection(first, regions, sections)) || sectionForPage(0, sections) || sections[0]
}

/** Sections that hold something the user drew — each is built in its own call. */
export function drawnSections(brief: DesignBrief | undefined, regions: Region[], sections: string[]): string[] {
  if (!brief) return []
  const names = new Set<string>()
  for (const e of brief.drawing.elements) {
    const name = elementSection(e, regions, sections)
    if (name) names.add(name)
  }
  return sections.filter(s => names.has(s))
}

const SMALL_SECTION = /^(nav|navigation|navbar|header|topbar|menu|footer)/i

/**
 * Batches for the section calls, in the order they run:
 *  - each section with drawn content alone, first — it carries the most
 *    instructions and is what the user looks at first
 *  - navigation and footer together — both small
 *  - everything else in pairs
 * Assembly follows the shell's order, not the batch order, so grouping
 * non-neighbours is free. A 7-section plan is 4 calls, not 5.
 */
export function batchPlan(sections: string[], drawn: string[]): string[][] {
  const batches: string[][] = sections.filter(s => drawn.includes(s)).map(s => [s])
  const rest = sections.filter(s => !drawn.includes(s))
  const small = rest.filter(s => SMALL_SECTION.test(s))
  const large = rest.filter(s => !SMALL_SECTION.test(s))
  if (small.length > 0) batches.push(small)
  for (let i = 0; i < large.length; i += 2) batches.push(large.slice(i, i + 2))
  return batches
}

export interface PageShell {
  shellCode: string
  sections: string[]
  batches: string[][]
}

export function buildPageShell(brief: DesignBrief | undefined, regions: Region[], hasScene: boolean): PageShell {
  const sections = planSections(brief)
  const host = hasScene && brief ? sceneHost(brief, regions, sections) : null
  const p = brief?.palette

  const layer = (cls: string) =>
    `<div className="${cls} pointer-events-none" aria-hidden="true"><${SCENE_COMPONENT} /></div>`
  const lines = sections.map(name =>
    name === host
      ? [
          `        <div className="relative">`,
          `          ${layer('absolute inset-0 z-0 overflow-hidden')}`,
          `          <div className="relative z-10"><${name} /></div>`,
          `        </div>`,
        ].join('\n')
      : `        <${name} />`
  )
  const colours = p ? ` bg-[${p.background}] text-[${p.text}]` : ''

  const shellCode = [
    ...(brief ? [fontMarker(siteFonts(brief.design))] : []),
    `/* SECTIONS: ${sections.join(', ')} */`,
    `import React from 'react';`,
    ``,
    `/* The page skeleton, built by IntentDraw from the design brief: every planned section, in order. */`,
    `export default function App() {`,
    `  return (`,
    `    <div className="relative min-h-screen overflow-x-hidden${colours} antialiased">`,
    ...(host === 'page' ? [`      ${layer('fixed inset-0 z-0')}`] : []),
    `      <main className="relative z-10">`,
    ...lines,
    `      </main>`,
    `    </div>`,
    `  );`,
    `}`,
    ``,
  ].join('\n')

  return { shellCode, sections, batches: batchPlan(sections, drawnSections(brief, regions, sections)) }
}

// =============================================================================
// What each section is told about the drawing
// =============================================================================

const pct = (n: number) => `${Math.round(n * 10) / 10}%`

/**
 * An element's drawn box, as a percentage of the screen (page) it was drawn on,
 * and the exact desktop classes that put it there.
 */
export function placementOf(e: BriefElement, regions: Region[]) {
  const members = regions.filter(r => e.regions.includes(r.regionNumber))
  if (members.length === 0) return null
  const { pageWidth: W, pageHeight: H } = PAGE_CONFIG
  const page = Math.min(...members.map(r => pageIndexForRegion(r)))
  const x0 = Math.min(...members.map(r => r.geometry.x))
  const y0 = Math.min(...members.map(r => r.geometry.y))
  const x1 = Math.max(...members.map(r => r.geometry.x + r.geometry.width))
  const y1 = Math.max(...members.map(r => r.geometry.y + r.geometry.height))
  const left = Math.max(0, (x0 / W) * 100)
  const top = Math.max(0, ((y0 - page * H) / H) * 100)
  const width = Math.min(100 - left, ((x1 - x0) / W) * 100)
  const height = ((y1 - y0) / H) * 100
  return {
    page,
    left,
    top,
    width,
    height,
    classes: `lg:absolute lg:left-[${pct(left)}] lg:top-[${pct(top)}] lg:w-[${pct(width)}]`,
  }
}

type Placed = NonNullable<ReturnType<typeof placementOf>>

const ROLE_TEXT: Record<BriefElement['role'], string> = {
  layout: 'content',
  illustration: 'picture',
  decoration: 'decoration',
  motion: 'motion path',
  connector: 'arrow',
}

interface Slot {
  e: BriefElement
  at: Placed
  /** Made only of handwriting — marks where text goes, not how big it is. */
  written: boolean
}

/** How much two drawn boxes share horizontally, as a share of the narrower one. */
function overlapX(a: Placed, b: Placed): number {
  const shared = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  return shared / Math.max(1, Math.min(a.width, b.width))
}

/**
 * Drawn content grouped into columns: things drawn one above another, sharing
 * horizontal space. Positioning each one absolutely made them collide — a
 * real run set the name huge, it wrapped to two lines, and the stats band
 * pinned at its drawn spot covered it. A column keeps its drawn position but
 * stacks its items in normal flow, with the drawn gaps between them.
 */
function columnsOf(slots: Slot[]): Slot[][] {
  const columns: Slot[][] = []
  for (const slot of [...slots].sort((a, b) => a.at.top - b.at.top)) {
    const column = columns.find(c => c.some(o => overlapX(o.at, slot.at) > 0.3))
    if (column) column.push(slot)
    else columns.push([slot])
  }
  return columns
}

/**
 * The block a section call gets about what the user drew inside it: drawn
 * content as positioned columns with exact classes, pictures that are already
 * painted behind it, and arrows. '' when nothing was drawn in these sections.
 */
export function describeDrawnSections(
  sectionNames: string[],
  brief: DesignBrief | undefined,
  regions: Region[],
  groups: RegionGroup[] = []
): string {
  if (!brief || regions.length === 0) return ''
  const sections = planSections(brief)
  const host = sceneHost(brief, regions, sections)
  const blocks: string[] = []

  const notesFor = (e: BriefElement): string => {
    const own = regions
      .filter(r => e.regions.includes(r.regionNumber) && r.intent?.trim())
      .map(r => `R${r.regionNumber}: "${r.intent.trim().slice(0, 160)}"`)
    const grouped = groups
      .filter(g => g.intent.trim() && regions.some(r => e.regions.includes(r.regionNumber) && r.groupId === g.id))
      .map(g => `group "${g.name}": "${g.intent.trim().slice(0, 200)}"`)
    const all = [...own, ...grouped]
    return all.length > 0 ? ` (user's notes — ${all.join('; ')})` : ''
  }
  const ids = (e: BriefElement) => e.regions.map(n => `R${n}`).join('+')
  const where = (at: Placed) => `left ${pct(at.left)}, top ${pct(at.top)}, ${pct(at.width)} wide, ${pct(at.height)} tall`

  for (const name of sectionNames) {
    const own = brief.drawing.elements
      .filter(e => elementSection(e, regions, sections) === name)
      .map(e => ({ e, at: placementOf(e, regions) }))
      .filter((x): x is { e: BriefElement; at: Placed } => !!x.at)
    if (own.length === 0) continue
    const lines: string[] = []

    // Drawn content, as columns.
    const slots: Slot[] = own
      .filter(x => x.e.role === 'layout')
      .map(x => ({
        ...x,
        written: regions.filter(r => x.e.regions.includes(r.regionNumber)).every(looksHandwritten),
      }))
    const everything = own.map(x => x.at)
    for (const column of columnsOf(slots)) {
      const first = column[0]
      const left = Math.min(...column.map(s => s.at.left))
      const boxRight = Math.max(...column.filter(s => !s.written).map(s => s.at.left + s.at.width), left)
      // Room for text: up to the next drawn thing to the right that it would run into.
      const blockers = everything
        .filter(o => !column.some(s => s.at === o) && o.left > left + 1)
        .filter(o => o.top < first.at.top + 60 && o.top + o.height > first.at.top)
      const textRoom = (blockers.length > 0 ? Math.min(...blockers.map(o => o.left)) - 2 : 95) - left
      const width = Math.max(20, column.some(s => s.written) ? Math.max(textRoom, boxRight - left) : boxRight - left)
      const wrapper = `lg:absolute lg:left-[${pct(left)}] lg:top-[${pct(first.at.top)}] lg:w-[${pct(width)}]${column.length > 1 ? ' lg:flex lg:flex-col' : ''}`

      lines.push(
        column.length > 1
          ? `- A column at ${where(first.at)} → wrapper className="${wrapper}". Its items stay in normal flow, top to bottom, so a tall heading pushes the next item down instead of overlapping it:`
          : `- At ${where(first.at)} → wrapper className="${wrapper}":`
      )
      column.forEach((slot, i) => {
        const prev = column[i - 1]
        const gap = prev ? Math.max(0, slot.at.top - (prev.at.top + prev.at.height)) : 0
        const sizing = [
          i > 0 && gap > 1 ? `lg:mt-[${Math.round(gap)}vh]` : '',
          !slot.written && column.length > 1 ? `lg:w-[${pct(Math.min(100, (slot.at.width / width) * 100))}]` : '',
        ].filter(Boolean).join(' ')
        const written = slot.written
          ? ' — the user HANDWROTE a word here: it marks the text that belongs at this spot (e.g. "Name" means the site\'s name, as the main heading). Its drawn width is just handwriting, not a size.'
          : ''
        lines.push(
          `  ${column.length > 1 ? `${i + 1}. ` : ''}"${slot.e.name}" (${ids(slot.e)}, ${slot.written ? 'text' : 'content'})${slot.e.render ? ` — ${slot.e.render}` : ''}${written}${notesFor(slot.e)}${sizing ? `\n     item className adds "${sizing}"` : ''}`
        )
      })
    }

    for (const { e, at } of own) {
      if (e.role === 'connector') {
        lines.push(`- "${e.name}" (${ids(e)}, an arrow) at ${where(at)}${e.render ? ` — ${e.render}` : ''}${notesFor(e)} — show the relationship it draws (a flow, a link, a sequence) between the things at its ends.`)
      } else if (e.role !== 'layout') {
        lines.push(`- "${e.name}" (${ids(e)}, ${ROLE_TEXT[e.role]}) at ${where(at)}${e.render ? ` — ${e.render}` : ''} — ALREADY PAINTED behind this section by <${SCENE_COMPONENT} />. Do not draw it, import it or cover it: keep that area free of panels, cards and text.`)
      }
    }

    if (lines.length === 0) continue
    const behind = name === host
      ? `\nThe user's drawing is painted behind ${name}: give ${name} NO background colour or full-width overlay of its own. Keep text readable with a panel sized to the text, or a text shadow.`
      : ''
    blocks.push(
      `WHAT THE USER DREW IN ${name} — honour it exactly. ${name} is one full screen: its root is <section className="relative min-h-screen …">. Positions are % of that screen; on desktop (lg:) things sit exactly where they were drawn, on mobile everything stacks in reading order.\n${lines.join('\n')}${behind}`
    )
  }
  return blocks.join('\n\n')
}

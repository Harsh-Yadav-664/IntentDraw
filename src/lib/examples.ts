import type { CanvasData, Region, RegionGeometry } from '@/types'
import { PAGE_CONFIG } from '@/lib/canvas/pages'

/**
 * The landing page's examples. Clicking one starts a real project from the
 * same idea: the prompt and a drawing, ready to generate or change.
 *
 * The drawings were made on a 1000 × 640 page; they are scaled to the canvas's
 * own page (PAGE_CONFIG) when a project is created, so they land where they
 * were drawn.
 */

export type ExampleId = 'alpine' | 'atelier' | 'ceramics' | 'cafe'

export const EXAMPLE_IDS: ExampleId[] = ['alpine', 'atelier', 'ceramics', 'cafe']

export interface Example {
  name: string
  category: string
  image: string
  headline: string
  prompt: string
}

export const EXAMPLES: Record<ExampleId, Example> = {
  alpine: {
    name: 'Wilder House',
    category: 'Mountain retreat',
    image: '/images/alpine-dawn.jpg',
    headline: 'A little closer to nowhere.',
    prompt:
      'A quiet mountain retreat website. Use my sketch of two mountains, a rising sun and a winding river as the hero art. Warm, editorial and a little wild.',
  },
  atelier: {
    name: 'Forme Studio',
    category: 'Architecture studio',
    image: '/images/atelier-interior.jpg',
    headline: 'Spaces for the way we live.',
    prompt:
      'A considered portfolio for a small architecture practice. Sculptural spaces, generous whitespace, warm stone and editorial typography.',
  },
  ceramics: {
    name: 'Objects of Us',
    category: 'Ceramics shop',
    image: '/images/ceramic-studio.jpg',
    headline: 'Things worth keeping.',
    prompt: 'An expressive shop for handmade ceramics. Deep wine colors, artistic typography and a tactile, gallery-like feel.',
  },
  cafe: {
    name: 'Sunday Table',
    category: 'Neighborhood cafe',
    image: '/images/cafe-table.jpg',
    headline: 'Stay for another cup.',
    prompt: 'A welcoming website for a neighborhood cafe. Use rich coffee tones, playful editorial type and a warm, lived-in mood.',
  },
}

export function isExampleId(value: unknown): value is ExampleId {
  return typeof value === 'string' && (EXAMPLE_IDS as string[]).includes(value)
}

type Kind = 'rect' | 'circle' | 'pencil' | 'arrow'
type Point = [number, number]
interface ExampleShape {
  kind: Kind
  x: number
  y: number
  w: number
  h: number
  intent: string
  points?: Point[]
}

const SOURCE_WIDTH = 1000
const SOURCE_PAGE_HEIGHT = 640

const rect = (x: number, y: number, w: number, h: number, intent: string): ExampleShape => ({ kind: 'rect', x, y, w, h, intent })
const circle = (x: number, y: number, w: number, h: number, intent: string): ExampleShape => ({ kind: 'circle', x, y, w, h, intent })
const pencil = (intent: string, points: Point[]): ExampleShape => ({ kind: 'pencil', x: 0, y: 0, w: 0, h: 0, intent, points })
const arrow = (x: number, y: number, w: number, h: number, intent: string): ExampleShape => ({ kind: 'arrow', x, y, w, h, intent })

const DRAWINGS: Record<ExampleId, ExampleShape[]> = {
  alpine: [
    rect(50, 42, 900, 58, 'A quiet navigation with the retreat name and a booking link'),
    rect(75, 168, 380, 160, 'Large editorial headline and one short sentence'),
    circle(680, 152, 92, 92, 'A pale sun rising between the mountains'),
    pencil('The left mountain in the landscape', [[480, 430], [520, 380], [550, 345], [585, 308], [615, 270], [640, 240], [660, 220], [690, 265], [720, 300], [775, 360], [835, 430], [910, 430]]),
    pencil('The second mountain behind the river', [[660, 430], [710, 390], [750, 348], [790, 298], [828, 238], [870, 298], [910, 362], [935, 430]]),
    pencil('A winding river leading smoothly down into the story section', [[730, 410], [765, 440], [740, 470], [685, 500], [660, 535], [715, 575], [820, 620], [860, 650]]),
    rect(75, 350, 150, 46, 'Explore the cabins button'),
    rect(65, 740, 390, 380, 'A full-height photograph of the retreat'),
    rect(500, 755, 410, 150, 'A short narrative introduction to the place'),
    rect(500, 930, 410, 190, 'Three cabin options with images and details'),
    arrow(790, 1135, 95, 58, 'Guide the eye toward the booking action'),
  ],
  atelier: [
    rect(50, 40, 900, 60, 'Studio name and a simple project menu'),
    rect(75, 210, 390, 170, 'An architectural headline with generous space'),
    pencil('A tall sculptural arch, the visual centre of the hero', [[580, 520], [580, 260], [590, 210], [610, 170], [645, 140], [685, 120], [725, 110], [770, 120], [810, 140], [840, 180], [860, 225], [870, 265], [870, 520]]),
    rect(615, 285, 220, 235, 'A photograph of a sunlit space framed by the arch'),
    rect(75, 410, 145, 46, 'View selected projects'),
    arrow(460, 430, 85, 42, 'Guide attention toward the work'),
  ],
  ceramics: [
    rect(50, 40, 900, 60, 'Shop name and collection link'),
    rect(70, 200, 380, 160, 'Expressive headline about everyday objects'),
    pencil('A tall hand-thrown vessel', [[590, 180], [585, 220], [570, 295], [560, 390], [575, 470], [610, 510], [670, 520], [735, 508], [770, 468], [780, 390], [770, 295], [748, 220], [745, 180]]),
    circle(590, 160, 155, 38, 'The opening of the ceramic vessel'),
    pencil('A smaller companion piece', [[800, 310], [788, 365], [780, 445], [800, 500], [840, 518], [880, 498], [900, 440], [888, 365], [880, 310]]),
    rect(70, 390, 155, 44, 'Shop the collection'),
  ],
  cafe: [
    rect(50, 40, 900, 60, 'Cafe name, menu and visit link'),
    rect(75, 195, 385, 170, 'A warm, playful hero headline'),
    circle(610, 230, 255, 230, 'An overhead view of a cup of coffee'),
    circle(655, 272, 168, 145, 'The dark espresso inside the cup'),
    pencil('A loose warm line of rising steam', [[610, 235], [590, 215], [602, 195], [630, 188], [648, 168], [668, 185], [688, 178], [715, 198], [752, 175]]),
    rect(75, 395, 145, 44, 'See the daily menu'),
  ],
}

const round = (n: number) => Math.round(n * 10) / 10

function geometryOf(shape: ExampleShape): RegionGeometry {
  const sx = PAGE_CONFIG.pageWidth / SOURCE_WIDTH
  const sy = PAGE_CONFIG.pageHeight / SOURCE_PAGE_HEIGHT
  if (shape.kind === 'pencil' && shape.points) {
    const pts = shape.points.map(([x, y]) => ({ x: x * sx, y: y * sy }))
    const minX = Math.min(...pts.map((p) => p.x))
    const minY = Math.min(...pts.map((p) => p.y))
    const maxX = Math.max(...pts.map((p) => p.x))
    const maxY = Math.max(...pts.map((p) => p.y))
    return {
      type: 'freeform',
      x: round(minX),
      y: round(minY),
      width: round(Math.max(1, maxX - minX)),
      height: round(Math.max(1, maxY - minY)),
      path: pts.map((p) => ({ x: round(p.x - minX), y: round(p.y - minY) })),
    }
  }
  const x = shape.x * sx
  const y = shape.y * sy
  const width = shape.w * sx
  const height = shape.h * sy
  if (shape.kind === 'arrow') {
    return {
      type: 'arrow',
      x: round(x),
      y: round(y),
      width: round(width),
      height: round(height),
      path: [
        { x: 0, y: 0 },
        { x: round(width), y: round(height) },
      ],
    }
  }
  return { type: shape.kind === 'circle' ? 'circle' : 'rectangle', x: round(x), y: round(y), width: round(width), height: round(height) }
}

/** The example's drawing as canvas data for a new project. `newId` makes each region's id. */
export function exampleCanvas(id: ExampleId, newId: () => string, now = new Date().toISOString()): CanvasData {
  const regions: Region[] = DRAWINGS[id].map((shape, i) => ({
    id: newId(),
    regionNumber: i + 1,
    geometry: geometryOf(shape),
    intent: shape.intent,
    lockState: { layout: false, style: false, animation: false },
    generatedCode: null,
    createdAt: now,
    updatedAt: now,
  }))
  return { regions, groups: [] }
}

/**
 * Structural reference corpus.
 *
 * WHY THIS EXISTS: the design tokens give the model style *values* (radii,
 * palette, type) plus adjectives. Adjectives do not produce a considered page —
 * models imitate what they are SHOWN far more reliably than what they are TOLD.
 * These sketches show structure: section order, where visual weight sits, where
 * density rises and falls, what breaks the grid.
 *
 * LICENSING / SAFETY: every sketch is an original prose description of a layout
 * archetype. No markup, class strings, copy or asset from any library or site is
 * reproduced here, and the injected instruction forbids the model reusing a
 * reference's colours, type, radii or wording. Structure is the only thing that
 * crosses over; the resolved tokens and the user's prompt supply the skin.
 *
 * COST: this runs on free tiers where Groq counts `max_tokens` against an 8k TPM
 * budget up front. Selection therefore returns 1-2 sketches, never the corpus,
 * and never makes an API call.
 */

export interface StructuralSketch {
  id: string
  /** Human label, also shown to the model. */
  name: string
  /** Prompt words that indicate this archetype. Matched as substrings of a space-normalized prompt. */
  keywords: string[]
  /** Section order and page flow — the page-level architecture. */
  flow: string
  /** What carries the visual weight. */
  weight: string
  /** Which element escapes the centred container. */
  contrast: string
  /** How section heights/density vary down the page. */
  rhythm: string
  /** The specific move that makes it read as designed rather than generated. */
  designed: string
  /** Section-level craft, injected on the (cheaper) per-section pass. */
  detail: string
}

/**
 * Corpus order is the deterministic tie-break, so the first entry is also the
 * fallback for a prompt with no signal at all. Editorial is deliberately first:
 * of the archetypes here it is the one whose structure fights the generic
 * evenly-padded-card-stack failure mode hardest.
 */
export const REFERENCE_CORPUS: StructuralSketch[] = [
  {
    id: 'agency_editorial',
    name: 'Agency / studio / editorial',
    keywords: [
      'agency', 'studio', 'editorial', 'magazine', 'blog', ' news ', 'journal',
      'publication', 'article', 'branding', 'creative', 'writer', 'copywriter',
      'consultanc', 'manifesto',
    ],
    flow:
      'Oversized type masthead — a 2-3 line statement filling most of the first screen, with a small meta row (location, year, availability) in a corner as counterweight. > Selected work as an offset list: each item is a wide row, image and caption swapping sides row to row, separated by hairline rules rather than cards. > One narrow manifesto paragraph set off-centre against a wide empty column. > Services as a numbered list (01/02/03, one line each), not a grid. > A full-bleed band carrying a single pull-quote. > Contact as one oversized type link, not a form.',
    weight: 'Typography carries everything; images are secondary and cropped hard.',
    contrast: 'The work rows and the pull-quote band run edge to edge; the manifesto paragraph is the only narrow element on the page.',
    rhythm: 'tall type hero > long dense work list > one short quiet narrow paragraph > tight numbered list > short full-bleed band > short contact.',
    designed: 'Nothing is centred by default. Sizes jump hard (a display line beside an xs label), and one element deliberately overlaps or overflows its neighbour.',
    detail: 'Rows over cards. Hairline rules over border-plus-shadow. Numbers and labels over icon squares. Never one uniform body size.',
  },
  {
    id: 'saas_landing',
    name: 'SaaS / product landing',
    keywords: [
      'saas', 'software', 'startup', 'platform', 'b2b', 'crm', 'analytics',
      'subscription', 'productivity', 'automation', 'workflow', 'team',
      'project management', 'landing page', 'product page',
    ],
    flow:
      'Slim nav: wordmark left, 3-4 links, one solid action right. > Asymmetric hero about 60/40 — two short headline lines, one clarifying sentence, a primary action plus a quiet text link, and the real product surface (UI panel, chart, table, terminal) opposite, cropped so it bleeds off the page edge. > A short proof strip of logos or three metrics. > Features as ONE flagship treated wide with a real interface fragment, then three compact supporting features in a tighter row beneath. > "How it works" as 3 numbered steps sharing one continuous visual. > Pricing as a dense comparison with one plan physically larger. > Tight FAQ list. > Compact footer.',
    weight: 'The product surface, not the headline — show the thing working.',
    contrast: 'The proof strip and the pricing band invert the colour scheme and run full-bleed.',
    rhythm: 'hero tall > proof strip very short > flagship feature wide > supporting row tight > steps medium > pricing dense > faq tight.',
    designed: 'The product image is cropped by the viewport instead of floating in a padded card, and the supporting row is visibly denser than the flagship, so texture changes down the page.',
    detail: 'Show real interface fragments — data rows, a chart, a code line — never abstract icon squares. Give one item in any set more weight than its siblings.',
  },
  {
    id: 'portfolio',
    name: 'Personal / creative portfolio',
    keywords: [
      'portfolio', 'my work', 'personal site', 'personal website', 'photographer',
      'photography', 'freelance', 'resume', ' cv ', 'case stud', 'illustrat',
      'architect', 'artist', 'showcase', 'about me',
    ],
    flow:
      'Name plus a one-line positioning statement top-left, with the first work item ALREADY visible on the first screen — never a name floating alone. > Work as a staggered two-column grid with deliberately unequal tile heights, one tile spanning full width. > A short about strip: narrow paragraph, a tightly cropped portrait, and tools/clients as a small-caps list. > Credits or press as a plain two-column list. > Contact as one oversized line with social links inline.',
    weight: 'The work images; text is captioning, not content.',
    contrast: 'One full-width hero project breaks the grid mid-page.',
    rhythm: 'short intro > long staggered grid > narrow quiet about > tight list > short contact.',
    designed: 'Unequal tile heights, and captions sitting outside the image aligned to a real grid rather than centred under it.',
    detail: 'Captions carry metadata (year, role, client) on one quiet line. Hover reveals information rather than merely scaling the tile.',
  },
  {
    id: 'hospitality',
    name: 'Restaurant / cafe / hotel',
    keywords: [
      'restaurant', 'cafe', 'coffee shop', 'bakery', 'bistro', 'pizzeria',
      'menu', 'food', 'dining', 'chef', 'hotel', 'resort', 'catering', 'recipe',
      ' bar ', 'brunch', 'cuisine', 'reservation',
    ],
    flow:
      'First screen: a large food or room photograph bled to the edges, with the name, one line of character, hours/location and a booking action laid directly over it — never a plain colour hero. > Immediately the menu itself as a real two-column priced list (dish, one-line description, price aligned right) grouped by course; the menu is the main content, not a link. > A short story block: narrow paragraph beside one tall image. > Hours, address and a photo/map strip as one dense band. > Booking or contact as a compact inline row.',
    weight: 'Photography on the first screen, then the priced menu list.',
    contrast: 'The hero image and the hours band both run full-bleed.',
    rhythm: 'full-bleed image > dense priced list (the longest section) > quiet narrow story > dense info band > short booking.',
    designed: 'Prices align tabularly with a ruled or dotted leader; dish name and description differ in weight and size; nothing is a card with a drop shadow.',
    detail: 'Menu items are list rows with aligned prices, not cards. Course headers are small, spaced and uppercase. Invent real dish names and real prices.',
  },
  {
    id: 'ecommerce',
    name: 'Store / product catalogue',
    keywords: [
      'shop', 'store', 'ecommerce', 'e commerce', 'storefront', 'clothing',
      'fashion', 'sneaker', 'jewel', ' cart ', 'merch', 'furniture', 'skincare',
      'boutique', 'checkout', 'catalog', 'sell',
    ],
    flow:
      'Campaign hero: one product or lifestyle image full-bleed with a short claim and a single shop action, plus a visible row of category links immediately beneath — the first screen offers navigation, not just a slogan. > Product grid 3-4 across with tight gutters and a dominant image, name and price sharing one compact line underneath, one tile enlarged as a featured pick. > A full-bleed collection band telling one story. > Shipping / returns / materials as three short text columns — no icons in circles. > Reviews as short quotes in a tight strip. > Utility-dense footer with real link columns.',
    weight: 'Product imagery and price legibility.',
    contrast: 'The collection band is full-bleed and colour-inverted.',
    rhythm: 'hero plus category row > dense product grid (longest) > wide story band > tight trust row > short reviews > dense footer.',
    designed: 'Tight gutters and one consistent image crop make the grid read as a catalogue rather than spaced-out cards; price sits on the same baseline as the name.',
    detail: 'Fixed aspect-ratio crops, minimal gutters, price on the name baseline. Badges are small text, not shadowed pills.',
  },
  {
    id: 'app_marketing',
    name: 'Developer tool / app marketing',
    keywords: [
      'dashboard', 'mobile app', ' ios ', 'android', 'developer', 'devtool',
      'open source', ' sdk ', ' api ', ' cli ', 'documentation', 'fintech', 'wallet',
      'banking', 'database', 'infrastructure', 'monitoring', ' app ',
    ],
    flow:
      'An inverted top band holding nav, a one-line headline, and a real interface fragment (dashboard panel, syntax-coloured code block, terminal) that starts INSIDE the first screen. > Directly below, a dense capability row: 4-6 short items, one line each, in a compact grid. > A deep-dive that alternates twice — text left / visual right, then reversed — each visual a real UI or code fragment. > Integrations or stack as a tight name grid. > Performance or scale as a single numeric band. > Getting started as one copyable command line. > Dense grouped-link footer.',
    weight: 'The interface and code fragments.',
    contrast: 'The numeric band and the command line are full-bleed and monospaced.',
    rhythm: 'dense hero > tight capability grid > two alternating wide blocks > tight integration grid > short numeric band > short command > dense footer.',
    designed: 'Monospace carries real values rather than decoration, and the capability grid is deliberately denser than the deep-dive blocks.',
    detail: 'Monospace for code, paths and numbers, with plausible real output. Keep item grids tight — 4-6 per row here, not 3 wide cards.',
  },
  {
    id: 'event_launch',
    name: 'Event / conference / launch',
    keywords: [
      'event', 'conference', 'summit', 'meetup', 'festival', 'webinar',
      'hackathon', 'countdown', 'ticket', 'concert', 'waitlist', 'coming soon',
      'launch', 'schedule', 'speaker', 'workshop',
    ],
    flow:
      'The first screen states the three facts immediately — what, when, where — with a registration action and either a countdown or the date set as display type sharing the screen with a speaker or venue image. > Schedule as a real time-ordered table: time column left, session and speaker right, day headers as ruled dividers. > Speakers as a tight portrait grid 4-5 across, names on one compact line below. > Venue and travel as a wide image plus a short practical list. > Ticket tiers as a dense comparison row. > A short full-bleed closing registration band.',
    weight: 'The date/time facts and the schedule table.',
    contrast: 'The date/countdown block and the closing registration band run full-bleed.',
    rhythm: 'fact-dense hero > long schedule table > tight speaker grid > medium venue > dense tiers > short closing band.',
    designed: 'A genuine table with aligned times reads as a programme rather than a marketing page, and the date is treated as the primary graphic element.',
    detail: 'Time-ordered rows with aligned times. Portraits in a tight grid with small captions. Dates as display type, never body text.',
  },
]

/**
 * Preset affinity is a tie-break nudge only (worth half a keyword hit), so a
 * prompt with real signal always beats the style preset. It exists so a prompt
 * with NO archetype signal still gets a structure that suits the resolved style
 * instead of always landing on the corpus default.
 */
const PRESET_AFFINITY: Record<string, string[]> = {
  neosleek: ['agency_editorial', 'event_launch'],
  playful_pop: ['hospitality', 'ecommerce'],
  elegant_serif: ['portfolio', 'hospitality'],
  glassmorphism: ['saas_landing', 'app_marketing'],
}

const KEYWORD_WEIGHT = 1
const AFFINITY_WEIGHT = 0.5

/** Collapse punctuation to spaces and pad, so ' app ' style keywords match words. */
function normalize(prompt: string): string {
  return ` ${prompt.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
}

function scoreSketch(sketch: StructuralSketch, normalized: string, presetId?: string): number {
  let score = 0
  for (const keyword of sketch.keywords) {
    // Keywords are authored pre-normalized, so a plain substring test is enough.
    if (normalized.includes(keyword.toLowerCase())) score += KEYWORD_WEIGHT
  }
  if (presetId && PRESET_AFFINITY[presetId]?.includes(sketch.id)) score += AFFINITY_WEIGHT
  return score
}

/**
 * Picks 1-2 sketches for a prompt. Deterministic, free, never the whole corpus.
 *
 * - No signal at all -> the corpus default (one sketch).
 * - A second sketch is added only on genuine dual signal (at least one real
 *   keyword hit of its own, and at least half the leader's score), so
 *   "restaurant booking app" gets both hospitality and app structure while
 *   "a restaurant website" gets only one.
 */
export function selectReferences(prompt: string, presetId?: string): StructuralSketch[] {
  const normalized = normalize(prompt ?? '')

  const ranked = REFERENCE_CORPUS
    .map((sketch, index) => ({ sketch, index, score: scoreSketch(sketch, normalized, presetId) }))
    // Stable: ties fall back to corpus order, which keeps selection deterministic.
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))

  const [top, second] = ranked

  if (!top || top.score === 0) return [REFERENCE_CORPUS[0]]

  const takeSecond =
    second !== undefined &&
    second.score >= KEYWORD_WEIGHT &&
    second.score >= top.score / 2

  return takeSecond ? [top.sketch, second.sketch] : [top.sketch]
}

function renderPageSketch(sketch: StructuralSketch, index: number): string {
  return `REFERENCE ${index + 1} — ${sketch.name}
FLOW: ${sketch.flow}
WEIGHT: ${sketch.weight}
FULL-BLEED BREAK: ${sketch.contrast}
RHYTHM: ${sketch.rhythm}
WHY IT READS AS DESIGNED: ${sketch.designed}`
}

const PAGE_REFERENCE_HEADER = `════════════════════════════════════════════
STRUCTURAL REFERENCE — ADOPT THE STRUCTURE, NOT THE SKIN
════════════════════════════════════════════
Structure only; these carry NO visual identity.
ADOPT: section order, proportion, asymmetry, what dominates the first screen,
where density rises and falls, which element breaks out of the container.
DO NOT TAKE: colours, radii, fonts, weights, shadows, borders, spacing scale,
component styling, or wording. Every visual decision comes from the HARD DESIGN
CONSTRAINTS above, and the BANNED CLASSES list still applies. Write all copy for
the user's own subject. This is a skeleton to re-skin, not a template to fill —
and where it conflicts with the drawing's LAYOUT SKELETON, THE SKELETON WINS.`

const SECTION_REFERENCE_HEADER = `STRUCTURAL REFERENCE (section craft) — adopt these structural habits only.
Take NO colours, radii, fonts, shadows, spacing or wording from them; every
visual decision comes from the HARD DESIGN CONSTRAINTS above.`

/**
 * The block injected into a user prompt.
 *
 * `page` mode (shell / whole-page passes) gets full architecture; `section` mode
 * gets only the section-level craft lines, because a section builder cannot act
 * on page flow and the tokens are better spent elsewhere.
 * Returns '' if nothing was selected, so callers can push unconditionally.
 */
export function buildReferenceSection(
  prompt: string,
  presetId?: string,
  mode: 'page' | 'section' = 'page'
): string {
  const selected = selectReferences(prompt, presetId)
  if (selected.length === 0) return ''

  if (mode === 'section') {
    const lines = selected.map(s => `${s.name}: ${s.detail}`).join('\n')
    return `${SECTION_REFERENCE_HEADER}\n${lines}`
  }

  return `${PAGE_REFERENCE_HEADER}\n\n${selected.map(renderPageSketch).join('\n\n')}`
}

/**
 * What each plan includes, in one place, so the landing page, the upgrade
 * dialog and settings can't drift apart or promise something that isn't built.
 *
 * Only Free exists today. Paid plans are described as planned, never as on
 * sale: there is no billing yet.
 */

/** Generations a free account gets per day (the rate limiter's production default). */
export const FREE_DAILY_GENERATIONS = 10

export interface PlanLine {
  text: string
  /** Planned, not built yet — shown as such. */
  soon?: boolean
}

export interface Plan {
  name: 'Free' | 'Pro' | 'Studio'
  price: string
  per?: string
  blurb: string
  available: boolean
  lines: PlanLine[]
}

export const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    per: 'forever',
    blurb: 'Enough to build and share a real site.',
    available: true,
    lines: [
      { text: `${FREE_DAILY_GENERATIONS} generations a day` },
      { text: 'Drawing canvas, up to 8 pages' },
      { text: 'Rebuild any section on its own' },
      { text: 'Public share link' },
      { text: 'Website (.html) and React (.tsx) export' },
    ],
  },
  {
    name: 'Pro',
    price: '$20',
    per: 'per month',
    blurb: 'For the ideas you mean business about.',
    available: false,
    lines: [
      { text: 'Everything in Free' },
      { text: 'Premium models for stronger sites', soon: true },
      { text: 'More generations every day', soon: true },
      { text: 'Licensed photos for commercial sites', soon: true },
      { text: 'Custom domain', soon: true },
    ],
  },
  {
    name: 'Studio',
    price: 'Later',
    blurb: 'For small teams doing this every week.',
    available: false,
    lines: [
      { text: 'Everything in Pro' },
      { text: 'Shared workspace and seats', soon: true },
      { text: 'Version history', soon: true },
      { text: 'Bring your own API key', soon: true },
    ],
  },
]

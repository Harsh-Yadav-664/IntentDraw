'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { EXAMPLES, type ExampleId } from '@/lib/examples'

/** The marketing page's mark: a ridge line over a drawn baseline. */
export function BrandMark({ size = 27 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="brand-mark">
      <path d="M5.1 24.4 12 6.6l3.3 12.1 4.2-7.3 6.6 13.1" stroke="currentColor" strokeWidth="2.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.9 26.7c6.3-1.3 14.7-1.8 24.2-.9" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" />
    </svg>
  )
}

export function Brand({ compact = false, href = '/' }: { compact?: boolean; href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="IntentDraw home">
      <BrandMark size={compact ? 24 : 29} />
      <span>
        intent<span className="brand-draw">draw</span>
        <span className="brand-period">.</span>
      </span>
    </Link>
  )
}

/** Fades content up as it scrolls into view (or on load); still for reduced motion. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
  onLoad = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  onLoad?: boolean
}) {
  const reduce = useReducedMotion()
  const shown = { opacity: 1, y: 0 }
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      {...(onLoad ? { animate: shown } : { whileInView: shown, viewport: { once: true, amount: 0.16 } })}
      transition={{ duration: 0.58, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/** The little sketch each example started from. */
export function SmallSketch({ variant }: { variant: ExampleId }) {
  if (variant === 'alpine') {
    return (
      <svg className="small-sketch-svg" viewBox="0 0 200 120" fill="none" aria-hidden="true">
        <path d="M18 104c14-14 28-28 40-43 10-12 17-25 27-38 9 11 16 21 25 33 10 13 21 26 33 48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M96 104c12-11 24-23 35-36 8-10 14-21 22-31 10 14 17 26 27 40l12 27" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
        <circle cx="122" cy="34" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M8 109h184" stroke="currentColor" opacity=".5" />
      </svg>
    )
  }
  if (variant === 'atelier') {
    return (
      <svg className="small-sketch-svg" viewBox="0 0 200 120" fill="none" aria-hidden="true">
        <path d="M15 105V21h67v84m18 0V9h77v96M18 54h62m20-15h75M48 105V72h34m47 33V66h46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 109h182M100 12l10-5" stroke="currentColor" opacity=".5" />
      </svg>
    )
  }
  if (variant === 'ceramics') {
    return (
      <svg className="small-sketch-svg" viewBox="0 0 200 120" fill="none" aria-hidden="true">
        <path d="M43 28c-2 15-4 40 0 60 3 15 16 21 35 21s32-6 35-21c4-20 2-45 0-60M39 28c0-8 78-8 78 0 0 9-78 9-78 0Zm103 19c-3 15-9 44-6 52 2 8 10 10 25 10s23-2 25-10c3-8-3-37-6-52m-38 0c0-6 38-6 38 0 0 7-38 7-38 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 110h176" stroke="currentColor" opacity=".5" />
      </svg>
    )
  }
  return (
    <svg className="small-sketch-svg" viewBox="0 0 200 120" fill="none" aria-hidden="true">
      <path d="M36 45h84v32c0 20-15 32-42 32S36 97 36 77V45Zm85 8h23c17 0 18 27-23 31M31 45h95M50 28c-5-11 8-13 2-23m24 22c-5-11 8-13 2-23m24 23c-5-11 8-13 2-23m-84 106h145" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A finished example site in miniature. */
export function SiteThumbnail({ variant, sketchInset = false }: { variant: ExampleId; sketchInset?: boolean }) {
  const site = EXAMPLES[variant]
  return (
    <div className={`site-thumbnail thumbnail-${variant}`}>
      <div className="thumbnail-image" style={{ backgroundImage: `url(${site.image})` }} />
      <div className="thumbnail-shade" />
      <div className="thumbnail-nav">
        <span>{site.name}</span>
        <span className="thumbnail-nav-right">MENU&nbsp; +</span>
      </div>
      <div className="thumbnail-copy">
        <span className="thumbnail-kicker">{site.category}</span>
        <strong>{site.headline}</strong>
        <span className="thumbnail-link">
          Explore <ArrowUpRight size={12} />
        </span>
      </div>
      {sketchInset && (
        <div className="thumbnail-sketch">
          <SmallSketch variant={variant} />
        </div>
      )}
    </div>
  )
}

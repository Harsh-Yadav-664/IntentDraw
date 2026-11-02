'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { cx } from './kit'

/* --------------------------------------------------------------------------
   The one organic element in the interface: hand-drawn pencil strokes.
   Every path below is written by hand and animated with a path length so it
   is *drawn* rather than faded in.
   -------------------------------------------------------------------------- */

const PENCIL = {
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
}

/** The scene the whole product is built around: sun rising between two
 *  mountains with a river running toward the viewer. */
export const SCENE_PATHS = {
  leftRidge: 'M4 232 C 46 194 84 152 118 112 C 126 102 132 92 138 76 C 148 96 162 116 180 138 C 194 156 206 174 218 194',
  rightRidge: 'M218 194 C 232 172 250 146 264 126 C 272 114 278 104 284 92 C 296 112 314 138 336 162 C 358 186 378 210 396 232',
  sun: 'M201 83 C 223 82 238 101 236 122 C 234 142 219 157 198 156 C 178 155 163 140 164 120 C 165 100 181 85 201 83 Z',
  rays: ['M198 70 L 197 54', 'M243 82 L 254 71', 'M252 122 L 268 121', 'M155 82 L 145 71', 'M150 122 L 134 121', 'M170 62 L 164 50'],
  riverLeft: 'M186 192 C 180 214 168 238 142 262',
  riverRight: 'M232 192 C 238 216 254 238 276 262',
  water: ['M182 212 C 194 208 206 216 220 211', 'M170 232 C 186 227 202 237 219 231', 'M156 252 C 176 246 196 258 217 250'],
  bankLeft: 'M2 200 C 62 194 122 198 178 194',
  bankRight: 'M236 194 C 292 198 342 192 398 199',
}

const ALL_SCENE_PATHS: string[] = [
  SCENE_PATHS.leftRidge,
  SCENE_PATHS.rightRidge,
  SCENE_PATHS.sun,
  ...SCENE_PATHS.rays,
  SCENE_PATHS.riverLeft,
  SCENE_PATHS.riverRight,
  ...SCENE_PATHS.water,
  SCENE_PATHS.bankLeft,
  SCENE_PATHS.bankRight,
]

export function SketchScene({
  className,
  stroke = 'var(--c-ink)',
  width = 2,
  opacity = 0.85,
  animate = true,
  preserveAspectRatio,
}: {
  className?: string
  stroke?: string
  width?: number
  opacity?: number
  animate?: boolean
  preserveAspectRatio?: string
}) {
  return (
    <svg viewBox="0 0 400 260" className={className} preserveAspectRatio={preserveAspectRatio} aria-hidden="true">
      {ALL_SCENE_PATHS.map((d, i) =>
        animate ? (
          <motion.path
            key={i}
            d={d}
            {...PENCIL}
            stroke={stroke}
            strokeWidth={width}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity }}
            transition={{ duration: 0.65, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : (
          <path key={i} d={d} {...PENCIL} stroke={stroke} strokeWidth={width} opacity={opacity} />
        ),
      )}
    </svg>
  )
}

/** Layout boxes drawn in the same hand — these are the regions read as layout. */
export function SketchBoxes({ className, animate = true, preserveAspectRatio }: { className?: string; animate?: boolean; preserveAspectRatio?: string }) {
  const boxes = [
    { x: 22, y: 18, w: 356, h: 30, label: 'R1' },
    { x: 22, y: 176, w: 168, h: 62, label: 'R2' },
    { x: 210, y: 176, w: 168, h: 62, label: 'R3' },
  ]
  return (
    <svg viewBox="0 0 400 260" className={className} preserveAspectRatio={preserveAspectRatio} aria-hidden="true">
      {boxes.map((b, i) => (
        <g key={b.label}>
          {animate ? (
            <motion.rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="3"
              fill="none"
              stroke="var(--c-accent)"
              strokeWidth="1.4"
              strokeDasharray="7 5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.75 }}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.12 }}
            />
          ) : (
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3" fill="none" stroke="var(--c-accent)" strokeWidth="1.4" strokeDasharray="7 5" opacity="0.75" />
          )}
          <rect x={b.x} y={b.y - 12} width="24" height="13" rx="3" fill="var(--c-accent)" />
          <text x={b.x + 12} y={b.y - 2.5} textAnchor="middle" fontSize="8.5" fontFamily="var(--app-font-mono)" fill="var(--c-onaccent)" letterSpacing="0.5">
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Hand-drawn underline used under display headings. */
export function RoughUnderline({ className, stroke = 'var(--c-accent)', delay = 0 }: { className?: string; stroke?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 300 14" className={className} preserveAspectRatio="none" aria-hidden="true">
      <motion.path
        d="M3 9 C 42 4, 78 11, 118 7 C 158 3, 196 11, 236 6 C 258 3.5, 278 7, 297 5"
        {...PENCIL}
        stroke={stroke}
        strokeWidth="3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

/** Progress bar drawn as a pencil stroke filling in. */
export function StrokeProgress({ progress, className }: { progress: number; className?: string }) {
  return (
    <svg viewBox="0 0 300 10" className={className} preserveAspectRatio="none" aria-hidden="true">
      <path d="M2 6 C 60 3, 120 8, 180 5 C 226 2.6, 262 7, 298 4" {...PENCIL} stroke="var(--c-line2)" strokeWidth="2" />
      <motion.path
        d="M2 6 C 60 3, 120 8, 180 5 C 226 2.6, 262 7, 298 4"
        {...PENCIL}
        stroke="var(--c-accent)"
        strokeWidth="2.4"
        initial={false}
        animate={{ pathLength: Math.max(0.01, Math.min(1, progress)) }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </svg>
  )
}

/** The logo mark: a drafting square crossed by one freehand stroke. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3.4 3.2 L 20.6 3.6 L 20.2 20.8 L 3.1 20.3 Z" {...PENCIL} stroke="var(--c-ink)" strokeWidth="1.5" opacity="0.55" />
      <path d="M4.2 19.4 C 8 14.2, 11.6 10.6, 19.6 4.2" {...PENCIL} stroke="var(--c-accent)" strokeWidth="2" />
      <path d="M15.6 4.6 L 19.8 4.1 L 19.3 8.3" {...PENCIL} stroke="var(--c-accent)" strokeWidth="1.6" />
    </svg>
  )
}

export function Wordmark({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cx('group inline-flex items-baseline gap-[1px] leading-none', className)} aria-label="IntentDraw home">
      <span className="font-display text-[22px] tracking-[-0.02em] text-ink">Intent</span>
      <span className="relative font-display text-[22px] italic tracking-[-0.02em] text-accent">
        Draw
        <svg viewBox="0 0 60 8" className="absolute -bottom-[3px] left-0 h-[6px] w-full" aria-hidden="true">
          <path d="M1 5 C 12 2, 22 7, 33 4 C 43 1.6, 52 6, 59 3" {...PENCIL} stroke="var(--c-accent)" strokeWidth="1.8" opacity="0.85" />
        </svg>
      </span>
    </Link>
  )
}

/** Empty-state illustration: a rough frame resolving into a crisp one. */
export function SketchEmptyState({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <motion.path
        d="M18 12 C 82 8, 158 16, 222 11 C 228 52, 224 100, 226 138 C 160 142, 82 134, 16 139 C 20 98, 14 54, 18 12 Z"
        {...PENCIL}
        stroke="var(--c-line2)"
        strokeWidth="1.6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        d="M40 108 C 62 88, 78 74, 94 56 C 102 66, 112 78, 124 90 C 136 78, 150 62, 162 50 C 178 74, 196 96, 210 112"
        {...PENCIL}
        stroke="var(--c-ink)"
        strokeWidth="1.6"
        opacity="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx="130"
        cy="46"
        r="15"
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth="1.6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      />
    </svg>
  )
}

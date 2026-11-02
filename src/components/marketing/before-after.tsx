'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'
import { SketchBoxes, SketchScene } from '@/components/kit/sketch'
import { DemoSite } from './demo-site'

/**
 * Sketch on the left, finished site on the right, a pencil stroke between
 * them. It sweeps open on its own once, then the visitor drags it.
 */

const MIN = 7
const MAX = 93
const EASE = '1000ms cubic-bezier(0.22, 1, 0.36, 1)'

export function BeforeAfter() {
  const reduce = useReducedMotion()
  const [pct, setPct] = useState(100)
  const [dragging, setDragging] = useState(false)
  const [smooth, setSmooth] = useState(true)
  const [width, setWidth] = useState(1280)
  const ref = useRef<HTMLDivElement>(null)

  // The finished site is a 1280px page; scale it to the band's width.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth || 1280)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Open once on arrival so the visitor sees both halves without touching it.
  useEffect(() => {
    const t = setTimeout(() => setPct(57), reduce ? 0 : 1100)
    return () => clearTimeout(t)
  }, [reduce])

  const set = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPct(Math.min(MAX, Math.max(MIN, ((clientX - r.left) / r.width) * 100)))
  }
  const transition = smooth && !reduce

  return (
    <div
      ref={ref}
      className="relative aspect-[16/9] max-h-[78vh] w-full touch-none select-none overflow-hidden rounded-[14px] border border-[#34362d] bg-bg2"
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        setSmooth(false)
        setDragging(true)
        set(e.clientX)
      }}
      onPointerMove={(e) => dragging && set(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      style={{ cursor: 'ew-resize' }}
    >
      {/* the sketch */}
      <div className="sketch-field absolute inset-0">
        <SketchScene className="absolute inset-0 h-full w-full" width={2.1} opacity={0.72} preserveAspectRatio="xMidYMid meet" animate={!reduce} />
        <SketchBoxes className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" animate={!reduce} />
        <div className="mono-label absolute left-5 top-5 rounded-full border border-line2 bg-bg/70 px-2.5 py-1.5 text-faint">Sketch</div>
      </div>

      {/* the site it became */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${pct}%)`, transition: transition ? `clip-path ${EASE}` : 'none' }}
      >
        <div style={{ width: 1280, transform: `scale(${width / 1280})`, transformOrigin: 'top left' }}>
          <DemoSite />
        </div>
        <div className="mono-label absolute right-5 top-5 rounded-full border border-line2 bg-black/50 px-2.5 py-1.5 text-white/80">Shipped</div>
      </div>

      {/* pencil-stroke divider */}
      <div className="absolute inset-y-0 z-20" style={{ left: `${pct}%`, transition: transition ? `left ${EASE}` : 'none' }}>
        <svg className="h-full w-[14px] -translate-x-1/2" viewBox="0 0 14 400" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M7 0 C 5 40, 9 80, 7 120 C 5 160, 9 200, 7 240 C 5 280, 9 320, 7 360 C 6 380, 7 392, 7 400"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare the sketch with the finished site"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setSmooth(true)
              setPct((p) => Math.max(MIN, p - 4))
            }
            if (e.key === 'ArrowRight') {
              setSmooth(true)
              setPct((p) => Math.min(MAX, p + 4))
            }
          }}
          className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-accent bg-bg text-accent shadow-plate"
        >
          <MousePointer2 size={15} className="rotate-90" />
        </div>
      </div>
    </div>
  )
}

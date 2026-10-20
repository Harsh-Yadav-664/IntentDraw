'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RoughUnderline, SketchBoxes, SketchScene, StrokeProgress, Wordmark } from '@/components/kit/sketch'
import { DemoSite } from '@/components/marketing/demo-site'

/* The right-hand panel: a sketch that slowly resolves into the finished site. */
function ResolvingPanel() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<0 | 1>(0)
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), reduce ? 0 : 1600)
    return () => clearTimeout(t)
  }, [reduce])
  return (
    <div className="sketch-field relative h-full w-full overflow-hidden border-l border-line">
      <motion.div animate={{ opacity: phase === 0 ? 1 : 0 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0">
        <SketchScene className="absolute inset-0 h-full w-full" width={2} opacity={0.6} />
        <SketchBoxes className="absolute inset-0 h-full w-full" />
        {/* The reading belongs to the sketch: it fades out with it, so it never sits on top of the finished site. */}
        <div className="absolute left-10 top-10 max-w-[300px]">
          <div className="mono-label mb-3 text-faint">Fig. 02 · reading</div>
          <p className="font-display text-[26px] leading-[1.2] text-ink">A sun rising between two mountains, with a river flowing toward the viewer.</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {['Sun · picture', 'Peaks · R2+R3', 'River · picture'].map((t) => (
              <span key={t} className="inline-flex h-[22px] items-center rounded-full border border-line2 bg-bg/60 px-2.5 text-[11px] text-muted">
                {t}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: phase === 1 ? 1 : 0 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 overflow-hidden">
        <div style={{ width: 1280, transform: 'scale(0.86)', transformOrigin: 'top left' }}>
          <DemoSite />
        </div>
      </motion.div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/90 to-transparent px-8 pb-8 pt-16">
        <div className="mono-label mb-3 text-faint">{phase === 0 ? 'Reading the drawing…' : 'Built · one section at a time'}</div>
        <StrokeProgress progress={phase === 0 ? 0.38 : 1} className="h-[10px] w-full" />
      </div>
    </div>
  )
}

export function AuthShell({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 lg:px-16">
        <Wordmark />
        <div className="flex flex-1 items-center py-14">
          <div className="w-full max-w-[400px]">
            <div className="mono-label mb-5 text-faint">{eyebrow}</div>
            <h1 className="leading-[1.02]" style={{ fontSize: 'clamp(2.1rem, 3vw, 2.6rem)' }}>
              {title}
              <RoughUnderline className="mt-2 h-[9px] w-[160px]" delay={0.3} />
            </h1>
            <div className="mt-5 text-[13.5px] leading-[1.75] text-muted">{sub}</div>
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <div className="mono-label text-faint">© {new Date().getFullYear()} IntentDraw</div>
      </div>
      <div className="relative hidden lg:block">
        <ResolvingPanel />
      </div>
    </div>
  )
}

/** A form-level message: what went wrong, or that it worked. */
export function FormNote({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div className={tone === 'error' ? 'rounded-[10px] border border-danger/35 bg-danger/10 px-3.5 py-3 text-[12.5px] leading-[1.6] text-ink' : 'rounded-[10px] border border-ok/30 bg-ok/10 px-3.5 py-3 text-[12.5px] leading-[1.6] text-ink'} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

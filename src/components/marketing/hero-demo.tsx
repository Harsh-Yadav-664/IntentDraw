'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { HERO_SCENE_SVG, HERO_STROKES, HERO_VIEWBOX } from './hero-demo-data'

/**
 * The landing page's proof: a real drawing becoming a real site.
 *
 * The strokes are exactly what a user drew in IntentDraw, and the picture is
 * exactly what IntentDraw rendered from them — nothing here is mocked up. The
 * strokes draw themselves in, the scene arrives beneath them, and the reading
 * the understanding stage produced appears as a caption. CSS-only, runs once
 * (Replay restarts it), and shows the finished state straight away for people
 * who ask their OS for less motion.
 */
export function HeroDemo() {
  const [run, setRun] = useState(0)

  return (
    <div className="relative">
      <div
        key={run}
        className="hero-demo relative overflow-hidden rounded-2xl border border-white/10 bg-[#F4EDE1] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        {/* Browser chrome, so it reads as a website rather than an illustration. */}
        <div className="flex items-center gap-1.5 border-b border-black/10 bg-[#EDE3D3] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
          <span className="ml-3 rounded-md bg-black/5 px-3 py-0.5 text-[11px] text-black/40">artisan-market.site</span>
        </div>

        <div className="relative aspect-[1280/704]">
          <svg
            viewBox={HERO_VIEWBOX}
            preserveAspectRatio="xMidYMax slice"
            className="hero-scene absolute inset-0 h-full w-full"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: HERO_SCENE_SVG }}
          />

          <svg viewBox={HERO_VIEWBOX} className="absolute inset-0 h-full w-full" aria-hidden="true">
            {HERO_STROKES.map((d, i) => (
              <path
                key={i}
                d={d}
                pathLength={1}
                className="hero-stroke"
                style={{ animationDelay: `${0.15 + i * 0.28}s` }}
                fill="none"
                stroke="#1a1a1a"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {/* Kept small and high in the sky: the drawing is the point of the demo. */}
          <div className="hero-copy absolute inset-x-0 top-[5%] flex flex-col items-center px-6 text-center">
            <p className="font-display text-[clamp(0.85rem,1.7vw,1.35rem)] font-semibold leading-tight text-[#2F2620]">
              The craftsmanship of local makers
            </p>
            <span className="mt-2 rounded bg-[#D98E32] px-2.5 py-1 text-[9px] font-medium uppercase tracking-wide text-white">
              Explore collections
            </span>
          </div>
        </div>
      </div>

      <div className="hero-caption mt-4 flex items-start justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          <span className="text-foreground/80">What it understood:</span> “A sun rising between two mountains, with a
          river flowing toward the viewer.”
        </p>
        <button
          onClick={() => setRun(n => n + 1)}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Replay
        </button>
      </div>

      <style>{`
        .hero-stroke {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: hero-draw 0.9s ease-out forwards, hero-settle 0.8s ease-in 3.2s forwards;
        }
        .hero-scene { opacity: 0; animation: hero-in 1.1s ease-out 2.3s forwards; }
        .hero-copy { opacity: 0; transform: translateY(8px); animation: hero-rise 0.8s ease-out 3.4s forwards; }
        .hero-caption { opacity: 0; animation: hero-in 0.6s ease-out 3.8s forwards; }
        @keyframes hero-draw { to { stroke-dashoffset: 0; } }
        @keyframes hero-settle { to { opacity: 0.12; } }
        @keyframes hero-in { to { opacity: 1; } }
        @keyframes hero-rise { to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .hero-stroke, .hero-scene, .hero-copy, .hero-caption { animation: none !important; }
          .hero-stroke { stroke-dashoffset: 0; opacity: 0.12; }
          .hero-scene, .hero-copy, .hero-caption { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}

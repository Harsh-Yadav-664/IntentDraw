/**
 * Renders a sample generated component through the real preview pipeline and
 * writes it to an HTML file, so the iframe runtime (Babel transform, import
 * rewriting, GSAP, lucide) can be verified in a browser without calling any AI.
 *
 *   npx tsx scripts/preview-harness.ts [outfile]
 */
import { writeFileSync } from 'fs'
import { wrapReactForPreview } from '../src/lib/utils/sanitize'

// Deliberately exercises every rewrite path: named lucide import, named gsap
// import, default gsap import, plugin import, hooks with no React import, and a
// drawn-stroke svgPath animated both as a draw-on and as a motion path.
const SAMPLE = `
import React, { useEffect, useRef } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

const STROKE = "M 0 60 L 20 30 L 40 70 L 60 25 L 80 65 L 100 35";

export default function App() {
  const root = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.stagger-item', { y: 40, opacity: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out' });
      gsap.fromTo('.draw-path',
        { strokeDashoffset: 400 },
        { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut', repeat: -1, yoyo: true }
      );
      if (window.MotionPathPlugin) {
        gsap.to('.traveller', {
          duration: 4,
          repeat: -1,
          ease: 'none',
          motionPath: { path: '.draw-path', align: '.draw-path', alignOrigin: [0.5, 0.5] }
        });
      }
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="min-h-screen bg-slate-950 text-white p-12">
      <h1 className="stagger-item text-6xl font-black tracking-tighter">Runtime check</h1>
      <p className="stagger-item mt-4 text-slate-400">GSAP + lucide + hooks, no bundler.</p>
      <div className="stagger-item mt-6 flex items-center gap-3">
        <Sparkles className="text-purple-400" />
        <ArrowRight className="text-blue-400" />
        {/* Deliberately NOT imported — models forget, and it must still render */}
        <ChevronRight className="text-emerald-400" />
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-10 w-full h-64">
        <path className="draw-path" d={STROKE} fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="400" />
        <circle className="traveller" r="3" fill="#22d3ee" />
      </svg>
      <div id="probe" className="mt-8 text-sm text-slate-500" />
    </div>
  );
}
`

// Reports what actually resolved at runtime, so the browser check is not just visual.
const PROBE = `
<script>
  window.addEventListener('load', function () {
    setTimeout(function () {
      var el = document.getElementById('probe');
      if (!el) return;
      el.textContent =
        'gsap: ' + (typeof gsap) +
        ' | MotionPathPlugin: ' + (typeof MotionPathPlugin) +
        ' | ScrollTrigger: ' + (typeof ScrollTrigger) +
        ' | lucide: ' + (typeof window.lucide) +
        ' | rendered: ' + (typeof window.__RenderComponent);
    }, 1200);
  });
</script>
`

const out = process.argv[2] ?? 'preview-harness.html'
writeFileSync(out, wrapReactForPreview(SAMPLE).replace('</body>', `${PROBE}</body>`), 'utf8')
console.log(`wrote ${out}`)

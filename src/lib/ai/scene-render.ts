import type { Region } from '@/types'
import type { BriefElement, BriefPalette } from './brief'
import { CANVAS_WIDTH, buildSceneShape, sceneGround, sphereGeometry, type SphereGeometry } from './scene'
import { PAGE_CONFIG } from '@/lib/canvas/pages'

/**
 * Renders the user's drawing as a finished React component, in code.
 *
 * Giving the model exact geometry was not enough. Across real runs, two
 * different models took correct shapes and still painted the sun in front of
 * the mountains, faded the whole picture into the background colour, or turned
 * fills back into glowing outlines. The picture is the one part of the page the
 * user literally drew, so it is the one part that must not depend on which
 * model happened to answer.
 *
 * The model's job is now to place `<IntentScene />` and design the site around
 * it. Everything about the picture — geometry, layering, depth shading from the
 * brief's palette, light, and motion — is decided here.
 */

export const SCENE_COMPONENT = 'IntentScene'

const FALLBACK_PALETTE: BriefPalette = {
  background: '#F4EFE6',
  surface: '#E6DCCB',
  text: '#2B2622',
  accent: '#E8A33D',
  secondary: '#3F7F86',
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Linear blend of two hex colours; t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`.toUpperCase()
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * The land colour at a given distance. Nearest is the palette's text colour
 * nudged toward the secondary hue; each step back blends toward the
 * background — atmospheric perspective, which is what makes flat shapes read
 * as a landscape with depth. The nearest layer is darkened further if it can't
 * reach 3:1 against the background, so the picture always reads.
 */
function landColour(p: BriefPalette, rank: number, layers: number): string {
  const near = mix(p.text, p.secondary, 0.25)
  const t = layers <= 1 ? 0 : (rank / (layers - 1)) * 0.6 // 0 nearest → 0.6 farthest
  let colour = mix(near, p.background, t)
  if (rank === 0 && contrast(colour, p.background) < 3) colour = mix(colour, luminance(p.background) > 0.5 ? '#000000' : '#FFFFFF', 0.35)
  return colour
}

/** Pulls every `<circle .../>` or `<path .../>` out of a scene shape's markup. */
function parts(svg: string): string[] {
  return svg.match(/<(?:circle|path)[^>]*\/>/g) ?? []
}

/** Circle attributes, for positioning glow and rotation around the sun. */
function circleOf(markup: string): { cx: number; cy: number; r: number } | null {
  const m = markup.match(/cx="(-?\d+)" cy="(-?\d+)" r="(\d+)"/)
  return m ? { cx: +m[1], cy: +m[2], r: +m[3] } : null
}

/**
 * A live 3D sphere carrying the user's marks: it turns slowly on its own, and
 * follows the pointer, touch and scroll. Paths are rewritten through refs each
 * frame — no React re-render — and the loop stops when the page is frozen as
 * the editor's backdrop, or when the visitor prefers reduced motion (it still
 * follows the pointer then, it just doesn't spin by itself).
 */
function sphereComponent(name: string, id: string, g: SphereGeometry, p: BriefPalette): string {
  const body = mix(p.surface, p.background, 0.35)
  return `/* ${name}: the user's marks on a sphere — turns with pointer, touch and scroll. */
const ${name} = () => {
  const front = React.useRef<SVGPathElement | null>(null);
  const back = React.useRef<SVGPathElement | null>(null);
  const grid = React.useRef<SVGPathElement | null>(null);
  const dots = React.useRef<SVGPathElement | null>(null);
  React.useEffect(() => {
    const strokes: number[][][] = ${JSON.stringify(g.strokes)};
    const nodes: number[][] = ${JSON.stringify(g.nodes)};
    const CX = ${g.cx}, CY = ${g.cy}, R = ${g.r};
    const rings: number[][][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const a = (lat * Math.PI) / 180, ring: number[][] = [];
      for (let i = 0; i <= 48; i++) { const t = (i / 48) * Math.PI * 2; ring.push([Math.cos(a) * Math.cos(t), Math.sin(a), Math.cos(a) * Math.sin(t)]); }
      rings.push(ring);
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const b = (lon * Math.PI) / 180, ring: number[][] = [];
      for (let i = 0; i <= 48; i++) { const t = (i / 48) * Math.PI * 2; ring.push([Math.cos(t) * Math.cos(b), Math.sin(t), Math.cos(t) * Math.sin(b)]); }
      rings.push(ring);
    }
    const still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let mx = 0, my = 0, spin = 0, yaw = 0, pitch = -0.25, last = performance.now(), raf = 0;
    // A hidden frame can report a zero-sized window: never divide by it.
    const aim = (x: number, y: number) => { mx = x / Math.max(1, window.innerWidth) - 0.5; my = y / Math.max(1, window.innerHeight) - 0.5; };
    const onMouse = (e: MouseEvent) => aim(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) aim(t.clientX, t.clientY); };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    const frame = () => {
      const now = performance.now(), dt = Math.min(64, now - last);
      last = now;
      if (!still) spin += dt * 0.00025;
      yaw += (spin + mx * 1.4 + (window.scrollY || 0) * 0.003 - yaw) * 0.08;
      pitch += (-0.25 + my * 0.9 - pitch) * 0.08;
      if (!Number.isFinite(yaw + pitch)) { yaw = 0; pitch = -0.25; }
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const at = (q: number[]) => {
        const x1 = q[0] * cy + q[2] * sy, z1 = -q[0] * sy + q[2] * cy;
        return [CX + R * x1, CY + R * (q[1] * cp - z1 * sp), q[1] * sp + z1 * cp];
      };
      const trace = (list: number[][][]) => {
        let f = '', b = '';
        for (const line of list) {
          let prev: number[] | null = null;
          for (const q of line) {
            const c = at(q);
            if (prev) {
              const seg = 'M' + prev[0].toFixed(1) + ' ' + prev[1].toFixed(1) + 'L' + c[0].toFixed(1) + ' ' + c[1].toFixed(1);
              if (prev[2] + c[2] >= 0) f += seg; else b += seg;
            }
            prev = c;
          }
        }
        return [f, b];
      };
      const [sf, sb] = trace(strokes);
      let d = '';
      for (const n of nodes) {
        const c = at(n);
        if (c[2] >= 0) d += 'M' + (c[0] - 4.5).toFixed(1) + ' ' + c[1].toFixed(1) + 'a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0';
      }
      front.current?.setAttribute('d', sf);
      back.current?.setAttribute('d', sb);
      grid.current?.setAttribute('d', trace(rings)[0]);
      dots.current?.setAttribute('d', d);
      if (!(window as any).__intentdrawFrozen) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);
  return (
    <g>
      <defs>
        <radialGradient id="${id}-body" cx="35%" cy="30%" r="80%"><stop offset="0%" stopColor="${mix(body, '#FFFFFF', 0.18)}" /><stop offset="65%" stopColor="${body}" /><stop offset="100%" stopColor="${mix(body, '#000000', 0.35)}" /></radialGradient>
        <radialGradient id="${id}-halo"><stop offset="62%" stopColor="${p.accent}" stopOpacity="0.22" /><stop offset="100%" stopColor="${p.accent}" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx={${g.cx}} cy={${g.cy}} r={${Math.round(g.r * 1.4)}} fill="url(#${id}-halo)" />
      <circle cx={${g.cx}} cy={${g.cy}} r={${g.r}} fill="url(#${id}-body)" />
      <path ref={grid} fill="none" stroke="${p.text}" strokeOpacity={0.14} strokeWidth={1} />
      <path ref={back} fill="none" stroke="${p.accent}" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={front} fill="none" stroke="${p.accent}" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={dots} fill="${mix(p.accent, '#FFFFFF', 0.35)}" />
      <circle cx={${g.cx}} cy={${g.cy}} r={${g.r}} fill="none" stroke="${p.accent}" strokeOpacity={0.4} strokeWidth={1.5} />
    </g>
  );
};`
}

const jsxAttrs = (tag: string, attrs: string) => tag.replace(/\s*\/>$/, ` ${attrs} />`).replace('data-part="rays" ', '')

/**
 * The component source, or '' when the brief has nothing to draw. Deterministic
 * for a given brief and drawing, so re-rendering never changes the picture.
 */
export function renderSceneComponent(
  elements: BriefElement[],
  regions: Region[],
  palette: BriefPalette | null
): string {
  // Decorations are drawn too: with the page shell built in code, nothing else
  // would paint the strokes the user drew as ornament, and they would vanish.
  const art = elements
    .filter(e => e.role === 'illustration' || e.role === 'motion' || e.role === 'decoration')
    .map(e => (e.role === 'decoration' ? { ...e, form: e.form ?? ('line' as const) } : e))
  if (art.length === 0) return ''
  const p = palette ?? FALLBACK_PALETTE

  const members = regions.filter(r => art.some(e => e.regions.includes(r.regionNumber)))
  const ground = sceneGround(members)

  // A landscape stands on the bottom edge of its frame — the ground line. Any
  // other picture keeps its drawn position on the page it was drawn on, so a
  // globe drawn top-right of page 1 sits top-right of the first screen.
  const landscape = art.some(e => e.form === 'silhouette' || e.form === 'band')
  const top = Math.min(...members.map(r => r.geometry.y))
  const pageH = PAGE_CONFIG.pageHeight
  const frameY = landscape ? 0 : Math.floor(top / pageH) * pageH
  const frameH = landscape ? ground : Math.max(pageH, Math.ceil((ground - frameY) / pageH) * pageH)
  const spheres: string[] = []

  // Sky bodies behind land behind water, then the model's own depth within each.
  const tier = (e: BriefElement) => (e.form === 'disc' || e.form === 'rays' ? 0 : e.form === 'band' || e.form === 'line' ? 2 : 1)
  const ordered = [...art].sort((a, b) => tier(a) - tier(b) || a.depth - b.depth)

  // Every land shape across all land elements, farthest first. Within one
  // element (two mountains drawn as "Mountains"), the taller peak is treated as
  // farther away — otherwise both got the identical colour and merged into one
  // shapeless mass.
  const topOf = (markup: string) => Math.min(...(markup.match(/-?\d+/g) ?? []).map(Number).filter((_, i) => i % 2 === 1))
  const landParts: string[] = []
  for (const e of ordered) {
    if (e.form !== 'silhouette' && e.form !== 'shape') continue
    const shape = buildSceneShape({ name: e.name, form: e.form, regionNumbers: e.regions }, regions, ground)
    if (shape) landParts.push(...parts(shape.svg).sort((a, b) => topOf(a) - topOf(b)))
  }
  // A sky tinted by the accent toward the top: warm light near a sun, and it
  // keeps the picture a picture rather than shapes floating on a flat page.
  const defs: string[] = [
    `<linearGradient id="is-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="${mix(p.background, p.accent, 0.22)}" /><stop offset="100%" stopColor="${p.background}" /></linearGradient>`,
  ]
  const body: string[] = [`<rect y="${frameY}" width="${CANVAS_WIDTH}" height="${frameH}" fill="url(#is-sky)" />`]
  const css: string[] = []
  let uid = 0

  for (const element of ordered) {
    if (!element.form) continue
    const shape = buildSceneShape({ name: element.name, form: element.form, regionNumbers: element.regions }, regions, ground)
    if (!shape) continue
    const id = `is${uid++}`
    const moving = !!element.motion
    const label = `{/* ${element.name.replace(/\*\//g, '')} */}`

    switch (element.form) {
      case 'disc': {
        const circles = parts(shape.svg).filter(s => s.startsWith('<circle'))
        const rays = parts(shape.svg).filter(s => s.includes('data-part="rays"'))
        const sun = circleOf(circles[0] ?? '')
        defs.push(
          `<radialGradient id="${id}-core"><stop offset="0%" stopColor="${mix(p.accent, '#FFFFFF', 0.55)}" /><stop offset="70%" stopColor="${p.accent}" /><stop offset="100%" stopColor="${mix(p.accent, p.text, 0.15)}" /></radialGradient>`,
          `<radialGradient id="${id}-glow"><stop offset="0%" stopColor="${p.accent}" stopOpacity="0.45" /><stop offset="100%" stopColor="${p.accent}" stopOpacity="0" /></radialGradient>`
        )
        body.push(label)
        if (sun) {
          body.push(
            `<circle className="${moving ? `${id}-pulse` : ''}" cx="${sun.cx}" cy="${sun.cy}" r="${Math.round(sun.r * 1.7)}" fill="url(#${id}-glow)" style={{ transformOrigin: '${sun.cx}px ${sun.cy}px' }} />`
          )
          if (moving) {
            css.push(`@keyframes ${id}-pulse { 0%,100% { transform: scale(1); opacity: .85 } 50% { transform: scale(1.08); opacity: 1 } }`, `.${id}-pulse { animation: ${id}-pulse 6s ease-in-out infinite }`)
          }
        }
        if (rays.length > 0) {
          const ringClass = moving && sun ? `${id}-spin` : ''
          body.push(`<g className="${ringClass}"${sun ? ` style={{ transformOrigin: '${sun.cx}px ${sun.cy}px' }}` : ''}>`)
          rays.forEach(r => body.push('  ' + jsxAttrs(r, `fill="none" stroke="${p.accent}" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"`)))
          body.push('</g>')
          // Rock, don't spin: rays drawn over a rising sun are a half-ring, and a
          // full turn would sweep them under the horizon and leave a gap.
          if (ringClass) css.push(`@keyframes ${id}-spin { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }`, `.${id}-spin { animation: ${id}-spin 12s ease-in-out infinite }`)
        }
        circles.forEach(c => body.push(jsxAttrs(c, `fill="url(#${id}-core)"`)))
        break
      }
      case 'rays': {
        // Standalone rays have no known centre to turn around, so they shimmer
        // rather than spin.
        const pulse = moving ? `${id}-glint` : ''
        body.push(label)
        parts(shape.svg).forEach(s => body.push(jsxAttrs(s, `fill="none" stroke="${p.accent}" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" className="${pulse}"`)))
        if (pulse) css.push(`@keyframes ${id}-glint { 0%,100% { opacity: .65 } 50% { opacity: 1 } }`, `.${id}-glint { animation: ${id}-glint 4s ease-in-out infinite }`)
        break
      }
      case 'silhouette':
      case 'shape': {
        body.push(label)
        parts(shape.svg)
          .sort((a, b) => topOf(a) - topOf(b))
          .forEach((part, i) => {
            const rank = landParts.length - 1 - landParts.indexOf(part) // 0 = nearest
            const colour = landColour(p, Math.max(0, rank), landParts.length)
            const gid = `${id}-${i}`
            defs.push(
              `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="${mix(colour, '#FFFFFF', 0.12)}" /><stop offset="100%" stopColor="${mix(colour, '#000000', 0.18)}" /></linearGradient>`
            )
            body.push(jsxAttrs(part, `fill="url(#${gid})"`))
          })
        break
      }
      case 'band': {
        const water = p.secondary
        body.push(label)
        if (shape.paint === 'fill') {
          defs.push(
            `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="${mix(water, '#FFFFFF', 0.35)}" /><stop offset="100%" stopColor="${mix(water, '#000000', 0.15)}" /></linearGradient>`
          )
          parts(shape.svg).forEach(s => {
            body.push(jsxAttrs(s, `fill="url(#${id})"`))
            if (moving) {
              // Light glinting on the surface, travelling with the flow.
              body.push(jsxAttrs(s, `fill="none" stroke="${mix(water, '#FFFFFF', 0.7)}" strokeWidth={3} strokeDasharray="14 46" strokeLinecap="round" opacity={0.7} className="${id}-flow"`))
            }
          })
          if (moving) css.push(`@keyframes ${id}-flow { to { stroke-dashoffset: -600 } }`, `.${id}-flow { animation: ${id}-flow 9s linear infinite }`)
        } else {
          parts(shape.svg).forEach(s => body.push(jsxAttrs(s, `fill="none" stroke="${water}" strokeWidth={10} strokeLinecap="round"`)))
        }
        break
      }
      case 'line': {
        body.push(label)
        if (element.role === 'motion') {
          // A motion path is a guide, not a drawing: a small marker travels it.
          const d = parts(shape.svg)[0]?.match(/d="([^"]+)"/)?.[1]
          if (d) {
            body.push(`<path id="${id}-track" d="${d}" fill="none" stroke="none" />`)
            body.push(`<circle r="7" fill="${p.accent}"><animateMotion dur="8s" repeatCount="indefinite" rotate="auto"><mpath href="#${id}-track" /></animateMotion></circle>`)
          }
        } else if (element.role === 'decoration') {
          // Ornament in the accent colour; a moving one draws light along itself.
          parts(shape.svg).forEach(s => {
            body.push(jsxAttrs(s, `fill="none" stroke="${p.accent}" strokeOpacity={0.85} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"`))
            if (moving) body.push(jsxAttrs(s, `fill="none" stroke="${mix(p.accent, '#FFFFFF', 0.6)}" strokeWidth={3} strokeLinecap="round" strokeDasharray="24 180" className="${id}-flow"`))
          })
          if (moving) css.push(`@keyframes ${id}-flow { to { stroke-dashoffset: -820 } }`, `.${id}-flow { animation: ${id}-flow 7s linear infinite }`)
        } else {
          parts(shape.svg).forEach(s => body.push(jsxAttrs(s, `fill="none" stroke="${mix(p.text, p.background, 0.2)}" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"`)))
        }
        break
      }
      case 'sphere': {
        const geo = sphereGeometry(element.regions, regions)
        if (!geo) break
        const name = `${SCENE_COMPONENT}Sphere${spheres.length}`
        spheres.push(sphereComponent(name, id, geo, p))
        body.push(label, `<${name} />`)
        break
      }
    }
  }

  if (body.length <= 1) return '' // only the sky: nothing was drawable

  // Respect users who ask the OS for less motion.
  if (css.length > 0) css.push('@media (prefers-reduced-motion: reduce) { .intent-scene * { animation: none !important } }')

  const indent = (lines: string[], n: number) => lines.map(l => ' '.repeat(n) + l).join('\n')
  return `${spheres.map(c => c + '\n\n').join('')}/* ${SCENE_COMPONENT}: the user's drawing, rendered by IntentDraw — geometry, layering and colour are fixed. */
const ${SCENE_COMPONENT} = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 ${frameY} ${CANVAS_WIDTH} ${frameH}"
    preserveAspectRatio="${landscape ? 'xMidYMax slice' : 'xMidYMid slice'}"
    aria-hidden="true"
    className={\`intent-scene block w-full h-full \${className}\`}
  >
    <defs>
${indent(defs, 6)}
    </defs>
${css.length > 0 ? `    <style>{\`${css.join(' ')}\`}</style>\n` : ''}${indent(body, 4)}
  </svg>
);`
}

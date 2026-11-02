import type { Region } from '@/types'
import type { BriefElement, BriefPalette } from './brief'
import { CANVAS_WIDTH, buildSceneShape, sceneGround, sphereGeometry, type SceneForm, type SphereGeometry } from './scene'
import { PAGE_CONFIG } from '@/lib/canvas/pages'
import type { SiteDesign } from './site-design'

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
 * brief's palette, light, finish (`sceneStyle`) and motion — is decided here.
 */

export const SCENE_COMPONENT = 'IntentScene'

const FALLBACK_PALETTE: BriefPalette = {
  background: '#F4EFE6',
  surface: '#E6DCCB',
  text: '#2B2622',
  accent: '#E8A33D',
  secondary: '#3F7F86',
}

export function hexToRgb(hex: string): [number, number, number] {
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
export function sphereComponent(name: string, id: string, g: SphereGeometry, p: BriefPalette): string {
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
      // Sway rather than spin: the user's marks are drawn on the front, so a
      // full turn would spend half its time showing an empty back. Pointer and
      // scroll turn it further.
      if (!still) spin += dt * 0.0004;
      yaw += (Math.sin(spin) * 0.55 + mx * 1.3 + (window.scrollY || 0) * 0.0018 - yaw) * 0.08;
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
        if (c[2] >= 0) d += 'M' + (c[0] - 5.5).toFixed(1) + ' ' + c[1].toFixed(1) + 'a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0';
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
      <path ref={front} fill="none" stroke="${p.accent}" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={dots} fill="${mix(p.accent, '#FFFFFF', 0.35)}" />
      <circle cx={${g.cx}} cy={${g.cy}} r={${g.r}} fill="none" stroke="${p.accent}" strokeOpacity={0.4} strokeWidth={1.5} />
    </g>
  );
};`
}

const jsxAttrs = (tag: string, attrs: string) => tag.replace(/\s*\/>$/, ` ${attrs} />`).replace('data-part="rays" ', '')

// =============================================================================
// Art direction
// =============================================================================

/**
 * How the picture is finished. It follows the site's own surface language, so
 * the drawing and the page read as one piece, and two sites with the same
 * drawing don't come out identical:
 *   painterly — soft light, atmospheric haze between layers, film grain
 *   papercut  — solid layers casting shadows on the ones behind, grain
 *   line-art  — the user's own strokes drawn on, over pale tinted fills
 *   flat      — solid colour, no gradients
 * Every style is built from the drawing's measured geometry: nothing here
 * knows what the picture depicts, only which parts are round, which close to
 * the ground, and which are near or far.
 */
export type SceneStyle = 'painterly' | 'papercut' | 'line-art' | 'flat'
export const SCENE_STYLES: readonly SceneStyle[] = ['painterly', 'papercut', 'line-art', 'flat']

export function sceneStyle(design?: Pick<SiteDesign, 'surfaces'> | null): SceneStyle {
  switch (design?.surfaces) {
    case 'flat':
      return 'flat'
    case 'outlined':
      return 'line-art'
    case 'hard-shadow':
    case 'layered':
      return 'papercut'
    default:
      return 'painterly'
  }
}

export interface SceneTones {
  dark: boolean
  /** Sky at the top of the frame, and the glow where it meets the ground. */
  skyTop: string
  horizon: string
  /** Land colours, index 0 = nearest. */
  land: string[]
}

/**
 * The picture's colours from the brief's palette. Distance is atmospheric
 * perspective: far layers fade toward the horizon glow, the nearest one is the
 * strongest. On a dark page the land is darker than the glow behind it (a
 * skyline at dusk), on a light page darker than the pale sky — either way the
 * nearest ridge keeps at least 3:1 against the light it is drawn over. A run
 * on a dark palette used to get pale grey slabs on a navy page.
 */
export function sceneTones(p: BriefPalette, layers: number): SceneTones {
  const dark = luminance(p.background) < 0.18
  const skyTop = dark ? mix(p.background, '#000000', 0.2) : mix(p.background, p.secondary, 0.14)
  let horizon = dark ? mix(p.background, mix(p.accent, p.secondary, 0.5), 0.42) : mix(p.background, p.accent, 0.28)
  let near = dark ? mix(mix(p.background, p.secondary, 0.5), '#000000', 0.3) : mix(p.text, p.secondary, 0.35)
  for (let i = 0; i < 6 && contrast(near, horizon) < 3; i++) {
    near = mix(near, '#000000', 0.25)
    if (dark) horizon = mix(horizon, '#FFFFFF', 0.12)
  }
  const n = Math.max(1, layers)
  const land = Array.from({ length: n }, (_, rank) => mix(near, horizon, n <= 1 ? 0 : (rank / (n - 1)) * 0.68))
  return { dark, skyTop, horizon, land }
}

/**
 * The text colour that stays readable over every colour in the picture: one
 * of the palette's own colours when it reaches 4.5:1 against all of them,
 * otherwise whichever candidate comes closest.
 */
export function textOverArt(palette: BriefPalette | null): string {
  const p = palette ?? FALLBACK_PALETTE
  const t = sceneTones(p, 3)
  const tones = [t.skyTop, t.horizon, ...t.land, p.accent]
  const worst = (c: string) => Math.min(...tones.map(x => contrast(c, x)))
  const own = [p.text, p.background, p.surface].sort((a, b) => worst(b) - worst(a))[0]
  if (worst(own) >= 4.5) return own
  return [own, '#FFFFFF', '#0B0B0C'].sort((a, b) => worst(b) - worst(a))[0]
}

interface Layer {
  /** 0 = as far as the sky, 1 = nearest: how strongly it answers scroll and pointer. */
  depth: number
  lines: string[]
}

/** Film grain: a tiny noise tile, URL-encoded so the string needs no escaping. */
const GRAIN = `url('data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1 0"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>'
)}')`

/**
 * Motion for the whole picture, in one effect: layers rise into place and the
 * user's strokes draw themselves on when the page opens; afterwards each layer
 * answers scroll and pointer by its depth. On a picture fixed behind the page
 * the near layers sink as you scroll (the camera rises); behind one section
 * the far layers lag behind it.
 *
 * Driven by requestAnimationFrame, and every style it sets is written inside a
 * frame: where frames never run (a hidden tab, a headless capture) the picture
 * simply stays at its finished state. A Web Animations intro used to leave the
 * land at 20% opacity there, with the sun showing through it. Nothing runs for
 * a visitor who prefers reduced motion, and freezing the editor backdrop jumps
 * straight to the end.
 */
function motionEffect(fixed: boolean): string {
  return `  const root = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const host = root.current;
    const w = window as any;
    if (!host || w.__intentdrawFrozen) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rise = Array.from(host.querySelectorAll('[data-rise]')) as any[];
    const draws = (Array.from(host.querySelectorAll('[data-draw]')) as any[])
      .map(p => { let len = 0; try { len = Math.ceil(p.getTotalLength()); } catch (e) {} return { p, len }; })
      .filter(d => d.len > 0);
    const layers = Array.from(host.querySelectorAll('[data-depth]')) as any[];
    const fine = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
    let start = 0, intro = true, mx = 0, my = 0, x = 0, y = 0, s = 0, raf = 0;
    const settle = () => {
      intro = false;
      rise.forEach(g => { g.style.transform = ''; g.style.opacity = ''; });
      draws.forEach(d => { d.p.style.strokeDasharray = ''; d.p.style.strokeDashoffset = ''; });
    };
    const tick = (now: number) => {
      raf = 0;
      if (w.__intentdrawFrozen) { settle(); return; }
      if (intro) {
        if (!start) start = now;
        const t = now - start;
        let done = true;
        rise.forEach((g, i) => {
          const k = ease((t - 140 * i) / 1600);
          if (k < 1) done = false;
          g.style.transform = 'translateY(' + (36 * (1 - k)).toFixed(2) + 'px)';
          g.style.opacity = String(0.2 + 0.8 * k);
        });
        draws.forEach((d, i) => {
          const k = ease((t - 250 - 110 * i) / 2200);
          if (k < 1) done = false;
          d.p.style.strokeDasharray = d.len + ' ' + d.len;
          d.p.style.strokeDashoffset = String(d.len * (1 - k));
        });
        if (done) settle();
      }
      const target = Math.min(3000, window.scrollY || 0);
      x += (mx - x) * 0.07; y += (my - y) * 0.07; s += (target - s) * 0.12;
      for (const g of layers) {
        const d = Number(g.getAttribute('data-depth')) || 0;
        const lift = ${fixed ? 's * 0.06 * d' : 's * 0.3 * (1 - d)'};
        g.style.transform = 'translate(' + (-x * 28 * d).toFixed(2) + 'px,' + (lift - y * 10 * d).toFixed(2) + 'px) scale(' + (1 + 0.04 * d).toFixed(3) + ')';
      }
      if (intro || Math.abs(mx - x) + Math.abs(my - y) > 0.002 || Math.abs(target - s) > 0.5) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    // A hidden frame can report a zero-sized window: never divide by it.
    const onMove = (e: MouseEvent) => { mx = e.clientX / Math.max(1, window.innerWidth) - 0.5; my = e.clientY / Math.max(1, window.innerHeight) - 0.5; kick(); };
    window.addEventListener('scroll', kick, { passive: true });
    if (fine) window.addEventListener('mousemove', onMove, { passive: true });
    kick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', kick);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);`
}

export interface SceneOptions {
  /** The site's design choices; the picture's finish follows its surfaces. */
  design?: Pick<SiteDesign, 'surfaces'> | null
  /** Overrides the style the design implies. */
  style?: SceneStyle
}

/**
 * The component source, or '' when the brief has nothing to draw. Deterministic
 * for a given brief and drawing, so re-rendering never changes the picture.
 */
export function renderSceneComponent(
  elements: BriefElement[],
  regions: Region[],
  palette: BriefPalette | null,
  options: SceneOptions = {}
): string {
  // Decorations are drawn too: with the page shell built in code, nothing else
  // would paint the strokes the user drew as ornament, and they would vanish.
  const art = elements
    .filter(e => e.role === 'illustration' || e.role === 'motion' || e.role === 'decoration')
    .map(e => (e.role === 'decoration' ? { ...e, form: e.form ?? ('line' as const) } : e))
    // Objects are built and placed by objects.ts, not painted here.
    .filter((e): e is BriefElement & { form: SceneForm | null } => e.form !== 'cube')
  if (art.length === 0) return ''
  const p = palette ?? FALLBACK_PALETTE
  const style = options.style ?? sceneStyle(options.design)
  // Same rule as the page shell's sceneHost: fixed behind the whole page.
  const fixed = art.some(e => e.role !== 'decoration' && e.placement === 'page-background')

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
  const leftRight = (markup: string) => {
    const xs = (markup.match(/-?\d+/g) ?? []).map(Number).filter((_, i) => i % 2 === 0)
    return (Math.min(...xs) + Math.max(...xs)) / 2
  }
  const landParts: string[] = []
  for (const e of ordered) {
    if (e.form !== 'silhouette' && e.form !== 'shape') continue
    const shape = buildSceneShape({ name: e.name, form: e.form, regionNumbers: e.regions }, regions, ground)
    if (shape) landParts.push(...parts(shape.svg).sort((a, b) => topOf(a) - topOf(b)))
  }
  const tones = sceneTones(p, landParts.length)
  const landTone = (part: string) => tones.land[Math.max(0, landParts.length - 1 - landParts.indexOf(part))]
  const landDepth = (part: string) => {
    const rank = landParts.length - 1 - landParts.indexOf(part) // 0 = nearest
    return landParts.length <= 1 ? 0.7 : 0.85 - (rank / (landParts.length - 1)) * 0.55
  }

  // Where the light comes from: the first round body, if the user drew one.
  let light: { cx: number; cy: number; r: number } | null = null
  for (const e of ordered) {
    if (e.form !== 'disc') continue
    const shape = buildSceneShape({ name: e.name, form: 'disc', regionNumbers: e.regions }, regions, ground)
    light = shape ? circleOf(parts(shape.svg).find(s => s.startsWith('<circle')) ?? '') : null
    if (light) break
  }

  const soft = style === 'painterly' || style === 'papercut'
  const defs: string[] = []
  const back: string[] = []
  if (landscape) {
    if (style === 'flat' || style === 'line-art') {
      back.push(`<rect y="${frameY}" width="${CANVAS_WIDTH}" height="${frameH}" fill="${style === 'flat' ? mix(p.background, tones.horizon, 0.45) : p.background}" />`)
    } else {
      defs.push(`<linearGradient id="is-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="${tones.skyTop}" /><stop offset="62%" stopColor="${mix(tones.skyTop, tones.horizon, 0.6)}" /><stop offset="100%" stopColor="${tones.horizon}" /></linearGradient>`)
      back.push(`<rect y="${frameY}" width="${CANVAS_WIDTH}" height="${frameH}" fill="url(#is-sky)" />`)
    }
  } else if (soft) {
    // A picture that isn't a landscape keeps a light wash, so it reads as a
    // picture rather than shapes floating on a flat page.
    defs.push(`<linearGradient id="is-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="${mix(p.background, p.accent, 0.22)}" /><stop offset="100%" stopColor="${p.background}" /></linearGradient>`)
    back.push(`<rect y="${frameY}" width="${CANVAS_WIDTH}" height="${frameH}" fill="url(#is-sky)" />`)
  }
  if (style === 'painterly') {
    defs.push(`<linearGradient id="is-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="${tones.horizon}" stopOpacity="0" /><stop offset="100%" stopColor="${tones.horizon}" stopOpacity="0.62" /></linearGradient>`)
  }
  if (style === 'papercut') {
    defs.push(`<filter id="is-paper" x="-10%" y="-20%" width="120%" height="140%"><feDropShadow dx="0" dy="-4" stdDeviation="6" floodColor="#000000" floodOpacity="${tones.dark ? 0.5 : 0.26}" /></filter>`)
  }

  const layers: Layer[] = []
  const css: string[] = []
  const draw = style === 'line-art' ? ' data-draw="1"' : ''
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
        const lines = [label]
        if (sun && style !== 'line-art') {
          const halo = style === 'flat'
            ? `fill="${mix(tones.horizon, p.accent, 0.3)}"`
            : `fill="url(#${id}-glow)"`
          if (style !== 'flat') {
            defs.push(`<radialGradient id="${id}-glow"><stop offset="0%" stopColor="${p.accent}" stopOpacity="0.5" /><stop offset="45%" stopColor="${p.accent}" stopOpacity="0.16" /><stop offset="100%" stopColor="${p.accent}" stopOpacity="0" /></radialGradient>`)
          }
          lines.push(`<circle className="${moving ? `${id}-pulse` : ''}" cx="${sun.cx}" cy="${sun.cy}" r="${Math.round(sun.r * (style === 'flat' ? 1.3 : 2.2))}" ${halo} style={{ transformOrigin: '${sun.cx}px ${sun.cy}px' }} />`)
          if (moving) {
            css.push(`@keyframes ${id}-pulse { 0%,100% { transform: scale(1); opacity: .85 } 50% { transform: scale(1.08); opacity: 1 } }`, `.${id}-pulse { animation: ${id}-pulse 6s ease-in-out infinite }`)
          }
        }
        if (rays.length > 0) {
          const ringClass = moving && sun ? `${id}-spin` : ''
          lines.push(`<g className="${ringClass}"${sun ? ` style={{ transformOrigin: '${sun.cx}px ${sun.cy}px' }}` : ''}>`)
          rays.forEach(r => lines.push('  ' + jsxAttrs(r, `fill="none" stroke="${p.accent}" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" data-draw="1"`)))
          lines.push('</g>')
          // Rock, don't spin: rays drawn over a rising sun are a half-ring, and a
          // full turn would sweep them under the horizon and leave a gap.
          if (ringClass) css.push(`@keyframes ${id}-spin { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }`, `.${id}-spin { animation: ${id}-spin 12s ease-in-out infinite }`)
        }
        if (style === 'line-art') {
          circles.forEach(c => lines.push(jsxAttrs(c, `fill="${p.accent}" fillOpacity={0.2} stroke="${p.accent}" strokeWidth={3} data-draw="1"`)))
        } else if (style === 'flat' || style === 'papercut') {
          circles.forEach(c => lines.push(jsxAttrs(c, `fill="${p.accent}"${style === 'papercut' ? ' filter="url(#is-paper)"' : ''}`)))
        } else {
          defs.push(`<radialGradient id="${id}-core"><stop offset="0%" stopColor="${mix(p.accent, '#FFFFFF', 0.55)}" /><stop offset="70%" stopColor="${p.accent}" /><stop offset="100%" stopColor="${mix(p.accent, p.text, 0.15)}" /></radialGradient>`)
          circles.forEach(c => lines.push(jsxAttrs(c, `fill="url(#${id}-core)"`)))
        }
        layers.push({ depth: 0.08, lines })
        break
      }
      case 'rays': {
        // Standalone rays have no known centre to turn around, so they shimmer
        // rather than spin.
        const pulse = moving ? `${id}-glint` : ''
        const lines = [label]
        parts(shape.svg).forEach(s => lines.push(jsxAttrs(s, `fill="none" stroke="${p.accent}" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" className="${pulse}" data-draw="1"`)))
        if (pulse) css.push(`@keyframes ${id}-glint { 0%,100% { opacity: .65 } 50% { opacity: 1 } }`, `.${id}-glint { animation: ${id}-glint 4s ease-in-out infinite }`)
        layers.push({ depth: 0.12, lines })
        break
      }
      case 'silhouette':
      case 'shape': {
        // Each land part is its own layer: its own colour by distance, and its
        // own answer to scroll and pointer.
        parts(shape.svg)
          .sort((a, b) => topOf(a) - topOf(b))
          .forEach((part, i) => {
            const colour = landTone(part)
            const gid = `${id}-${i}`
            const lines = i === 0 ? [label] : []
            if (style === 'painterly') {
              // Lit from the side the light is on; shadowed away from it.
              const lit = light ? (light.cx < leftRight(part) ? 0 : 1) : 0.3
              const glow = light ? p.accent : '#FFFFFF'
              defs.push(
                `<linearGradient id="${gid}" x1="${lit}" y1="0" x2="${1 - lit}" y2="1"><stop offset="0%" stopColor="${mix(colour, glow, 0.16)}" /><stop offset="100%" stopColor="${mix(colour, '#000000', 0.14)}" /></linearGradient>`
              )
              lines.push(jsxAttrs(part, `fill="url(#${gid})"`))
            } else if (style === 'papercut') {
              lines.push(jsxAttrs(part, `fill="${colour}" filter="url(#is-paper)"`))
            } else if (style === 'line-art') {
              // The outline carries the picture, so it is drawn in a colour that
              // stands out from the page; the fill is only a tint.
              const ink = tones.dark ? mix(colour, p.text, 0.55) : mix(colour, p.text, 0.35)
              lines.push(jsxAttrs(part, `fill="${mix(p.background, colour, 0.3)}" stroke="${ink}" strokeWidth={3} strokeLinejoin="round"${draw}`))
            } else {
              lines.push(jsxAttrs(part, `fill="${colour}"`))
            }
            // Haze settles at the foot of everything but the nearest layer.
            const nearest = landParts.indexOf(part) === landParts.length - 1
            if (style === 'painterly' && landscape && !nearest) {
              const y = Math.round(topOf(part) + (ground - topOf(part)) * 0.35)
              lines.push(`<rect y="${y}" width="${CANVAS_WIDTH}" height="${Math.max(0, ground - y)}" fill="url(#is-haze)" />`)
            }
            layers.push({ depth: landDepth(part), lines })
          })
        break
      }
      case 'band': {
        const water = p.secondary
        const lines = [label]
        if (shape.paint === 'fill') {
          if (style === 'painterly') {
            defs.push(
              `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="${mix(water, '#FFFFFF', 0.35)}" /><stop offset="100%" stopColor="${mix(water, '#000000', 0.15)}" /></linearGradient>`
            )
          }
          const fill = style === 'painterly' ? `fill="url(#${id})"`
            : style === 'papercut' ? `fill="${water}" filter="url(#is-paper)"`
            : style === 'line-art' ? `fill="${mix(p.background, water, 0.2)}" stroke="${water}" strokeWidth={2.5}${draw}`
            : `fill="${water}"`
          parts(shape.svg).forEach(s => {
            lines.push(jsxAttrs(s, fill))
            if (moving) {
              // Light glinting on the surface, travelling with the flow.
              lines.push(jsxAttrs(s, `fill="none" stroke="${mix(water, '#FFFFFF', 0.7)}" strokeWidth={3} strokeDasharray="14 46" strokeLinecap="round" opacity={0.7} className="${id}-flow"`))
            }
          })
          if (moving) css.push(`@keyframes ${id}-flow { to { stroke-dashoffset: -600 } }`, `.${id}-flow { animation: ${id}-flow 9s linear infinite }`)
        } else {
          parts(shape.svg).forEach(s => lines.push(jsxAttrs(s, `fill="none" stroke="${water}" strokeWidth={10} strokeLinecap="round" data-draw="1"`)))
        }
        layers.push({ depth: 0.95, lines })
        break
      }
      case 'line': {
        const lines = [label]
        if (element.role === 'motion') {
          // A motion path is a guide, not a drawing: a small marker travels it.
          const d = parts(shape.svg)[0]?.match(/d="([^"]+)"/)?.[1]
          if (d) {
            lines.push(`<path id="${id}-track" d="${d}" fill="none" stroke="none" />`)
            lines.push(`<circle r="7" fill="${p.accent}"><animateMotion dur="8s" repeatCount="indefinite" rotate="auto"><mpath href="#${id}-track" /></animateMotion></circle>`)
          }
        } else if (element.role === 'decoration') {
          // Ornament in the accent colour; a moving one draws light along itself.
          parts(shape.svg).forEach(s => {
            lines.push(jsxAttrs(s, `fill="none" stroke="${p.accent}" strokeOpacity={0.85} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" data-draw="1"`))
            if (moving) lines.push(jsxAttrs(s, `fill="none" stroke="${mix(p.accent, '#FFFFFF', 0.6)}" strokeWidth={3} strokeLinecap="round" strokeDasharray="24 180" className="${id}-flow"`))
          })
          if (moving) css.push(`@keyframes ${id}-flow { to { stroke-dashoffset: -820 } }`, `.${id}-flow { animation: ${id}-flow 7s linear infinite }`)
        } else {
          parts(shape.svg).forEach(s => lines.push(jsxAttrs(s, `fill="none" stroke="${mix(p.text, p.background, 0.2)}" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" data-draw="1"`)))
        }
        layers.push({ depth: 1, lines })
        break
      }
      case 'sphere': {
        const geo = sphereGeometry(element.regions, regions)
        if (!geo) break
        const name = `${SCENE_COMPONENT}Sphere${spheres.length}`
        spheres.push(sphereComponent(name, id, geo, p))
        layers.push({ depth: 0.5, lines: [label, `<${name} />`] })
        break
      }
    }
  }

  if (layers.length === 0) return '' // nothing was drawable

  // Respect users who ask the OS for less motion.
  if (css.length > 0) css.push('@media (prefers-reduced-motion: reduce) { .intent-scene * { animation: none !important } }')

  // Scaling a layer for parallax grows it from the bottom-centre of the frame,
  // so a layer nudged sideways never shows a gap at the page edge.
  const origin = `${CANVAS_WIDTH / 2}px ${frameY + frameH}px`
  const body = [
    ...back,
    ...layers.flatMap(l => [
      `<g data-depth="${Math.round(l.depth * 100) / 100}" style={{ transformOrigin: '${origin}' }}>`,
      `  <g data-rise="1">`,
      ...l.lines.map(x => '    ' + x),
      `  </g>`,
      `</g>`,
    ]),
  ]
  // What the picture is painted in: the preview's legibility check reads it.
  const paint = [...new Set([...(landscape ? [tones.skyTop, tones.horizon] : []), ...(landParts.length > 0 ? tones.land : []), ...(light ? [p.accent] : [])])]

  const indent = (lines: string[], n: number) => lines.map(l => ' '.repeat(n) + l).join('\n')
  return `${spheres.map(c => c + '\n\n').join('')}/* ${SCENE_COMPONENT}: the user's drawing, rendered by IntentDraw (${style}) — geometry, layering, colour and motion are fixed. */
const ${SCENE_COMPONENT} = ({ className = '' }: { className?: string }) => {
${motionEffect(fixed)}
  return (
    <div ref={root} aria-hidden="true" data-tones="${paint.join(',')}" className={\`intent-scene relative block w-full h-full overflow-hidden \${className}\`}>
      <svg
        viewBox="0 ${frameY} ${CANVAS_WIDTH} ${frameH}"
        preserveAspectRatio="${landscape ? 'xMidYMax slice' : 'xMidYMid slice'}"
        className="absolute inset-0 block w-full h-full"
      >
        <defs>
${indent(defs, 10)}
        </defs>
${css.length > 0 ? `        <style>{\`${css.join(' ')}\`}</style>\n` : ''}${indent(body, 8)}
      </svg>${soft ? `
      <div className="pointer-events-none absolute inset-0" style={{ opacity: ${tones.dark ? 0.14 : 0.1}, mixBlendMode: 'soft-light', backgroundImage: "${GRAIN}" }} />` : ''}
    </div>
  );
};`
}

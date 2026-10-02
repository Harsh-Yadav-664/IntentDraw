import type { Region } from '@/types'
import type { BriefElement, BriefPalette, ObjectForm } from './brief'
import { hexToRgb, sphereComponent } from './scene-render'
import { sphereGeometry } from './scene'

/**
 * 3D objects the user draws and asks for — built and placed by IntentDraw.
 *
 * A real run understood "region 1 … a 3d rotating cube interactive with mouse
 * clicks" perfectly, then had no way to make one: the scene painted a flat
 * square at R1, and the section model built its own cube two sections away.
 * Objects are now components rendered here, in code, and placed by the page
 * shell exactly where they were drawn (page-shell.ts) — the model only has to
 * leave that spot clear. Interactive by default: they turn slowly on their
 * own, tilt toward the pointer, rotate when dragged, spin on a click, turn
 * with scroll, stop when the page is frozen as the editor backdrop, and keep
 * still for visitors who ask for reduced motion.
 */

const FALLBACK: BriefPalette = { background: '#0E1110', surface: '#1B2420', text: '#E8EFEA', accent: '#3DDC97', secondary: '#7FB7A4' }

export interface PlacedObject {
  /** Component name, e.g. IntentObject1. */
  name: string
  element: BriefElement
  form: ObjectForm
}

const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Objects IntentDraw can build itself; others are built in place by the section. */
export function buildableObjects(elements: BriefElement[]): Array<BriefElement & { form: ObjectForm }> {
  return elements.filter((e): e is BriefElement & { form: ObjectForm } => e.role === 'object' && (e.form === 'cube' || e.form === 'sphere'))
}

export function objectName(index: number): string {
  return `IntentObject${index + 1}`
}

function cubeComponent(name: string, p: BriefPalette): string {
  const face = [
    `position: absolute; inset: 0;`,
    `background: linear-gradient(135deg, ${rgba(p.accent, 0.22)} 0%, ${rgba(p.surface, 0.42)} 55%, ${rgba(p.background, 0.55)} 100%),`,
    `  repeating-linear-gradient(0deg, ${rgba(p.accent, 0.10)} 0 1px, transparent 1px 22px),`,
    `  repeating-linear-gradient(90deg, ${rgba(p.accent, 0.10)} 0 1px, transparent 1px 22px);`,
    `border: 1.5px solid ${rgba(p.accent, 0.75)};`,
    `box-shadow: inset 0 0 38px ${rgba(p.accent, 0.28)}, 0 0 26px ${rgba(p.accent, 0.22)};`,
    `backface-visibility: visible;`,
  ].join(' ')
  const faces = [
    'rotateY(0deg)', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)',
  ].map(t => `<div className="${name}-face" style={{ transform: '${t} translateZ(calc(var(--s) / 2))' }} />`)

  return `/* ${name}: the user's 3D cube, built and placed by IntentDraw — drag, click, scroll. */
const ${name} = () => {
  const wrap = React.useRef<HTMLDivElement | null>(null);
  const cube = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = wrap.current, c = cube.current;
    if (!el || !c) return;
    const fit = () => c.style.setProperty('--s', Math.max(48, Math.min(el.clientWidth, el.clientHeight) * 0.62) + 'px');
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    const still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let rx = -22, ry = 32, vx = 0, vy = still ? 0 : 0.35, boost = 0, tx = 0, ty = 0, mx = 0, my = 0, last = performance.now(), raf = 0;
    let drag: { x: number; y: number } | null = null;
    const aim = (e: PointerEvent) => {
      mx = e.clientX / Math.max(1, window.innerWidth) - 0.5;
      my = e.clientY / Math.max(1, window.innerHeight) - 0.5;
      if (drag) { vy = (e.clientX - drag.x) * 0.35; vx = -(e.clientY - drag.y) * 0.35; drag = { x: e.clientX, y: e.clientY }; }
    };
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture?.(e.pointerId); el.style.cursor = 'grabbing'; };
    const up = () => { drag = null; el.style.cursor = 'grab'; };
    const click = () => { boost = 14; };
    window.addEventListener('pointermove', aim, { passive: true });
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    el.addEventListener('click', click);
    const frame = () => {
      const now = performance.now(), k = Math.min(64, now - last) / 16;
      last = now;
      if (!drag) { vy += ((still ? 0 : 0.35) - vy) * 0.04; vx *= 0.9; }
      boost *= 0.95;
      ry += (vy + boost) * k;
      rx += vx * k;
      tx += (mx * 28 - tx) * 0.08;
      ty += (-my * 22 - ty) * 0.08;
      const scroll = (window.scrollY || 0) * 0.12;
      if (Number.isFinite(rx + ry + tx + ty)) c.style.transform = 'rotateX(' + (rx + ty) + 'deg) rotateY(' + (ry + tx + scroll) + 'deg)';
      if (!(window as any).__intentdrawFrozen) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('pointermove', aim);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('click', click);
    };
  }, []);
  return (
    <div ref={wrap} className="relative flex h-full w-full select-none items-center justify-center" style={{ perspective: '900px', cursor: 'grab', touchAction: 'pan-y' }} aria-label="Interactive 3D cube" role="img">
      <style>{\`.${name}-face { ${face} }\`}</style>
      <div className="pointer-events-none absolute bottom-[6%] left-1/2 h-[10%] w-[55%] -translate-x-1/2 rounded-[50%]" style={{ background: 'radial-gradient(closest-side, ${rgba(p.accent, 0.35)}, transparent)' }} />
      <div ref={cube} style={{ position: 'relative', width: 'var(--s, 200px)', height: 'var(--s, 200px)', transformStyle: 'preserve-3d' }}>
        ${faces.join('\n        ')}
      </div>
    </div>
  );
};`
}

/** A sphere object: the globe, in its own frame sized to where it was drawn. */
function sphereObject(name: string, e: BriefElement, regions: Region[], p: BriefPalette): string {
  const members = regions.filter(r => e.regions.includes(r.regionNumber))
  const geo = sphereGeometry(e.regions, regions)
  if (!geo || members.length === 0) return ''
  const pad = Math.round(geo.r * 0.45)
  const size = Math.round(geo.r * 2)
  // Re-centre the globe in its own frame; the marks are already relative to it.
  const local = { ...geo, cx: Math.round(geo.r + pad), cy: Math.round(geo.r + pad) }
  return `${sphereComponent(`${name}Globe`, `${name.toLowerCase()}g`, local, p)}

/* ${name}: the user's globe, built and placed by IntentDraw — follows pointer, touch and scroll. */
const ${name} = () => (
  <svg viewBox="0 0 ${size + pad * 2} ${size + pad * 2}" className="h-full w-full overflow-visible" aria-label="Interactive 3D globe" role="img">
    <${name}Globe />
  </svg>
);`
}

/** The source for every object IntentDraw builds, and which component is which. */
export function renderObjects(
  elements: BriefElement[],
  regions: Region[],
  palette: BriefPalette | null
): { code: string; objects: PlacedObject[] } {
  const p = palette ?? FALLBACK
  const objects: PlacedObject[] = []
  const blocks: string[] = []
  buildableObjects(elements).forEach(element => {
    const name = objectName(objects.length)
    const code = element.form === 'cube' ? cubeComponent(name, p) : sphereObject(name, element, regions, p)
    if (!code) return
    blocks.push(code)
    objects.push({ name, element, form: element.form })
  })
  return { code: blocks.join('\n\n'), objects }
}

import type { CSSProperties } from 'react'

/**
 * A finished site, as an illustration: what the landing page's sketch turns
 * into. It is a static picture of an IntentDraw result, rendered at a true
 * 1280px desktop width and scaled by whoever shows it — not a generated page,
 * and not run through the preview runtime.
 *
 * Everything in it is fictional. No real publication, phone number or
 * endorsement appears here on purpose.
 */

const SITE = {
  brand: 'Two Mountains',
  nav: ['Story', 'Menu', 'Rooms', 'Visit'],
  eyebrow: 'Open-fire kitchen · 1,480 m · a valley head',
  title: 'Between two mountains,',
  titleItalic: 'one long table.',
  sub: 'A lodge kitchen at the head of the valley. We cook what the slope gives us that week, over fire, for whoever walks up.',
  cta: 'Book the long table',
  image: '/images/hero-art.jpg',
  storyKicker: 'The place',
  storyTitle: 'Built from the drawing of a valley',
  storyBody:
    'The lodge sits where the river turns. Twelve rooms above the kitchen, a fire that never quite goes out, and a menu written each morning on the back of the room list.',
  quote: 'You can taste which side of the ridge the herbs came from.',
  quoteBy: 'A guest, last autumn',
  listKicker: 'This week',
  listTitle: 'The menu, written on Monday',
  items: [
    { name: 'Ember-roasted celeriac', meta: "brown butter · pine · aged sheep's cheese", price: '24' },
    { name: 'Valley trout, cooked in its own skin', meta: 'sorrel · whey · river herbs', price: '32' },
    { name: 'Rowan and honey custard', meta: 'smoked cream · buckwheat', price: '16' },
  ],
  bandTitle: 'The table opens at seven',
  bandBody: 'One sitting, sixteen seats, no menu choice. Tell us about allergies when you book and the kitchen will work around them.',
  bandCta: 'Reserve a seat',
  footer: 'Open Thursday to Monday · Bookings by form',
  palette: { bg: '#0E0D0C', panel: '#161412', ink: '#F4EFE7', muted: '#A79C8D', accent: '#E8B23A', line: 'rgba(244,239,231,0.12)' },
}

const display: CSSProperties = {
  fontFamily: 'var(--app-font-display)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
}

export function DemoSite({ className }: { className?: string }) {
  const c = SITE
  return (
    <div className={`relative w-[1280px] overflow-hidden ${className ?? ''}`} style={{ background: c.palette.bg, color: c.palette.ink }}>
      <header className="flex h-[72px] items-center justify-between px-[56px]" style={{ borderBottom: `1px solid ${c.palette.line}` }}>
        <div className="text-[19px]" style={display}>
          {c.brand}
        </div>
        <nav className="flex items-center gap-8 text-[13px]" style={{ color: c.palette.muted }}>
          {c.nav.map((n) => (
            <span key={n}>{n}</span>
          ))}
          <span className="px-4 py-2 text-[12px]" style={{ background: c.palette.accent, color: c.palette.bg, borderRadius: 2 }}>
            {c.cta}
          </span>
        </nav>
      </header>

      <section className="relative h-[560px] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed illustration inside a scaled artboard */}
        <img
          src={c.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '50% 42%', transform: 'scale(1.18) translateX(11%)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, ${c.palette.bg} 4%, ${c.palette.bg}E0 30%, ${c.palette.bg}66 58%, ${c.palette.bg}22 80%, transparent 100%)`,
          }}
        />
        <div className="relative flex h-full w-[648px] flex-col justify-center px-[56px]">
          <div className="mono-label mb-6" style={{ color: c.palette.accent }}>
            {c.eyebrow}
          </div>
          <h2 className="text-[62px] leading-[0.98]" style={display}>
            {c.title}
            <br />
            <em style={{ fontStyle: 'italic', color: c.palette.accent }}>{c.titleItalic}</em>
          </h2>
          <p className="mt-7 w-[476px] text-[15.5px] leading-[1.7]" style={{ color: c.palette.muted }}>
            {c.sub}
          </p>
          <div className="mt-9 flex items-center gap-5">
            <span className="px-7 py-3.5 text-[13px] font-medium" style={{ background: c.palette.accent, color: c.palette.bg, borderRadius: 2 }}>
              {c.cta}
            </span>
            <span className="text-[13px]" style={{ color: c.palette.muted }}>
              Thursday to Monday
            </span>
          </div>
        </div>
      </section>

      <section className="grid w-full grid-cols-12 gap-12 px-[56px] py-[96px]">
        <div className="col-span-4">
          <div className="mono-label mb-5" style={{ color: c.palette.accent }}>
            {c.storyKicker}
          </div>
          <h3 className="text-[42px] leading-[1.06]" style={display}>
            {c.storyTitle}
          </h3>
        </div>
        <div className="col-span-7 col-start-6">
          <p className="text-[19px] leading-[1.7]" style={{ color: c.palette.muted }}>
            {c.storyBody}
          </p>
          <div className="mt-12 border-l-2 pl-7" style={{ borderColor: c.palette.accent }}>
            <p className="text-[22px] leading-[1.5]" style={{ ...display, fontStyle: 'italic' }}>
              “{c.quote}”
            </p>
            <div className="mono-label mt-4" style={{ color: c.palette.muted }}>
              {c.quoteBy}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-[56px] pb-[96px]">
        <div className="flex items-end justify-between border-b pb-7" style={{ borderColor: c.palette.line }}>
          <div>
            <div className="mono-label mb-4" style={{ color: c.palette.accent }}>
              {c.listKicker}
            </div>
            <h3 className="text-[42px] leading-none" style={display}>
              {c.listTitle}
            </h3>
          </div>
          <div className="mono-label" style={{ color: c.palette.muted }}>
            Updated weekly
          </div>
        </div>
        {c.items.map((it) => (
          <div key={it.name} className="flex items-baseline gap-8 border-b py-7" style={{ borderColor: c.palette.line }}>
            <div className="w-[420px] text-[22px]" style={display}>
              {it.name}
            </div>
            <div className="flex-1 text-[15px]" style={{ color: c.palette.muted }}>
              {it.meta}
            </div>
            <div className="tab-num text-[17px]" style={{ color: c.palette.accent }}>
              {it.price}
            </div>
          </div>
        ))}
      </section>

      <section className="mx-[56px] mb-[96px] flex items-center justify-between px-[56px] py-[56px]" style={{ background: c.palette.panel, borderRadius: 2 }}>
        <div className="w-[560px]">
          <h3 className="text-[34px] leading-[1.15]" style={display}>
            {c.bandTitle}
          </h3>
          <p className="mt-5 text-[15px] leading-[1.7]" style={{ color: c.palette.muted }}>
            {c.bandBody}
          </p>
        </div>
        <span className="px-7 py-3.5 text-[13px] font-medium" style={{ background: c.palette.accent, color: c.palette.bg, borderRadius: 2 }}>
          {c.bandCta}
        </span>
      </section>

      <footer className="flex w-full items-center justify-between px-[56px] py-[40px]" style={{ borderTop: `1px solid ${c.palette.line}` }}>
        <div className="text-[17px]" style={display}>
          {c.brand}
        </div>
        <div className="tab-num text-[12px]" style={{ color: c.palette.muted }}>
          {c.footer}
        </div>
      </footer>
    </div>
  )
}

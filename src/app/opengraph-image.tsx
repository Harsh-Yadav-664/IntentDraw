import { ImageResponse } from 'next/og'

/**
 * The card shown when the site is linked anywhere: a rough sketch on the left
 * turning into a finished page on the right — the product in one picture.
 * Built with next/og (no extra dependency) and the app's own colour roles.
 */
export const alt = 'IntentDraw — sketch what you mean, get the site you meant'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#f4f1ec'
const MUTED = '#a5a099'
const ACCENT = '#facc15'
const BG = '#0a0a0b'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, padding: '64px 72px', color: INK }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, letterSpacing: -0.5 }}>
          <svg width="40" height="40" viewBox="0 0 24 24">
            <path d="M3.4 3.2 L 20.6 3.6 L 20.2 20.8 L 3.1 20.3 Z" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.55" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.2 19.4 C 8 14.2, 11.6 10.6, 19.6 4.2" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
            <path d="M15.6 4.6 L 19.8 4.1 L 19.3 8.3" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Intent</span>
          <span style={{ color: ACCENT, marginLeft: -14, fontStyle: 'italic' }}>Draw</span>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 48, marginTop: 24 }}>
          {/* The sketch */}
          <svg width="400" height="300" viewBox="0 0 400 300">
            <g fill="none" stroke={MUTED} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 18 L 386 22 L 382 58 L 12 55 Z" />
              <path d="M30 96 C 80 92, 140 98, 200 94" />
              <path d="M30 124 C 70 121, 110 126, 150 122" />
              <path d="M262 84 C 312 78, 372 110, 360 168 C 350 222, 280 226, 258 186 C 236 146, 236 92, 262 84 Z" />
              <path d="M18 216 L 120 218 L 118 284 L 16 282 Z" />
              <path d="M150 218 L 250 216 L 252 282 L 148 284 Z" />
              <path d="M282 216 L 384 219 L 382 283 L 280 281 Z" />
            </g>
          </svg>
          {/* Becomes */}
          <svg width="90" height="40" viewBox="0 0 90 40">
            <path d="M4 22 C 24 10, 50 30, 80 18" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
            <path d="M66 8 L 82 18 L 68 30" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* The site */}
          <div style={{ display: 'flex', flexDirection: 'column', width: 420, height: 300, borderRadius: 14, background: '#f3ece0', padding: 20, color: '#1b1712' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ fontWeight: 700 }}>Marrow & Ash</span>
              <span style={{ color: '#6b6156' }}>Menu · Visit · Book</span>
            </div>
            <div style={{ display: 'flex', marginTop: 22, gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 700, letterSpacing: -1 }}>Fire-cooked, every night.</span>
                <span style={{ marginTop: 12, fontSize: 13, color: '#6b6156' }}>A wood oven, twelve seats.</span>
              </div>
              <div style={{ display: 'flex', width: 120, height: 120, borderRadius: 999, background: '#c2552d' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
              {['#2f4b3a', '#d9a441', '#1b1712'].map(c => (
                <div key={c} style={{ display: 'flex', flex: 1, height: 64, borderRadius: 8, background: c }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 40, letterSpacing: -1, marginTop: 8 }}>
          Sketch what you mean.&nbsp;<span style={{ color: ACCENT }}>Get the site you meant.</span>
        </div>
      </div>
    ),
    size
  )
}

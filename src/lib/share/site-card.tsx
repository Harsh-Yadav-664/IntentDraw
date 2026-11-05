import { ImageResponse } from 'next/og'

/**
 * The link-preview card for a shared site (/p/<id>/card): the site's own name,
 * its one-line summary and its palette — so a link pasted into a chat looks
 * like the site, not like IntentDraw. Everything comes from the saved brief and
 * is re-checked here (the brief crossed the client before it was saved).
 */
export interface SiteCardInput {
  name: string
  summary?: string | null
  palette?: Record<string, unknown> | null
}

const HEX = /^#[0-9a-f]{6}$/i
const pick = (palette: SiteCardInput['palette'], key: string, fallback: string) => {
  const v = palette?.[key]
  return typeof v === 'string' && HEX.test(v) ? v : fallback
}

export const CARD_SIZE = { width: 1200, height: 630 }

export function siteCardColors(palette: SiteCardInput['palette']) {
  return {
    background: pick(palette, 'background', '#0E1110'),
    surface: pick(palette, 'surface', '#1B2420'),
    text: pick(palette, 'text', '#F2EFEA'),
    accent: pick(palette, 'accent', '#E8A33D'),
    secondary: pick(palette, 'secondary', '#7FB7A4'),
  }
}

export function siteCard(input: SiteCardInput): ImageResponse {
  const c = siteCardColors(input.palette)
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Website'
  const summary = (input.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: c.background, color: c.text, padding: '72px 80px' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {[c.accent, c.secondary, c.surface].map((color, i) => (
            <div key={i} style={{ display: 'flex', width: i === 0 ? 120 : 56, height: 14, borderRadius: 7, background: color }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: name.length > 28 ? 72 : 96, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
          {summary ? <div style={{ display: 'flex', marginTop: 28, fontSize: 32, lineHeight: 1.35, opacity: 0.78, maxWidth: 980 }}>{summary}</div> : null}
        </div>
        <div style={{ display: 'flex', height: 6, width: 220, background: c.accent, borderRadius: 3 }} />
      </div>
    ),
    CARD_SIZE
  )
}

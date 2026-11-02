import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/shared/providers'
import { THEME_STORAGE_KEY } from '@/lib/theme-key'

// The app: Instrument Serif for display, IBM Plex for everything else.
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument' })
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-plex' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })
// The marketing page's own faces (app/landing.css).
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-bricolage' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-dmsans' })

export const metadata: Metadata = {
  title: {
    default: 'IntentDraw — Sketch what you mean. Get the site you meant.',
    template: '%s · IntentDraw',
  },
  description:
    'An AI website builder that reads your drawing as layout and as artwork. Draw it, or just say it — every site is one of a kind.',
}

// Applied before the first paint so a light-theme user never sees a dark flash.
const themeScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${instrument.variable} ${plex.variable} ${plexMono.variable} ${bricolage.variable} ${dmSans.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

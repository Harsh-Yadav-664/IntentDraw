import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/shared/providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
  title: {
    default: 'IntentDraw - Design with Intent',
    template: '%s | IntentDraw',
  },
  description: 'A human-first, intent-driven web design tool. Draw your layout, describe your vision, let AI build it.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable} dark`}>
      <body className="font-sans antialiased bg-background text-foreground selection:bg-primary selection:text-primary-foreground min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
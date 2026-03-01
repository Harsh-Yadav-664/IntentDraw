import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/shared/providers'

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
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
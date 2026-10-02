import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authBypassed } from '@/lib/auth/bypass'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  // Development runs as a fixed user (lib/auth/bypass.ts), so there is nothing to
  // sign in to: skip the form instead of asking for an account every session.
  if (authBypassed()) redirect('/dashboard')

  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0B]" style={{ backgroundImage: 'radial-gradient(800px circle at 50% -10%, rgba(250,204,21,0.08), transparent 60%)' }}>
      {/* Header */}
      <header className="p-4">
        <Link 
          href="/" 
          className="font-display text-xl font-bold hover:opacity-80 transition-opacity"
        >
          Intent<span className="text-primary">Draw</span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-muted-foreground">
        <p>
          © {new Date().getFullYear()} IntentDraw. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
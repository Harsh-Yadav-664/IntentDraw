import Link from 'next/link'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="p-4">
        <Link 
          href="/" 
          className="text-xl font-bold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          Intent<span className="text-blue-600">Draw</span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-slate-500">
        <p>
          © {new Date().getFullYear()} IntentDraw. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
import { redirect } from 'next/navigation'
import { authBypassed } from '@/lib/auth/bypass'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Development runs as a fixed user (lib/auth/bypass.ts), so there is nothing to
  // sign in to: skip the form instead of asking for an account every session.
  if (authBypassed()) redirect('/dashboard')

  // Each page draws its own split layout (components/auth/auth-shell.tsx).
  return children
}

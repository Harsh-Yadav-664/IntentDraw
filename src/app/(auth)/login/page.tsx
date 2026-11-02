import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/auth-shell'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your IntentDraw account',
}

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Account" title="Welcome back." sub="Sign in to keep drawing. Your projects are where you left them.">
      {/* useSearchParams needs a Suspense boundary on a statically rendered page. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}

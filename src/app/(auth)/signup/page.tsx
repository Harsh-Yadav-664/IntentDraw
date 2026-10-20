import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignupForm } from '@/components/auth/signup-form'
import { FREE_DAILY_GENERATIONS } from '@/lib/plans'

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create your IntentDraw account',
}

export default function SignupPage() {
  return (
    <AuthShell eyebrow="Start free" title="Start with a sketch." sub={`${FREE_DAILY_GENERATIONS} generations a day, no card. Your drawing stays private.`}>
      <SignupForm />
    </AuthShell>
  )
}

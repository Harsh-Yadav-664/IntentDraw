'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { forgotPasswordSchema } from '@/lib/validations/auth'
import { Button, Field } from '@/components/kit/kit'
import { AuthShell, FormNote } from '@/components/auth/auth-shell'

export default function ForgotPasswordPage() {
  const { resetPassword, isSubmitting } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Enter a valid email address.')
      return
    }
    const { error: resetError } = await resetPassword(email)
    if (resetError) setError(resetError.message)
    else setSent(true)
  }

  return (
    <AuthShell
      eyebrow="Reset"
      title={sent ? 'Check your email.' : 'Forgot your password?'}
      sub={sent ? 'If there’s an account for that address, a reset link is on its way.' : 'We’ll email you a link to choose a new one.'}
    >
      {sent ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3.5">
            <Mail size={15} className="text-accent" />
            <div className="text-[13px] text-ink">{email}</div>
          </div>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[12.5px] text-accent hover:underline">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <FormNote tone="error">{error}</FormNote>}
          <Field label="Email" type="email" placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus disabled={isSubmitting} />
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
          <Link href="/login" className="inline-flex items-center gap-1.5 pt-4 text-[12.5px] text-accent hover:underline">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  )
}

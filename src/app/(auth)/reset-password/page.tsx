'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { Button, Field } from '@/components/kit/kit'
import { AuthShell, FormNote } from '@/components/auth/auth-shell'

/**
 * Choose a new password. Reached from the reset email via /auth/callback, which
 * has already exchanged the link's code for a (recovery) session — so this page
 * only has to set the password on the signed-in user.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message.toLowerCase().includes('session') ? 'This reset link has expired. Request a new one.' : updateError.message)
      return
    }
    router.push('/dashboard')
  }

  return (
    <AuthShell eyebrow="Reset" title="Choose a new password." sub="You’ll be signed in once it’s saved.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <FormNote tone="error">{error}</FormNote>}
        <Field label="New password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus disabled={saving} />
        <Field label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" disabled={saving} />
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save password'}
        </Button>
        <p className="pt-4 text-[12.5px] text-muted">
          Link expired?{' '}
          <Link href="/forgot-password" className="text-accent hover:underline">
            Send a new one
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { signupSchema, extractFieldErrors, type SignupFormData } from '@/lib/validations/auth'
import { Button, Field } from '@/components/kit/kit'
import { FormNote } from './auth-shell'

type Fields = Omit<SignupFormData, 'confirmPassword'>

export function SignupForm() {
  const { signUp, isSubmitting } = useAuth()
  const [formData, setFormData] = useState<Fields>({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | 'root', string>>>({})
  const [sentTo, setSentTo] = useState<string | null>(null)

  const change = (field: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    // One password field: the confirmation the schema asks for is the same value.
    const result = signupSchema.safeParse({ ...formData, confirmPassword: formData.password })
    if (!result.success) {
      setErrors(extractFieldErrors(result.error))
      return
    }
    const { error } = await signUp({ email: result.data.email, password: result.data.password, name: result.data.name })
    if (error) {
      let message = error.message
      if (error.message.includes('already registered')) message = 'There’s already an account with this email. Sign in instead.'
      else if (error.message.toLowerCase().includes('password')) message = 'That password is too weak — use at least 8 characters.'
      setErrors({ root: message })
    } else {
      setSentTo(result.data.email)
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3.5">
          <Mail size={15} className="text-accent" />
          <div>
            <div className="text-[13px] text-ink">{sentTo}</div>
            <div className="text-[11px] text-faint">Open the link in that email to confirm your account.</div>
          </div>
        </div>
        <p className="text-[13px] leading-[1.75] text-muted">Click the link and you&apos;ll land straight in your workspace. You can close this tab.</p>
        <Link href="/login" className="inline-flex text-[12.5px] text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errors.root && <FormNote tone="error">{errors.root}</FormNote>}
      <Field label="Name" placeholder="What should we call you?" value={formData.name} onChange={change('name')} error={errors.name} autoComplete="name" autoFocus disabled={isSubmitting} />
      <Field label="Email" type="email" placeholder="you@studio.com" value={formData.email} onChange={change('email')} error={errors.email} autoComplete="email" disabled={isSubmitting} />
      <Field
        label="Password"
        type="password"
        placeholder="At least 8 characters"
        value={formData.password}
        onChange={change('password')}
        error={errors.password}
        hint={formData.password.length > 0 && formData.password.length < 8 ? `${8 - formData.password.length} more characters` : undefined}
        autoComplete="new-password"
        disabled={isSubmitting}
      />
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating your account…' : 'Create account'}
      </Button>
      <p className="pt-4 text-[12.5px] text-muted">
        Already drawing?{' '}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

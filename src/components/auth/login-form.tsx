'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { loginSchema, extractFieldErrors, type LoginFormData } from '@/lib/validations/auth'
import { Button, Field } from '@/components/kit/kit'
import { FormNote } from './auth-shell'

export function LoginForm() {
  const { signIn, isSubmitting } = useAuth()
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' })
  // An expired or reused email link comes back here as ?error= from
  // /auth/callback; show it rather than silently landing on a blank form.
  const linkError = useSearchParams().get('error')
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData | 'root', string>>>(linkError ? { root: linkError.slice(0, 200) } : {})

  const change = (field: keyof LoginFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const result = loginSchema.safeParse(formData)
    if (!result.success) {
      setErrors(extractFieldErrors(result.error))
      return
    }
    const { error } = await signIn(result.data)
    if (error) {
      let message = error.message
      if (error.message.includes('Invalid login credentials')) message = 'That email and password don’t match. Try again.'
      else if (error.message.includes('Email not confirmed')) message = 'Confirm your email first — the link is in your inbox.'
      setErrors({ root: message })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errors.root && <FormNote tone="error">{errors.root}</FormNote>}
      <Field label="Email" type="email" placeholder="you@studio.com" value={formData.email} onChange={change('email')} error={errors.email} autoComplete="email" autoFocus disabled={isSubmitting} />
      <Field label="Password" type="password" placeholder="Your password" value={formData.password} onChange={change('password')} error={errors.password} autoComplete="current-password" disabled={isSubmitting} />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-[12px] text-muted transition-colors duration-150 hover:text-accent">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="pt-4 text-[12.5px] text-muted">
        No account yet?{' '}
        <Link href="/signup" className="text-accent hover:underline">
          Start free <ArrowRight size={11} className="inline" />
        </Link>
      </p>
    </form>
  )
}

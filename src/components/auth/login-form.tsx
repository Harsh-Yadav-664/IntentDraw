'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { loginSchema, extractFieldErrors, type LoginFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'

export function LoginForm() {
  const { signIn, isSubmitting } = useAuth()
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  })
  // An expired or reused email link comes back here as ?error= from
  // /auth/callback; show it rather than silently landing on a blank form.
  const linkError = useSearchParams().get('error')
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData | 'root', string>>>(
    linkError ? { root: linkError.slice(0, 200) } : {}
  )
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear field error when user starts typing
    if (errors[name as keyof LoginFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validate form data
    const result = loginSchema.safeParse(formData)
    if (!result.success) {
      setErrors(extractFieldErrors(result.error))
      return
    }

    // Attempt sign in
    const { error } = await signIn(result.data)
    
    if (error) {
      // Map Supabase error codes to user-friendly messages
      let message = error.message
      if (error.message.includes('Invalid login credentials')) {
        message = 'Invalid email or password. Please try again.'
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Please verify your email address before signing in.'
      }
      setErrors({ root: message })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Root Error */}
      {errors.root && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{errors.root}</p>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange}
          disabled={isSubmitting}
          aria-invalid={!!errors.email}
          autoComplete="email"
          autoFocus
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link 
            href="/forgot-password" 
            className="text-sm text-primary hover:text-primary/80 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={!!errors.password}
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </Button>

      {/* Sign Up Link */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary hover:text-primary/80 hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </form>
  )
}
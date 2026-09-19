'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { signupSchema, extractFieldErrors, type SignupFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export function SignupForm() {
  const { signUp, isSubmitting } = useAuth()
  
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData | 'root', string>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear field error when user starts typing
    if (errors[name as keyof SignupFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSuccess(false)

    // Validate form data
    const result = signupSchema.safeParse(formData)
    if (!result.success) {
      setErrors(extractFieldErrors(result.error))
      return
    }

    // Attempt sign up
    const { error } = await signUp({
      email: result.data.email,
      password: result.data.password,
      name: result.data.name,
    })
    
    if (error) {
      // Map Supabase error codes to user-friendly messages
      let message = error.message
      if (error.message.includes('already registered')) {
        message = 'An account with this email already exists. Please sign in instead.'
      } else if (error.message.includes('password')) {
        message = 'Password is too weak. Please use at least 8 characters.'
      }
      setErrors({ root: message })
    } else {
      setSuccess(true)
    }
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-emerald-200">Account created!</h3>
            <p className="text-sm text-emerald-300 mt-1">
              Please check your email to verify your account, then you can sign in.
            </p>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Go to Sign In</Link>
        </Button>
      </div>
    )
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

      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          value={formData.name}
          onChange={handleChange}
          disabled={isSubmitting}
          aria-invalid={!!errors.name}
          autoComplete="name"
          autoFocus
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

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
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
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
            autoComplete="new-password"
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
        {!errors.password && formData.password.length > 0 && formData.password.length < 8 && (
          <p className="text-sm text-muted-foreground">
            {8 - formData.password.length} more characters needed
          </p>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={!!errors.confirmPassword}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground"
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>

      {/* Terms */}
      <p className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{' '}
        <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
      </p>

      {/* Sign In Link */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:text-primary/80 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </form>
  )
}
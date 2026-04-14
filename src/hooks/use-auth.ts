'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/auth-provider'

// =============================================================================
// Re-export context hook
// =============================================================================

export { useAuthContext } from '@/components/auth/auth-provider'

// =============================================================================
// Auth Actions Hook
// =============================================================================

interface SignUpData {
  email: string
  password: string
  name?: string
}

interface SignInData {
  email: string
  password: string
}

interface AuthError {
  message: string
  code?: string
}

interface UseAuthActionsReturn {
  signUp: (data: SignUpData) => Promise<{ error: AuthError | null }>
  signIn: (data: SignInData) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  isSubmitting: boolean
}

export function useAuthActions(): UseAuthActionsReturn {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { signOut: contextSignOut } = useAuthContext()
  
  const supabase = useMemo(() => createBrowserClient(), [])

  // Sign up with email and password
  const signUp = useCallback(async (data: SignUpData): Promise<{ error: AuthError | null }> => {
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name || null,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) {
        return { error: { message: error.message, code: error.code } }
      }

      // Supabase may require email confirmation depending on settings
      // For development, auto-confirm is usually enabled
      router.push('/dashboard')
      router.refresh()
      
      return { error: null }
    } catch (err) {
      console.error('[useAuthActions] Sign up error:', err)
      return { 
        error: { 
          message: err instanceof Error ? err.message : 'An unexpected error occurred' 
        } 
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [supabase, router])

  // Sign in with email and password
  const signIn = useCallback(async (data: SignInData): Promise<{ error: AuthError | null }> => {
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        return { error: { message: error.message, code: error.code } }
      }

      // Check for redirect parameter in URL
      const params = new URLSearchParams(window.location.search)
      const redirectTo = params.get('redirect') || '/dashboard'
      
      router.push(redirectTo)
      router.refresh()
      
      return { error: null }
    } catch (err) {
      console.error('[useAuthActions] Sign in error:', err)
      return { 
        error: { 
          message: err instanceof Error ? err.message : 'An unexpected error occurred' 
        } 
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [supabase, router])

  // Sign out
  const signOut = useCallback(async (): Promise<void> => {
    setIsSubmitting(true)
    
    try {
      await contextSignOut()
      router.push('/')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }, [contextSignOut, router])

  // Reset password
  const resetPassword = useCallback(async (email: string): Promise<{ error: AuthError | null }> => {
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        return { error: { message: error.message, code: error.code } }
      }

      return { error: null }
    } catch (err) {
      console.error('[useAuthActions] Reset password error:', err)
      return { 
        error: { 
          message: err instanceof Error ? err.message : 'An unexpected error occurred' 
        } 
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [supabase])

  return {
    signUp,
    signIn,
    signOut,
    resetPassword,
    isSubmitting,
  }
}

// =============================================================================
// Combined Hook (Convenience)
// =============================================================================

export function useAuth() {
  const context = useAuthContext()
  const actions = useAuthActions()

  return {
    ...context,
    ...actions,
  }
}
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { DEV_USER, authBypassed } from '@/lib/auth/bypass'
import type { User, Session } from '@supabase/supabase-js'

// =============================================================================
// Types
// =============================================================================

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// =============================================================================
// Provider
// =============================================================================

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Development only — see lib/auth/bypass.ts. Never active in a production build.
  const bypass = authBypassed()
  const [user, setUser] = useState<User | null>(bypass ? (DEV_USER as unknown as User) : null)
  const [session, setSession] = useState<Session | null>(
    bypass ? ({ user: DEV_USER } as unknown as Session) : null
  )
  const [isLoading, setIsLoading] = useState(!bypass)

  // Create Supabase client once
  const supabase = useMemo(() => createBrowserClient(), [])

  // Fetch initial session
  useEffect(() => {
    if (bypass) return

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      } catch (error) {
        console.error('[AuthProvider] Failed to get initial session:', error)
        setSession(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [supabase, bypass])

  // Listen for auth state changes. Skipped under the dev bypass: Supabase
  // reports INITIAL_SESSION with no session, which would null the dev user.
  useEffect(() => {
    if (bypass) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[AuthProvider] Auth state changed:', event)
      
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setIsLoading(false)

      // Handle specific events
      if (event === 'SIGNED_OUT') {
        // Clear any cached data
        setSession(null)
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, bypass])

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // State will be updated by onAuthStateChange listener
    } catch (error) {
      console.error('[AuthProvider] Sign out error:', error)
      // Force clear state even if signOut fails
      setSession(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  // Refresh session function
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession()
      if (error) throw error
      
      setSession(refreshedSession)
      setUser(refreshedSession?.user ?? null)
    } catch (error) {
      console.error('[AuthProvider] Session refresh error:', error)
    }
  }, [supabase])

  // Memoized context value
  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    refreshSession,
  }), [user, session, isLoading, signOut, refreshSession])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  
  return context
}
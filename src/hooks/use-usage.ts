'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '@/hooks/use-auth'

interface UsageStats {
  used: number
  limit: number
  remaining: number
  resetAt: string
  authenticated: boolean
}

interface UseUsageReturn {
  stats: UsageStats | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DEFAULT_STATS: UsageStats = {
  used: 0,
  limit: 10,
  remaining: 10,
  resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  authenticated: false,
}

export function useUsage(): UseUsageReturn {
  const { isAuthenticated, isLoading: authLoading } = useAuthContext()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    if (authLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/usage')
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch usage')
      }

      setStats(result.data)
    } catch (err) {
      console.error('[useUsage] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch usage')
      setStats(DEFAULT_STATS)
    } finally {
      setIsLoading(false)
    }
  }, [authLoading])

  // Fetch on mount and when auth state changes
  useEffect(() => {
    fetchUsage()
  }, [fetchUsage, isAuthenticated])

  return {
    stats,
    isLoading: isLoading || authLoading,
    error,
    refresh: fetchUsage,
  }
}

/**
 * Format reset time as human-readable string.
 */
export function formatResetTime(resetAt: string): string {
  const reset = new Date(resetAt)
  const now = new Date()
  const diffMs = reset.getTime() - now.getTime()
  
  if (diffMs <= 0) return 'now'
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
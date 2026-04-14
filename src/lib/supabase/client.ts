// =============================================================================
// Browser Supabase Client
// =============================================================================
// Use this in Client Components ('use client')
// Creates a new client instance per call - safe for browser usage
// =============================================================================

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
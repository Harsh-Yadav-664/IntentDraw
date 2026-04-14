// =============================================================================
// Supabase Client Exports
// =============================================================================
// Usage:
//   Browser (Client Components):
//     import { createBrowserClient } from '@/lib/supabase'
//     const supabase = createBrowserClient()
//
//   Server (API Routes, Server Components):
//     import { createServerClient } from '@/lib/supabase'
//     const supabase = await createServerClient()
//
//   Admin (Bypass RLS - Server Only):
//     import { createAdminClient } from '@/lib/supabase'
//     const supabase = createAdminClient()
//
//   Middleware:
//     import { updateSession } from '@/lib/supabase'
//     const { user, supabaseResponse } = await updateSession(request)
// =============================================================================

export { createClient as createBrowserClient } from './client'
export { createClient as createServerClient, createAdminClient } from './server'
export { updateSession } from './middleware'

// Type exports
export type { Database, Json } from './types'
export type {
  Tables,
  InsertTables,
  UpdateTables,
  ProjectRow,
  ProjectInsert,
  ProjectUpdate,
  RegionRow,
  RegionInsert,
  RegionUpdate,
  GenerationHistoryRow,
  GenerationHistoryInsert,
  UsageRow,
  UsageInsert,
  UsageUpdate,
} from './types'
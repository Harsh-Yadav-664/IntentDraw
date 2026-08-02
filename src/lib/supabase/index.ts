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
// ⚠️  Server-side clients are NOT re-exported from this barrel.
// Import them directly: `@/lib/supabase/server` or `@/lib/supabase/middleware`

// Type exports (safe for both client and server)
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
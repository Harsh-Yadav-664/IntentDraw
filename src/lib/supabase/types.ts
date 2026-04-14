// =============================================================================
// Database Type Definitions
// =============================================================================
// These types match the schema defined in the migration (Step 2)
// For production, generate these with: npx supabase gen types typescript
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          canvas_data: Json | null
          global_theme: string | null
          generated_code: string | null
          prompt: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          canvas_data?: Json | null
          global_theme?: string | null
          generated_code?: string | null
          prompt?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          canvas_data?: Json | null
          global_theme?: string | null
          generated_code?: string | null
          prompt?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      regions: {
        Row: {
          id: string
          project_id: string
          region_number: number
          geometry: Json
          intent: string | null
          lock_state: Json
          generated_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          region_number: number
          geometry: Json
          intent?: string | null
          lock_state?: Json
          generated_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          region_number?: number
          geometry?: Json
          intent?: string | null
          lock_state?: Json
          generated_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'regions_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      generation_history: {
        Row: {
          id: string
          region_id: string
          prompt: string
          generated_code: string
          version: number
          provider: string
          created_at: string
        }
        Insert: {
          id?: string
          region_id: string
          prompt: string
          generated_code: string
          version: number
          provider: string
          created_at?: string
        }
        Update: {
          id?: string
          region_id?: string
          prompt?: string
          generated_code?: string
          version?: number
          provider?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'generation_history_region_id_fkey'
            columns: ['region_id']
            isOneToOne: false
            referencedRelation: 'regions'
            referencedColumns: ['id']
          }
        ]
      }
      usage: {
        Row: {
          id: string
          user_id: string
          date: string
          generation_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          generation_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          generation_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'usage_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// =============================================================================
// Helper Types
// =============================================================================

export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update']

// Convenience aliases
export type ProjectRow = Tables<'projects'>
export type ProjectInsert = InsertTables<'projects'>
export type ProjectUpdate = UpdateTables<'projects'>

export type RegionRow = Tables<'regions'>
export type RegionInsert = InsertTables<'regions'>
export type RegionUpdate = UpdateTables<'regions'>

export type GenerationHistoryRow = Tables<'generation_history'>
export type GenerationHistoryInsert = InsertTables<'generation_history'>

export type UsageRow = Tables<'usage'>
export type UsageInsert = InsertTables<'usage'>
export type UsageUpdate = UpdateTables<'usage'>
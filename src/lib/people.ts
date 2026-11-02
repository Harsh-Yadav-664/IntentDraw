import type { User } from '@supabase/supabase-js'

/** "Ines Marchetti" → "IM"; "ines.m@studio.com" → "IM". */
export function initialsOf(name: string): string {
  const parts = name
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** What to call the signed-in person: the name they gave, else their email. */
export function displayName(user: Pick<User, 'email' | 'user_metadata'> | null | undefined): string {
  const name = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : ''
  return name || user?.email || 'You'
}

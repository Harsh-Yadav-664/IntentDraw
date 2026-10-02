import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Where Supabase sends people back from an email link — sign-up confirmation
 * and password reset.
 *
 * The SSR client uses the PKCE flow: the link arrives with a one-time `code`
 * that has to be exchanged for a session here, server-side, so the session
 * cookie gets set. Without this route a confirmation link just landed on the
 * dashboard signed out.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // Only same-site paths: an absolute `next` would make this an open redirect.
  const requested = url.searchParams.get('next') ?? '/dashboard'
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
    console.error('[auth/callback] code exchange failed:', error.message)
  }

  const failed = new URL('/login', url.origin)
  failed.searchParams.set('error', 'That link has expired or was already used. Please try again.')
  return NextResponse.redirect(failed)
}

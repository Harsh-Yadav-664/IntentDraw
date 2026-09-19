/**
 * Development-only sign-in bypass.
 *
 * During development everything runs as one fixed user, so the owner can open
 * the app and work without logging in (introduced in 799c2d2, "no sign in for
 * dev"). That bypass used to be hard-coded in three places — the server client,
 * the middleware and the browser auth provider — which meant a production
 * deploy would have served every visitor as the same user.
 *
 * Now it is decided here, once:
 *   - production builds NEVER bypass, whatever any env var says
 *   - development bypasses unless NEXT_PUBLIC_AUTH_BYPASS=false, so the real
 *     sign-in flow can still be exercised locally
 *
 * Both values are inlined at build time, so client and server always agree.
 */

export const DEV_USER = {
  id: '10b15cad-04b2-42b0-89db-829e905a5b95',
  email: 'dev@intentdraw.local',
} as const

export function authBypassed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_AUTH_BYPASS !== 'false'
}

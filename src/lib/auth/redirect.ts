/**
 * A same-site path to return to after signing in, or null.
 *
 * The target comes from the query string (`?redirect=`), so it is attacker
 * controlled: it must never leave the site. Only a path is accepted —
 * "//evil.com", "/\evil.com" and absolute URLs are all rejected, since
 * browsers treat the first two as protocol-relative.
 */
export function safeRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

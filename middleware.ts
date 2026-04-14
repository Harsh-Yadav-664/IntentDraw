import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// =============================================================================
// Route Configuration
// =============================================================================

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/project',
]

// Routes only for unauthenticated users (redirect to dashboard if logged in)
const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
]

// Public routes that don't need any auth check
const PUBLIC_ROUTES = [
  '/',
  '/p', // Public project sharing
]

// =============================================================================
// Middleware
// =============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // Static files like favicon.ico
  ) {
    return NextResponse.next()
  }

  // Update session and get user
  const { user, supabaseResponse } = await updateSession(request)

  // Check if current path matches protected routes
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )

  // Check if current path matches auth routes
  const isAuthRoute = AUTH_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )

  // Check if current path matches public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )

  // ==========================================================================
  // Route Protection Logic
  // ==========================================================================

  // Protected routes: redirect to login if not authenticated
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    // Store the original URL to redirect back after login
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Auth routes: redirect to dashboard if already authenticated
  if (isAuthRoute && user) {
    // Check if there's a redirect parameter
    const redirectTo = request.nextUrl.searchParams.get('redirect')
    if (redirectTo && !AUTH_ROUTES.some(r => redirectTo.startsWith(r))) {
      // Redirect to the original intended destination
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
    // Default redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Public routes and everything else: allow access
  return supabaseResponse
}

// =============================================================================
// Middleware Matcher
// =============================================================================
// Only run middleware on specific paths (improves performance)

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
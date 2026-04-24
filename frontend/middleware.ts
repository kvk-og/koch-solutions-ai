import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('koch_auth_token')
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isApiAuthRoute = request.nextUrl.pathname.startsWith('/api/auth')

  // Allow access to the login page and auth API routes
  if (isLoginPage || isApiAuthRoute) {
    if (token && isLoginPage) {
      // If already logged in, redirect to home
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Redirect to login if not authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (except api/auth which is handled above, but api endpoints 
     *         called from backend might bypass this if we want, but since
     *         it's a frontend middleware it only intercepts frontend routes.
     *         Actually, Next.js handles `/api/*` so it intercepts them too. Let's allow public assets.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}

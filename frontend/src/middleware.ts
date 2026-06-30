import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Routing-only auth check: read the session from the cookie locally instead
  // of revalidating with Supabase Auth on every navigation (no network call).
  // Real data protection is enforced by the NestJS API (JwtAuthGuard verifies
  // the JWT via JWKS on every request), so trusting the cookie here is safe —
  // a stale/forged cookie still can't read any data through the API.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  // Protect routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/characters') ||
    request.nextUrl.pathname.startsWith('/sessions') ||
    request.nextUrl.pathname.startsWith('/grind') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/settings');

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|texture.png|grid.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

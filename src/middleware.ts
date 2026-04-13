import { NextRequest, NextResponse } from 'next/server';

const BYPASS_KEY = 'lifelinepreview2026';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow auth callbacks, admin, API routes, and static assets through
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Check for bypass cookie or query param
  const hasBypass = request.cookies.get('site_preview')?.value === BYPASS_KEY;
  const queryBypass = searchParams.get('preview') === BYPASS_KEY;

  // If query param provided, set cookie and continue to full site
  if (queryBypass) {
    const response = NextResponse.next();
    response.cookies.set('site_preview', BYPASS_KEY, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
    });
    return response;
  }

  // If bypass cookie exists, show full site
  if (hasBypass) {
    return NextResponse.next();
  }

  // Otherwise, rewrite to coming soon page
  return NextResponse.rewrite(new URL('/coming-soon', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import { NextRequest, NextResponse } from 'next/server';

const BYPASS_KEY = 'lifelinepreview2026';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow auth callbacks, admin, API routes, and static assets through.
  // /research/* serves unlisted internal documents (e.g. the clinical
  // advisor protocol summary) — those are still gated by the URL being
  // unguessable + a noindex meta tag, but they bypass the coming-soon
  // splash so the link works for the advisor.
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/research') ||
    pathname.startsWith('/survey') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|html|pdf|txt|woff|woff2|ttf)$/)
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

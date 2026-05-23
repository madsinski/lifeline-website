// Higher-order wrapper that auto-captures unhandled throws from
// Next.js API route handlers and writes them to app_errors via the
// existing captureException helper. Without this, an unhandled throw
// inside a route handler returns 500 to the client but is only
// visible in Vercel logs — invisible to /admin/errors triage.
//
// Usage — wrap any route export at the bottom of the file:
//
//   import { withErrorReporting } from "@/lib/with-error-reporting";
//
//   export const POST = withErrorReporting(async (req) => {
//     ...
//   }, { route: "POST /api/example" });
//
// The wrapper:
//   - Awaits the handler.
//   - If it throws, posts the error to app_errors with runtime='server',
//     metadata.route set to the route label, pathname set from req.url
//     so /admin/errors can group + link.
//   - Re-throws so Next.js returns its standard 500. Behavior of
//     unwrapped handlers is preserved end-to-end; only the audit
//     trail changes.
//
// Safe to apply to every route. The reporter itself catches its own
// errors so a Supabase outage during reporting cannot mask the
// original 500.

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "./error-reporter";

type RouteHandler<T = unknown> = (req: NextRequest, ctx: T) => Promise<Response | NextResponse>;

interface WrapOptions {
  /** Short label used as metadata.route + as the fingerprint stem
   * so a recurring error in this route groups correctly in the
   * /admin/errors triage view. Recommended format:
   *   "POST /api/admin/releases"
   *   "GET /api/biody/import" */
  route: string;
}

export function withErrorReporting<T = unknown>(
  handler: RouteHandler<T>,
  opts: WrapOptions,
): RouteHandler<T> {
  return async (req: NextRequest, ctx: T) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      // Fire-and-forget — never let the reporter delay the response
      // or mask the original throw.
      try {
        let pathname: string | null = null;
        try { pathname = new URL(req.url).pathname; } catch {}
        await captureException(e, {
          level: "error",
          tags: { route: opts.route },
          contexts: {
            request: {
              method: req.method,
              pathname: pathname ?? "",
              url: req.url,
            },
          },
        });
      } catch {}
      throw e;
    }
  };
}

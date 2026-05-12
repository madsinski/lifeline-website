// Next.js instrumentation hook. After dropping @sentry/nextjs, this
// just provides the onRequestError shim that writes uncaught Next.js
// request errors directly to public.app_errors via the same helper
// the API routes use.

export async function register(): Promise<void> {
  // Intentionally empty. Previously loaded sentry.server.config /
  // sentry.edge.config; both removed when we migrated off Sentry.
}

export const onRequestError = async (err: unknown, request: Request, context: { routerKind: string }): Promise<void> => {
  // Lazy import so this file stays cheap at boot.
  const { captureException } = await import("./src/lib/error-reporter");
  await captureException(err, {
    tags: { route: request.url, kind: context.routerKind, source: "next_onRequestError" },
  });
};

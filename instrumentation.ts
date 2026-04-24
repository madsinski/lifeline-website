// Next.js instrumentation hook. Loads the matching Sentry config
// depending on the runtime Next is booting into. Runs once per cold
// start on the server side.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (err: unknown, request: Request, context: { routerKind: string }) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(err, {
    tags: { route: request.url, kind: context.routerKind },
  });
};

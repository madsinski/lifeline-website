// Browser-side instrumentation. Loaded automatically by Next.js
// after we migrated off @sentry/nextjs — installs window-level
// error + unhandledrejection handlers that POST captured events
// directly to /api/errors/capture, which writes into
// public.app_errors. /admin/errors picks them up.
//
// Same redaction stance as the previous Sentry beforeSend hook:
// query strings stripped client-side, no PII payloads sent.

const HEALTH_ROUTE_PREFIXES = [
  "/api/admin/clients",
  "/api/admin/messages",
  "/api/admin/conversations",
  "/api/admin/biody",
  "/api/biody",
  "/api/messages",
  "/api/conversations",
  "/api/account/body-comp",
  "/api/account/weight",
];

// Browser extensions inject errors into every page and they aren't
// our bug. Drop anything that originates outside our own scripts.
const IGNORE_PATTERNS: RegExp[] = [
  /Lock .* was released because another request stole it/,
  /Lock broken by another request with the 'steal' option/,
  /Failed to connect to MetaMask/i,
  /MetaMask extension not found/i,
  /window\.ethereum/i,
  /No Ethereum provider/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
];

function shouldIgnore(message: string, stack: string | null): boolean {
  for (const p of IGNORE_PATTERNS) {
    if (p.test(message)) return true;
    if (stack && p.test(stack)) return true;
  }
  return false;
}

function redactedPathname(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname;
}

function isHealthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return HEALTH_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
}

let throttleCount = 0;
let throttleResetAt = 0;
const THROTTLE_WINDOW_MS = 60_000;
const THROTTLE_MAX = 10;

function withinThrottle(): boolean {
  const now = Date.now();
  if (now > throttleResetAt) {
    throttleCount = 1;
    throttleResetAt = now + THROTTLE_WINDOW_MS;
    return true;
  }
  if (throttleCount >= THROTTLE_MAX) return false;
  throttleCount++;
  return true;
}

function capture(message: string, stack: string | null, level: "error" | "warning" | "fatal" = "error") {
  if (typeof window === "undefined") return;
  if (!withinThrottle()) return;
  if (shouldIgnore(message, stack)) return;
  const pathname = redactedPathname();
  const onHealthRoute = isHealthRoute(pathname);
  try {
    fetch("/api/errors/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive lets the request survive a page unload (the user
      // navigates away after the error fires).
      keepalive: true,
      body: JSON.stringify({
        message: (message || "(no message)").slice(0, 2000),
        // On health routes we drop the stack entirely — file paths
        // inside frames sometimes leak request shapes.
        stack: onHealthRoute ? null : (stack || null),
        url: typeof window !== "undefined" ? window.location.href.split("?")[0] : null,
        pathname,
        runtime: "browser",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        level,
      }),
    }).catch(() => undefined);
  } catch { /* never throw from the reporter */ }
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    capture(err?.message || event.message || "(unknown error)", err?.stack || null);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : String(reason));
    capture(err.message || "(unhandled rejection)", err.stack || null, "warning");
  });
}

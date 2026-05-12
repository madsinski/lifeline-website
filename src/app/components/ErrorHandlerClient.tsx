"use client";

// Browser-side error capture. After migrating off @sentry/nextjs we
// lost Sentry's auto-loaded client init that bundled
// instrumentation-client.ts into the browser build. This component
// is the version-independent replacement — installs window 'error'
// and 'unhandledrejection' listeners on mount that POST captured
// events to /api/errors/capture, which writes into public.app_errors
// so /admin/errors shows them.
//
// Rendered once from the root layout so the listeners are attached
// on every route.

import { useEffect } from "react";

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

// Drop noise that originates outside our own code so the table
// doesn't fill up with browser-extension chatter.
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

// Per-page throttle (resets on navigation since the component
// remounts). Matches the server-side rate cap on /api/errors/capture.
const THROTTLE_WINDOW_MS = 60_000;
const THROTTLE_MAX = 10;

export default function ErrorHandlerClient() {
  useEffect(() => {
    let throttleCount = 0;
    let throttleResetAt = 0;

    const capture = (message: string, stack: string | null, level: "error" | "warning" | "fatal" = "error") => {
      const now = Date.now();
      if (now > throttleResetAt) {
        throttleCount = 1;
        throttleResetAt = now + THROTTLE_WINDOW_MS;
      } else {
        if (throttleCount >= THROTTLE_MAX) return;
        throttleCount++;
      }
      if (shouldIgnore(message, stack)) return;

      const pathname = window.location.pathname;
      const onHealthRoute = HEALTH_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));

      try {
        fetch("/api/errors/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // keepalive lets the request survive a page unload — common
          // when an error fires right before the user navigates away.
          keepalive: true,
          body: JSON.stringify({
            message: (message || "(no message)").slice(0, 2000),
            // Drop the stack on health routes — frame paths can leak
            // request shapes for routes that touch patient data.
            stack: onHealthRoute ? null : stack || null,
            url: window.location.href.split("?")[0],
            pathname,
            runtime: "browser",
            user_agent: navigator.userAgent,
            level,
          }),
        }).catch(() => undefined);
      } catch { /* never throw from the reporter */ }
    };

    const onError = (event: ErrorEvent) => {
      const err = event.error as Error | undefined;
      capture(err?.message || event.message || "(unknown error)", err?.stack || null);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const err = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : String(reason));
      capture(err.message || "(unhandled rejection)", err.stack || null, "warning");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

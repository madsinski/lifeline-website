"use client";

// How the workstation talks to its API. The same screens run in two places:
//
//   /vinnustod        partner nurses, their own cookie session (Vera, HSU)
//   /admin/vinnustod  Lifeline staff, the admin Bearer token + MFA
//
// Both hit the same /api/vinnustod/* routes — those accept either actor — so
// the only thing that differs is how the request is signed. That is this
// context's whole job.

import { createContext, useContext, useEffect, useRef } from "react";

export type WsApi = (url: string, init?: RequestInit) => Promise<Response>;

/** Window event fired when a signed-in workstation session stops being
 *  accepted (expired, revoked, logged out elsewhere). The shell listens and
 *  shows "Lotan rann út — skráðu þig inn aftur". */
export const WS_SESSION_EXPIRED = "ws-session-expired";

// Only a session we have seen working can "expire": a 401 before sign-in
// (the first /me, a wrong password or PIN) is not news to anyone.
let hadSession = false;
const isAuthRoute = (url: string) => url.includes("/api/vinnustod/auth/");

/** Cookie-signed, for the standalone workstation. A FormData body must keep
 *  the browser's own multipart content-type. */
export const cookieApi: WsApi = async (url, init = {}) => {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (url.includes("/api/vinnustod/auth/logout")) hadSession = false;
  const r = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!isAuthRoute(url)) {
    if (r.ok) hadSession = true;
    else if (r.status === 401 && hadSession) {
      hadSession = false;
      if (typeof window !== "undefined") window.dispatchEvent(new Event(WS_SESSION_EXPIRED));
    }
  }
  return r;
};

/** Calls `onExpired` when the workstation session runs out mid-use. */
export function useWsSessionExpired(onExpired: () => void) {
  const ref = useRef(onExpired);
  useEffect(() => { ref.current = onExpired; });
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener(WS_SESSION_EXPIRED, h);
    return () => window.removeEventListener(WS_SESSION_EXPIRED, h);
  }, []);
}

const WsApiContext = createContext<WsApi>(cookieApi);

export const WsApiProvider = WsApiContext.Provider;

/** The fetcher for whichever workstation this tree is running in. */
export function useWsApi(): WsApi {
  return useContext(WsApiContext);
}

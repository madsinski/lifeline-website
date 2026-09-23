"use client";

// How the workstation talks to its API. The same screens run in two places:
//
//   /vinnustod        partner nurses, their own cookie session (Vera, HSU)
//   /admin/vinnustod  Lifeline staff, the admin Bearer token + MFA
//
// Both hit the same /api/vinnustod/* routes — those accept either actor — so
// the only thing that differs is how the request is signed. That is this
// context's whole job.

import { createContext, useContext } from "react";

export type WsApi = (url: string, init?: RequestInit) => Promise<Response>;

/** Cookie-signed, for the standalone workstation. A FormData body must keep
 *  the browser's own multipart content-type. */
export const cookieApi: WsApi = (url, init = {}) => {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  return fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
};

const WsApiContext = createContext<WsApi>(cookieApi);

export const WsApiProvider = WsApiContext.Provider;

/** The fetcher for whichever workstation this tree is running in. */
export function useWsApi(): WsApi {
  return useContext(WsApiContext);
}

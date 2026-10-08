"use client";

// The authed fetch every client screen needs.
//
// This exact closure was written out by hand in each page that talks to
// /api/hc/* — get the session, put the token on the request, set the content
// type when there is a body. Five copies of one idea, and the new app surface
// would have made it fifteen.
//
// Not a data layer: it returns the Response, so callers keep their own error
// handling and their own shapes. The only thing it centralises is the part
// that is the same everywhere and easy to get subtly wrong.

import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type Api = (url: string, init?: RequestInit) => Promise<Response>;

export function useApi(): Api {
  return useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return fetch(url, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }, []);
}

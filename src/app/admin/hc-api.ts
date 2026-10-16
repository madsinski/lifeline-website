"use client";

// Bearer-authenticated fetch for the /admin health-journey pages.

import { supabase } from "@/lib/supabase";

export async function adminApi(url: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  return fetch(url, {
    ...init,
    headers: {
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export async function adminJson<T>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; data: T; error?: string }> {
  const r = await adminApi(url, init);
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, data: j as T, error: r.ok ? undefined : (j as { error?: string }).error || `Villa ${r.status}` };
}

/** The auth-gate codes /api/admin routes answer with (requireAdminAAL2,
 *  requireStaffAAL2), in Icelandic. Any other code passes through as the
 *  server wrote it; nothing at all becomes `fallback`. */
export function adminErrorText(code: string | null | undefined, fallback = "Tókst ekki. Reyndu aftur."): string {
  switch (code) {
    case "mfa_required": return "Þú þarft að staðfesta með tveggja þátta auðkenningu (MFA) og reyna aftur.";
    case "forbidden": return "Þú hefur ekki heimild til þess.";
    case "unauthorized": return "Innskráningin er útrunnin. Skráðu þig inn aftur.";
    case undefined: case null: case "": return fallback;
    default: return code;
  }
}

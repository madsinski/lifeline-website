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

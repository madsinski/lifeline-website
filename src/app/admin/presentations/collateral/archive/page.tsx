"use client";

// Archived collateral documents (admin). Restore or permanently delete docs
// that were removed with "Eyða" in the studio. Saves via the admin API (AAL2).

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mergeContent, DEFAULT_CONTENT, type CollateralContent } from "../content";
import { CollateralArchive } from "../CollateralArchive";
import type { SaveResult } from "../CollateralStudio";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export default function CollateralArchivePage() {
  const [initial, setInitial] = useState<CollateralContent | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/presentations/collateral", { headers: await authHeaders() });
        const j = res.ok ? await res.json() : null;
        if (!cancel) setInitial(mergeContent(j?.data));
      } catch {
        if (!cancel) setInitial(DEFAULT_CONTENT);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const onSave = async (content: CollateralContent): Promise<SaveResult> => {
    try {
      const res = await fetch("/api/admin/presentations/collateral", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ data: content }),
      });
      if (res.ok) return { ok: true };
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error ?? String(res.status) };
    } catch {
      return { ok: false, error: "network" };
    }
  };

  if (!initial) return <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-gray-400">Hleð efni…</p>;

  return <CollateralArchive initial={initial} onSave={onSave} backHref="/admin/presentations/collateral" />;
}

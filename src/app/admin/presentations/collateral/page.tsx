"use client";

// Fjarlækningar print collateral studio — thin wrapper around CollateralStudio.
// Loads the stored content (any active staff), saves via the admin API
// (admin + AAL2), and can mint an unguessable external edit link.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mergeContent, DEFAULT_CONTENT, type CollateralContent } from "./content";
import { CollateralStudio, type SaveResult } from "./CollateralStudio";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function MintLink() {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function mint() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/presentations/collateral/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ label: "Ytri breytingatengill" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.token) setLink(`${window.location.origin}/present/collateral/edit/${j.token}`);
      else setErr(j.error === "mfa_required" ? "Þarft MFA" : (j.error ?? String(res.status)));
    } catch {
      setErr("Netvilla");
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    return (
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        title="Deildu þessum tengli með ytri aðila. Hægt að afturkalla."
        className="w-56 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900"
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={mint}
        disabled={busy}
        title="Býr til einn einnota, afturkallanlegan breytingatengil fyrir ytri aðila"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        {busy ? "Bý til…" : "Ytri breytingatengill"}
      </button>
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  );
}

export default function CollateralAdminPage() {
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

  if (!initial) return <p className="mx-auto max-w-7xl px-4 py-10 text-sm text-gray-400">Hleð efni…</p>;

  return (
    <CollateralStudio
      initial={initial}
      onSave={onSave}
      heading="Fjarlækningar — prentefni fyrir HSU"
      subtitle="Breyttu textanum, forskoðaðu og vistaðu sem PDF. A4."
      back={{ href: "/admin/presentations", label: "← Presentations" }}
      headerExtra={<MintLink />}
      archiveHref="/admin/presentations/collateral/archive"
    />
  );
}

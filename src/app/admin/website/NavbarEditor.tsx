"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyStaffRole } from "@/lib/staff-role";
import { NAV_ITEMS } from "@/lib/site-content/nav";
import { resolveOrder, resolveHidden, type SiteContentBlob, type SiteSection } from "@/lib/site-content/types";

const SECTIONS: SiteSection[] = NAV_ITEMS.map((n) => ({ id: n.id, label: n.fallback }));

type SaveState = "idle" | "saving" | "saved" | "error";

// Editor for the public top-navbar: reorder links and show/hide them. Stored in
// the site_content "nav" key (blob {order, hidden}); labels stay in the
// translations editor. Draft autosaves; "Birta" publishes to the live site.
export default function NavbarEditor() {
  const [draft, setDraft] = useState<SiteContentBlob>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipSave = useRef(true);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: session?.access_token ? `Bearer ${session.access_token}` : "" };
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setIsAdmin((await getMyStaffRole(user.email)) === "admin");
    const res = await fetch(`/api/admin/site-content/nav`, { headers: await authHeaders() });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      const d = (j.content?.draft as SiteContentBlob) ?? {};
      setDraft({ order: d.order, hidden: d.hidden });
      setPublishedAt(j.content?.published_at ?? null);
    }
    skipSave.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    if (skipSave.current) { skipSave.current = false; return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/site-content/nav`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ draft }),
      });
      setSaveState(res.ok ? "saved" : "error");
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [draft, loading, isAdmin]);

  const order = useMemo(() => resolveOrder(SECTIONS, draft), [draft]);
  const hiddenSet = useMemo(() => resolveHidden(SECTIONS, draft), [draft]);
  const label = (id: string) => SECTIONS.find((s) => s.id === id)?.label ?? id;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setDraft((prev) => ({ ...prev, order: next }));
  };
  const toggle = (id: string) => {
    setDraft((prev) => {
      const set = new Set(prev.hidden ?? []);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...prev, hidden: Array.from(set) };
    });
  };

  const publish = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/site-content/nav/publish`, { method: "POST", headers: await authHeaders() });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && j.ok) {
      setPublishedAt(j.published_at);
      setMsg({ type: "ok", text: "Birt! Valmyndin er uppfærð á vefnum." });
    } else {
      setMsg({ type: "err", text: j.error === "mfa_required" ? "Birting krefst MFA." : j.error || "Ekki tókst að birta." });
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Hleð…</div>;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs text-gray-500">
          {saveState === "saving" && <span>Vistar…</span>}
          {saveState === "saved" && <span className="text-emerald-600">✓ Vistað (drög)</span>}
          {saveState === "error" && <span className="text-red-600">Vistun mistókst</span>}
          {publishedAt && <span> · Síðast birt {new Date(publishedAt).toLocaleString("is-IS")}</span>}
        </div>
        {isAdmin && (
          <button onClick={publish} disabled={busy} className="py-1.5 px-3 rounded-lg bg-[#10B981] hover:bg-[#047857] text-white text-sm font-semibold disabled:opacity-50">
            {busy ? "Birti…" : "Birta"}
          </button>
        )}
      </div>

      {msg && (
        <div className={`mb-3 rounded-lg border p-2.5 text-xs ${msg.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      <ol className="space-y-1.5">
        {order.map((id, i) => {
          const hidden = hiddenSet.has(id);
          return (
            <li key={id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${hidden ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"}`}>
              <span className="w-5 text-[11px] font-semibold text-gray-400">{i + 1}</span>
              <span className={`flex-1 text-sm ${hidden ? "text-gray-400 line-through" : "text-gray-800"}`}>{label(id)}</span>
              <button onClick={() => toggle(id)} disabled={!isAdmin} title={hidden ? "Sýna" : "Fela"} className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                {hidden ? "Sýna" : "Fela"}
              </button>
              <button onClick={() => move(i, i - 1)} disabled={!isAdmin || i === 0} aria-label="Færa upp" className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-25">↑</button>
              <button onClick={() => move(i, i + 1)} disabled={!isAdmin || i === order.length - 1} aria-label="Færa niður" className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-25">↓</button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-gray-400">Falin síða hverfur úr valmyndinni en er áfram til á sinni slóð. Heiti eru þýdd í „Website“ ritlinum og þýðingakerfinu.</p>
    </div>
  );
}

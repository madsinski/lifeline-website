"use client";

// Everyone, and the groups they belong to.
//
// Two lists behind one search box. "Allir" is every client on the
// workstation's queue; "Hópar" is the companies, because a health check sold
// to a workplace arrives as twenty people at once and the nurse thinks in
// workplaces, not rows.
//
// Entering a group here creates the company as a draft. The commercial side
// — agreement, tier, pricing, rounds — is /admin/business and stays there; a
// nurse should not be setting prices.

import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronDown, Loader2, Plus, Search, Users } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Row { id: string; client_id: string; client_name: string; client_phone: string | null; stage: string | null }
interface Group {
  id: string; name: string; status: string | null;
  contact: string | null; email: string | null; phone: string | null;
  members: { id: string; full_name: string | null }[];
}

const STAGE_IS: Record<string, string> = {
  profile: "Nýr", protocol: "Virkjun", tests: "Rannsóknir", report: "Skýrsla",
  interview: "Viðtal", plan: "Áætlun", action: "Í gangi", done: "Lokið",
};

export default function ClientsView({ api, onOpenClient }: {
  api: Api;
  onOpenClient: (journeyId: string) => void;
}) {
  const [tab, setTab] = useState<"all" | "groups">("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([api("/api/vinnustod/queue"), api("/api/vinnustod/groups")]);
    const aj = await a.json().catch(() => ({}));
    const bj = await b.json().catch(() => ({}));
    setRows(a.ok ? (aj.journeys ?? []) : []);
    setGroups(b.ok ? (bj.groups ?? []) : []);
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const needle = q.trim().toLowerCase();
  const people = (rows ?? []).filter((r) =>
    !needle || (r.client_name ?? "").toLowerCase().includes(needle) || (r.client_phone ?? "").includes(needle));
  const shownGroups = (groups ?? []).filter((g) =>
    !needle || g.name.toLowerCase().includes(needle) ||
    g.members.some((m) => (m.full_name ?? "").toLowerCase().includes(needle)));

  const journeyOf = (clientId: string) => (rows ?? []).find((r) => r.client_id === clientId)?.id ?? null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {(["all", "groups"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {t === "all" ? <Users className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
              {t === "all" ? `Allir${rows ? ` · ${rows.length}` : ""}` : `Hópar${groups ? ` · ${groups.length}` : ""}`}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {tab === "groups" && (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700">
            <Plus className="h-4 w-4" /> Nýr hópur
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4">
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "all" ? "Leita að skjólstæðingi — nafn eða sími" : "Leita að hópi eða starfsmanni"}
          className="min-h-11 w-full bg-transparent text-sm outline-none" />
      </label>

      {rows === null && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Hleð…</p>}

      {tab === "all" && rows !== null && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {people.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpenClient(r.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{r.client_name}</span>
                  <span className="block text-xs text-slate-500">{r.client_phone ?? "—"}</span>
                </span>
                {r.stage && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {STAGE_IS[r.stage] ?? r.stage}
                  </span>
                )}
              </button>
            </li>
          ))}
          {!people.length && <li className="px-4 py-3 text-sm text-slate-500">Enginn fannst.</li>}
        </ul>
      )}

      {tab === "groups" && groups !== null && (
        <ul className="space-y-2">
          {shownGroups.map((g) => (
            <li key={g.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)}
                aria-expanded={open === g.id}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900">{g.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[g.members.length ? `${g.members.length} starfsmenn` : "engir starfsmenn skráðir", g.contact, g.phone].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {g.status === "draft" && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">óútfyllt</span>
                )}
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open === g.id ? "rotate-180" : ""}`} />
              </button>
              {open === g.id && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  {g.members.length === 0 ? (
                    <p className="text-sm text-slate-500">Engir starfsmenn tengdir þessum hópi enn þá.</p>
                  ) : (
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {g.members.map((m) => {
                        const j = journeyOf(m.id);
                        return (
                          <li key={m.id}>
                            <button type="button" disabled={!j} onClick={() => j && onOpenClient(j)}
                              className="w-full truncate rounded-lg bg-white px-2.5 py-1.5 text-left text-sm text-slate-800 ring-1 ring-slate-200 enabled:hover:bg-emerald-50 disabled:opacity-60">
                              {m.full_name ?? "—"}
                              {!j && <span className="ml-1 text-xs text-slate-400">(engin heilsuferð)</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">
                    Samningar, verð og umferðir eru í <span className="font-semibold">/admin/business</span>.
                  </p>
                </div>
              )}
            </li>
          ))}
          {!shownGroups.length && <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Enginn hópur fannst.</li>}
        </ul>
      )}

      {adding && <NewGroup api={api} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} />}
    </section>
  );
}

function NewGroup({ api, onClose, onSaved }: { api: Api; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setBusy(true); setMsg("");
    const r = await api("/api/vinnustod/groups", { method: "POST", body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tókst ekki að stofna hóp."); return; }
    onSaved();
  };

  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
        className="mt-0.5 min-h-10 w-full rounded-lg border border-slate-300 px-2.5 text-sm" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose} role="presentation">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nýr hópur">
        <p className="font-bold text-slate-900">Nýr hópur</p>
        <p className="mt-0.5 text-sm text-slate-500">
          Vinnustaður eða félag. Samningar og verð eru fyllt út í /admin/business á eftir.
        </p>
        <div className="mt-3 grid gap-2">
          {field("name", "Nafn hópsins")}
          <div className="grid gap-2 sm:grid-cols-2">
            {field("contact_name", "Tengiliður")}
            {field("contact_phone", "Sími tengiliðs", "tel")}
          </div>
          {field("contact_email", "Netfang tengiliðs", "email")}
          {field("address", "Heimilisfang")}
        </div>
        {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy || !f.name.trim()} onClick={save}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Stofna hóp
          </button>
          <button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hætta við</button>
        </div>
      </div>
    </div>
  );
}

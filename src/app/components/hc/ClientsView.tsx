"use client";

// Everyone, and the groups they belong to.
//
// Two lists behind one search box. "Allir" is every client on the
// workstation's queue — handed in by the page, which already polls it, so
// this list and the Í dag queue can never disagree about who is there; "Hópar" is the companies, because a health check sold
// to a workplace arrives as twenty people at once and the nurse thinks in
// workplaces, not rows.
//
// Entering a group here creates the company as a draft. The commercial side
// — agreement, tier, pricing, rounds — is /admin/business and stays there; a
// nurse should not be setting prices.

import { useCallback, useEffect, useState } from "react";
import Sheet from "./Sheet";
import { badgeClass } from "./Badge";
import { useToast } from "./Toast";
import { Building2, ChevronDown, Loader2, Plus, Search, Users } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface ClientRow { id: string; client_id: string; client_name: string; client_phone: string | null; stage: string | null; coaching?: boolean }
interface Group {
  id: string; name: string; status: string | null;
  contact: string | null; email: string | null; phone: string | null;
  members: { id: string; full_name: string | null }[];
}

const STAGE_IS: Record<string, string> = {
  profile: "Nýr", protocol: "Virkjun", tests: "Rannsóknir", report: "Skýrsla",
  interview: "Áætlunarsamtal", plan: "Áætlun", action: "Í gangi", done: "Lokið",
};

export default function ClientsView({ api, rows, onOpenClient, onReload, capped = false }: {
  api: Api;
  /** The workstation queue's rows; null while it is loading. */
  rows: ClientRow[] | null;
  onOpenClient: (journeyId: string) => void;
  /** Ask the page to fetch the queue again. */
  onReload?: () => void;
  /** Cap the people list and scroll it, leaving the controls fixed. */
  capped?: boolean;
}) {
  const [tab, setTab] = useState<"all" | "groups">("all");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("");
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsFailed, setGroupsFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const b = await api("/api/vinnustod/groups").catch(() => null);
    const bj = b?.ok ? await b.json().catch(() => null) : null;
    setTimeout(() => { setGroupsFailed(!bj); setGroups(bj?.groups ?? []); }, 0);
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const needle = q.trim().toLowerCase();
  /* The stages that actually occur, in journey order, so the filter never
     offers a stage nobody is in. */
  const stages = Object.keys(STAGE_IS).filter((s) => (rows ?? []).some((r) => r.stage === s));
  const people = (rows ?? []).filter((r) =>
    (!stage || r.stage === stage) &&
    (!needle || (r.client_name ?? "").toLowerCase().includes(needle) || (r.client_phone ?? "").includes(needle)));
  const shownGroups = (groups ?? []).filter((g) =>
    !needle || g.name.toLowerCase().includes(needle) ||
    g.members.some((m) => (m.full_name ?? "").toLowerCase().includes(needle)));

  const journeyOf = (clientId: string) => (rows ?? []).find((r) => r.client_id === clientId)?.id ?? null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-hc-sunken-2 p-0.5">
          {(["all", "groups"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${tab === t ? "bg-hc-surface text-hc-ink shadow-sm" : "text-hc-ink-2"}`}>
              {t === "all" ? <Users className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
              {t === "all" ? `Allir${rows ? ` · ${rows.length}` : ""}` : `Hópar${groups ? ` · ${groups.length}` : ""}`}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {tab === "groups" && (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-hc-brand-dark px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
            <Plus className="h-4 w-4" /> Nýr hópur
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 rounded-2xl border border-hc-control bg-hc-surface px-4 focus-within:border-hc-brand-dark focus-within:ring-2 focus-within:ring-hc-brand/25">
        <Search className="h-4 w-4 shrink-0 text-hc-ink-2" aria-hidden />
        <span className="sr-only">Leita</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search"
          placeholder={tab === "all" ? "Leita að skjólstæðingi — nafn eða sími" : "Leita að hópi eða starfsmanni"}
          className="min-h-11 w-full bg-transparent text-sm text-hc-ink outline-none placeholder:text-hc-ink-3" />
      </label>

      {/* Stage filter: at three clients it is noise, at fifty it is how you
          find everyone waiting on an interview. */}
      {tab === "all" && stages.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sía eftir stöðu">
          {[["", "Allir"] as const, ...stages.map((s) => [s, STAGE_IS[s]] as const)].map(([k, l]) => (
            <button key={k || "all"} type="button" role="radio" aria-checked={stage === k} onClick={() => setStage(k)}
              className={`min-h-11 rounded-full px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
                stage === k ? "bg-hc-brand-dark text-white" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-hc-brand-surface hover:text-hc-brand-text"}`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {rows === null && <div className="h-40 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð skjólstæðingum" />}
      {tab === "groups" && groupsFailed && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-hc-bad-surface px-4 py-3 text-sm text-hc-bad-ink">
          Náði ekki í hópana.
          <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-hc-control bg-hc-surface px-3 font-semibold text-hc-ink-2">Reyna aftur</button>
        </p>
      )}

      {/* Only the people scroll. Allir/Hópar, Nýr hópur and the search stay
          above it — the search is how you reach somebody in a list too long
          to read, so scrolling it out of reach defeats the cap it was meant
          to make bearable. */}
      {tab === "all" && rows !== null && (
        <ul className={`divide-y divide-hc-hairline rounded-2xl border border-hc-hairline bg-hc-surface ${
          capped ? "max-h-80 overflow-y-auto overscroll-contain" : "overflow-hidden"}`}>
          {people.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpenClient(r.id)}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hc-brand">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold text-hc-ink">
                    <span className="truncate">{r.client_name}</span>
                    {r.coaching && <span className={badgeClass("brand", "sm")}>Þjálfun</span>}
                  </span>
                  <span className="block text-xs text-hc-ink-2">{r.client_phone ?? "—"}</span>
                </span>
                {r.stage && (
                  <span className="shrink-0 rounded-full bg-hc-sunken-2 px-2 py-0.5 text-xs font-semibold text-hc-ink-2">
                    {STAGE_IS[r.stage] ?? r.stage}
                  </span>
                )}
              </button>
            </li>
          ))}
          {!people.length && (
            <li className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm text-hc-ink-2">
              {rows.length ? "Enginn fannst." : "Engir skjólstæðingar enn."}
              {!rows.length && onReload && <button type="button" onClick={onReload} className="font-semibold text-hc-brand-text hover:underline">Sækja aftur</button>}
            </li>
          )}
        </ul>
      )}

      {/* The groups list gets the same cap. It was left uncapped when the
          people list got one, which only shows once you switch tabs — and
          thirteen groups that each expand their members is the taller of
          the two lists, not the shorter. */}
      {tab === "groups" && groups !== null && (
        <ul className={`space-y-2 ${capped ? "max-h-80 overflow-y-auto overscroll-contain pr-1" : ""}`}>
          {shownGroups.map((g) => (
            <li key={g.id} className="overflow-hidden rounded-2xl border border-hc-hairline bg-hc-surface">
              <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)}
                aria-expanded={open === g.id}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hc-brand">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-hc-sunken-2 text-hc-ink-2">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-hc-ink">{g.name}</span>
                  <span className="block truncate text-xs text-hc-ink-2">
                    {[g.members.length ? `${g.members.length} starfsmenn` : "engir starfsmenn skráðir", g.contact, g.phone].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {g.status === "draft" && (
                  <span className="shrink-0 rounded-full bg-hc-warn-surface px-2 py-0.5 text-[11px] font-semibold text-hc-warn-ink ring-1 ring-hc-warn-ink/30">óútfyllt</span>
                )}
                <ChevronDown className={`h-4 w-4 shrink-0 text-hc-ink-3 transition ${open === g.id ? "rotate-180" : ""}`} />
              </button>
              {open === g.id && (
                <div className="border-t border-hc-hairline bg-hc-sunken/60 px-4 py-3">
                  {g.members.length === 0 ? (
                    <p className="text-sm text-hc-ink-2">Engir starfsmenn tengdir þessum hópi enn þá.</p>
                  ) : (
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {g.members.map((m) => {
                        const j = journeyOf(m.id);
                        return (
                          <li key={m.id}>
                            <button type="button" disabled={!j} onClick={() => j && onOpenClient(j)}
                              className="min-h-11 w-full truncate rounded-lg bg-hc-surface px-2.5 text-left text-sm text-hc-ink-2 ring-1 ring-hc-hairline enabled:hover:bg-hc-ok-surface disabled:opacity-80">
                              {m.full_name ?? "—"}
                              {!j && <span className="ml-1 text-xs text-hc-ink-2">(engin heilsuferð)</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-hc-ink-2">
                    Samningar, verð og umferðir eru í <span className="font-semibold">/admin/business</span>.
                  </p>
                </div>
              )}
            </li>
          ))}
          {!shownGroups.length && <li className="rounded-2xl border border-hc-hairline bg-hc-surface px-4 py-3 text-sm text-hc-ink-2">Enginn hópur fannst.</li>}
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

  const toast = useToast();
  const save = async () => {
    if (busy) return;
    setBusy(true); setMsg("");
    const r = await api("/api/vinnustod/groups", { method: "POST", body: JSON.stringify(f) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r) { setMsg("Engin tenging. Athugaðu netið og reyndu aftur."); return; }
    /* 400/409 carry their own Icelandic sentence; a database error does not. */
    if (!r.ok) { setMsg(r.status === 400 && j.error === "Nafn hópsins vantar." || r.status === 409 ? j.error : "Tókst ekki að stofna hóp. Reyndu aftur."); return; }
    toast.show(`Hópurinn „${f.name.trim()}“ er stofnaður.`);
    onSaved();
  };

  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="block text-sm">
      <span className="text-hc-ink-2">{label}</span>
      <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
        className="mt-0.5 min-h-11 w-full rounded-lg border border-hc-control bg-hc-surface px-2.5 text-sm text-hc-ink outline-none focus:border-hc-brand-dark focus:ring-2 focus:ring-hc-brand/25" />
    </label>
  );

  return (
    <Sheet title="Nýr hópur" onClose={onClose} max="max-w-md">
      <div className="p-4 pt-0">
        <p className="font-bold text-hc-ink">Nýr hópur</p>
        <p className="mt-0.5 text-sm text-hc-ink-2">
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
        {msg && <p role="alert" className="mt-2 text-sm text-hc-bad-ink">{msg}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy || !f.name.trim()} onClick={save}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-hc-brand-dark px-3 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Stofna hóp
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-hc-control px-3 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">Hætta við</button>
        </div>
      </div>
    </Sheet>
  );
}

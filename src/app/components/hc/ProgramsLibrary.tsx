"use client";

/*
 * Prógrömm — the exercise and nutrition programmes a coach builds from.
 *
 * The tab was "Fræðsla" and held lectures plus a list of exercises, which
 * made it a reading room. The programmes themselves lived in /admin, behind
 * an admin gate a coach may not pass, so the person whose job is to put a
 * programme together could read about one but not write one.
 *
 * Two switches, and they are not the same switch:
 *
 *   Í boði fyrir alla   the template's `active` flag. It governs what every
 *                       picker shows, for every coach and client. This is
 *                       publishing.
 *   Stinga upp á        one programme offered to one person, who accepts or
 *                       declines. This is a conversation.
 *
 * Eleven exercise programmes and eight nutrition ones already existed when
 * this was built, with one of each switched on — so most of the library was
 * written and invisible. That is the first thing this screen makes obvious.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { hcBtn, hcTabs } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type Kind = "exercise" | "nutrition";

interface Program {
  key: string;
  name: string;
  goal: string | null;
  description: string | null;
  principles: string[] | null;
  active: boolean;
  level?: string | null;
  days_per_week?: number | null;
  session_minutes?: number | null;
}

const KIND_IS: Record<Kind, string> = { exercise: "Æfingar", nutrition: "Næring" };

export default function ProgramsLibrary({ api, people }: {
  api: Api;
  /** Who a programme can be suggested to. Empty disables the suggest path. */
  people: { id: string; name: string }[];
}) {
  const [kind, setKind] = useState<Kind>("exercise");
  const [rows, setRows] = useState<Record<Kind, Program[]>>({ exercise: [], nutrition: [] });
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Program | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/programs").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      setRows({ exercise: j?.exercise ?? [], nutrition: j?.nutrition ?? [] });
      setLoading(false);
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const save = async (p: Program) => {
    const r = await api("/api/vinnustod/programs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, kind }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setMsg(j.error || "Tókst ekki að vista."); return; }
    setEdit(null); setMsg(""); await load();
  };

  const toggle = async (p: Program) => { await save({ ...p, active: !p.active }); };

  const remove = async (p: Program) => {
    const r = await api(`/api/vinnustod/programs?kind=${kind}&key=${encodeURIComponent(p.key)}`, { method: "DELETE" })
      .catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    /* The server refuses to delete a programme somebody is on, and says so
       — repeated here rather than swallowed, because "nothing happened" is
       the worst possible answer to a delete. */
    if (!r?.ok) { setMsg(j.error || "Tókst ekki að eyða."); return; }
    setMsg(""); await load();
  };

  const list = rows[kind];
  const live = list.filter((p) => p.active).length;

  return (
    <div className="space-y-4">
      <div className={hcTabs.bar}>
        {(["exercise", "nutrition"] as const).map((k) => (
          <button key={k} type="button" onClick={() => { setKind(k); setEdit(null); }}
            className={hcTabs.tab(kind === k)}>
            {KIND_IS[k]} · {rows[k].length}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Said plainly, because it is the thing most likely to be wrong:
            a library of programmes nobody can pick from looks identical to
            an empty library from inside the plan builder. */}
        <p className="text-sm text-hc-ink-2">
          <strong className="text-hc-ink">{live}</strong> af {list.length} í boði fyrir alla.
        </p>
        <span className="flex-1" />
        <button type="button" onClick={() => setEdit({
          key: "", name: "", goal: "", description: "", principles: [], active: false,
        })} className={`${hcBtn.primary} min-h-9`}>
          <Plus className="h-4 w-4" aria-hidden /> Nýtt prógramm
        </button>
      </div>

      {msg && (
        <p role="status" className="rounded-xl bg-hc-bad-surface px-3 py-2 text-sm font-semibold text-hc-bad-ink">
          {msg}
        </p>
      )}

      {edit && <Editor kind={kind} value={edit} onCancel={() => setEdit(null)} onSave={save} />}

      {loading ? (
        <p className="py-8 text-center text-sm text-hc-ink-2">Hleð…</p>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <Row key={p.key} p={p} kind={kind} api={api} people={people}
              onEdit={() => setEdit(p)} onToggle={() => void toggle(p)} onDelete={() => void remove(p)} />
          ))}
          {list.length === 0 && (
            <li className="rounded-2xl border border-hc-hairline bg-hc-surface px-4 py-8 text-center text-sm text-hc-ink-2">
              Ekkert prógramm enn.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Row({ p, kind, api, people, onEdit, onToggle, onDelete }: {
  p: Program; kind: Kind; api: Api; people: { id: string; name: string }[];
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [confirm, setConfirm] = useState(false);

  const suggest = async () => {
    if (!to) return;
    setBusy(true);
    const r = await api("/api/vinnustod/programs/suggest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyId: to, kind, key: p.key, note: note.trim() || undefined }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    setSent(r?.ok ? "Tillaga send." : (j.error || "Tókst ekki að senda."));
    if (r?.ok) { setNote(""); setTo(""); }
  };

  return (
    <li className="rounded-2xl border border-hc-hairline bg-hc-surface">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hc-ink">{p.name}</span>
          <span className="block text-xs text-hc-ink-2">
            {[p.goal, p.level, p.days_per_week ? `${p.days_per_week}× í viku` : null]
              .filter(Boolean).join(" · ") || "—"}
          </span>
        </span>

        {/* The publishing switch, reading as a state rather than a verb: it
            says what is true now, and clicking changes it. */}
        <button type="button" onClick={onToggle}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
            p.active ? "bg-hc-ok-surface text-hc-ok-ink ring-1 ring-hc-ok-ink/30"
                     : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-hc-sunken"}`}>
          {p.active ? <><Check className="mr-1 inline h-3 w-3" aria-hidden />Í boði fyrir alla</> : "Ekki í boði"}
        </button>

        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="shrink-0 rounded-lg p-2 text-hc-ink-2 hover:bg-hc-sunken" aria-label="Stinga upp á">
          <Send className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={onEdit} className="shrink-0 rounded-lg p-2 text-hc-ink-2 hover:bg-hc-sunken" aria-label="Breyta">
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => setConfirm(true)} className="shrink-0 rounded-lg p-2 text-hc-ink-2 hover:bg-hc-bad-surface hover:text-hc-bad-ink" aria-label="Eyða">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Deleting asks first. It is the one action here that cannot be
          undone, and it sits next to two that can. */}
      {confirm && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hc-hairline bg-hc-bad-surface px-3 py-2">
          <p className="min-w-0 flex-1 text-sm text-hc-bad-ink">Eyða „{p.name}“?</p>
          <button type="button" onClick={() => { setConfirm(false); onDelete(); }}
            className="rounded-lg bg-hc-bad-ink px-3 py-1.5 text-xs font-bold text-white">Eyða</button>
          <button type="button" onClick={() => setConfirm(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-hc-ink-2">Hætta við</button>
        </div>
      )}

      {open && (
        <div className="space-y-2 border-t border-hc-hairline p-3">
          <p className="text-xs text-hc-ink-2">
            Skjólstæðingurinn fær tillöguna og velur sjálf/ur hvort hún er tekin upp.
          </p>
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Skjólstæðingur"
            className="w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm text-hc-ink">
            <option value="">Veldu skjólstæðing…</option>
            {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Af hverju þetta prógramm? (valfrjálst)" aria-label="Athugasemd"
            className="w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm text-hc-ink" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void suggest()} disabled={busy || !to}
              className={`${hcBtn.primary} min-h-9 disabled:opacity-40`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Senda tillögu
            </button>
            {sent && <span className="text-sm text-hc-ink-2">{sent}</span>}
          </div>
        </div>
      )}
    </li>
  );
}

function Editor({ kind, value, onCancel, onSave }: {
  kind: Kind; value: Program; onCancel: () => void; onSave: (p: Program) => void;
}) {
  const [p, setP] = useState<Program>(value);
  const set = (patch: Partial<Program>) => setP((v) => ({ ...v, ...patch }));

  return (
    <section className="space-y-3 rounded-2xl border border-hc-hairline bg-hc-surface p-4">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 font-bold text-hc-ink">{value.key ? "Breyta prógrammi" : "Nýtt prógramm"}</h3>
        <button type="button" onClick={onCancel} aria-label="Hætta við"
          className="rounded-lg p-1.5 text-hc-ink-2 hover:bg-hc-sunken"><X className="h-4 w-4" aria-hidden /></button>
      </div>

      <label className="block text-xs font-semibold text-hc-ink-2">Heiti
        <input value={p.name} onChange={(e) => set({ name: e.target.value })}
          className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm font-normal text-hc-ink" />
      </label>
      <label className="block text-xs font-semibold text-hc-ink-2">Markmið
        <input value={p.goal ?? ""} onChange={(e) => set({ goal: e.target.value })}
          className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm font-normal text-hc-ink" />
      </label>
      <label className="block text-xs font-semibold text-hc-ink-2">Lýsing
        <textarea value={p.description ?? ""} onChange={(e) => set({ description: e.target.value })} rows={3}
          className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm font-normal text-hc-ink" />
      </label>

      {kind === "exercise" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-hc-ink-2">Stig
            <input value={p.level ?? ""} onChange={(e) => set({ level: e.target.value })}
              className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm font-normal text-hc-ink" />
          </label>
          <label className="block text-xs font-semibold text-hc-ink-2">Dagar í viku
            <input type="number" min={1} max={7} value={p.days_per_week ?? ""}
              onChange={(e) => set({ days_per_week: e.target.value ? Number(e.target.value) : null })}
              className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm font-normal text-hc-ink" />
          </label>
          <label className="block text-xs font-semibold text-hc-ink-2">Mínútur
            <input type="number" min={5} max={180} value={p.session_minutes ?? ""}
              onChange={(e) => set({ session_minutes: e.target.value ? Number(e.target.value) : null })}
              className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm font-normal text-hc-ink" />
          </label>
        </div>
      )}

      <label className="block text-xs font-semibold text-hc-ink-2">Meginreglur — ein lína á reglu
        <textarea value={(p.principles ?? []).join("\n")}
          onChange={(e) => set({ principles: e.target.value.split("\n") })} rows={4}
          className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2 text-sm font-normal text-hc-ink" />
      </label>

      {/* Off by default on a new programme: something half-written should
          not appear in every coach's picker the moment it is saved. */}
      <label className="flex items-center gap-2 text-sm text-hc-ink">
        <input type="checkbox" checked={p.active} onChange={(e) => set({ active: e.target.checked })}
          className="h-4 w-4 rounded border-hc-control" />
        Í boði fyrir alla
      </label>

      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(p)} disabled={!p.name.trim()}
          className={`${hcBtn.primary} disabled:opacity-40`}>Vista</button>
        <button type="button" onClick={onCancel} className={hcBtn.secondary}>Hætta við</button>
      </div>
    </section>
  );
}

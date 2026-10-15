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
import ExerciseSessionsEditor from "./ExerciseSessionsEditor";
import DayExampleEditor from "./DayExampleEditor";
import { isAdaptive } from "@/lib/hc/adaptive-program";
import { useToast } from "./Toast";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type Kind = "exercise" | "nutrition";

interface Program {
  key: string;
  /** Exercise: the week's sessions, each with its own items. */
  sessions?: unknown[];
  /** Nutrition: a day of meals as an example. */
  day_example?: unknown[];
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
  const [loadErr, setLoadErr] = useState(false);
  /* Which programme a save or delete is running for ("new" for the editor),
     so the button says it is working and a second click does nothing. */
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/programs").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      /* Not "Ekkert prógramm enn" when the list never arrived. */
      setLoadErr(!j);
      setRows({ exercise: j?.exercise ?? [], nutrition: j?.nutrition ?? [] });
      setLoading(false);
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  /** Returns whether it stored, so the caller knows what to say. */
  const save = async (p: Program, busyKey: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(busyKey); setMsg("");
    const r = await api("/api/vinnustod/programs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      /* isNew lets the server refuse a new programme whose name makes the
         key of one that already exists, instead of overwriting it. */
      body: JSON.stringify({ ...p, kind, isNew: !p.key }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    if (!r) { setMsg("Engin tenging. Ekkert var vistað."); return false; }
    if (!r.ok) { setMsg(j.error === "bad_request" ? "Tókst ekki að vista." : (j.error || "Tókst ekki að vista.")); return false; }
    await load();
    return true;
  };

  const saveEdit = async (p: Program) => {
    if (await save(p, "new")) { setEdit(null); toast.show(`„${p.name.trim()}“ vistað.`); }
  };

  const toggle = async (p: Program) => {
    if (await save({ ...p, active: !p.active }, p.key)) {
      toast.show(!p.active ? `„${p.name}“ er nú í boði fyrir alla.` : `„${p.name}“ er ekki lengur í boði.`);
    }
  };

  const remove = async (p: Program) => {
    if (busy) return;
    setBusy(p.key); setMsg("");
    const r = await api(`/api/vinnustod/programs?kind=${kind}&key=${encodeURIComponent(p.key)}`, { method: "DELETE" })
      .catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    /* The server refuses to delete a programme somebody is on, and says so
       — repeated here rather than swallowed, because "nothing happened" is
       the worst possible answer to a delete. */
    if (!r) { setMsg("Engin tenging. Ekkert var eytt."); return; }
    if (!r.ok) { setMsg(r.status === 409 && j.error ? j.error : "Tókst ekki að eyða."); return; }
    await load();
    toast.show(`„${p.name}“ eytt.`);
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
          sessions: [], day_example: [],
        })} className={`${hcBtn.primary} min-h-9`}>
          <Plus className="h-4 w-4" aria-hidden /> Nýtt prógramm
        </button>
      </div>

      {msg && (
        <p role="alert" className="rounded-xl bg-hc-bad-surface px-3 py-2 text-sm font-semibold text-hc-bad-ink">
          {msg}
        </p>
      )}

      {edit && <Editor kind={kind} value={edit} api={api} saving={busy === "new"} onCancel={() => setEdit(null)} onSave={(p) => void saveEdit(p)} />}

      {loading ? (
        <p className="py-8 text-center text-sm text-hc-ink-2">Hleð…</p>
      ) : loadErr ? (
        <p role="alert" className="rounded-2xl border border-hc-hairline bg-hc-bad-surface px-4 py-6 text-center text-sm text-hc-bad-ink">
          Náði ekki í prógrömmin.{" "}
          <button type="button" onClick={() => { setLoading(true); void load(); }} className="font-semibold underline underline-offset-2">Reyna aftur</button>
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <Row key={p.key} p={p} kind={kind} api={api} people={people} busy={busy === p.key} locked={busy !== null}
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

function Row({ p, kind, api, people, busy: rowBusy, locked, onEdit, onToggle, onDelete }: {
  p: Program; kind: Kind; api: Api; people: { id: string; name: string }[];
  /** A save or delete is running for this row / for any row. */
  busy: boolean; locked: boolean;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const suggest = async () => {
    if (!to || busy) return;
    setBusy(true); setSent(null);
    const r = await api("/api/vinnustod/programs/suggest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyId: to, kind, key: p.key, note: note.trim() || undefined }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    setSent(r?.ok ? { ok: true, text: "Tillaga send." }
      : { ok: false, text: !r ? "Engin tenging. Tillagan fór ekki."
        : r.status === 404 && j.error && j.error !== "not_found" ? j.error
        : "Tókst ekki að senda tillöguna." });
    if (r?.ok) { setNote(""); setTo(""); }
  };

  return (
    <li className="rounded-2xl border border-hc-hairline bg-hc-surface">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hc-ink">{p.name}</span>
          <span className="block text-xs text-hc-ink-2">
            {[p.goal, p.level, p.days_per_week ? `${p.days_per_week}× í viku` : null,
              kind === "exercise"
                ? (isAdaptive(p.key) ? "reiknað" : `${(p.sessions ?? []).length} æfingadagar`)
                : `${(p.day_example ?? []).length} máltíðir`]
              .filter(Boolean).join(" · ") || "—"}
          </span>
        </span>

        {/* The publishing switch, reading as a state rather than a verb: it
            says what is true now, and clicking changes it. */}
        <button type="button" onClick={onToggle} disabled={locked} aria-busy={rowBusy}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
            p.active ? "bg-hc-ok-surface text-hc-ok-ink ring-1 ring-hc-ok-ink/30"
                     : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-hc-sunken"}`}>
          {rowBusy ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden /> : p.active ? <Check className="mr-1 inline h-3 w-3" aria-hidden /> : null}
          {p.active ? "Í boði fyrir alla" : "Ekki í boði"}
        </button>

        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="shrink-0 rounded-lg p-2 text-hc-ink-2 hover:bg-hc-sunken" aria-label="Stinga upp á">
          <Send className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={onEdit} className="shrink-0 rounded-lg p-2 text-hc-ink-2 hover:bg-hc-sunken" aria-label="Breyta">
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => setConfirm(true)} disabled={locked} className="shrink-0 disabled:opacity-50 rounded-lg p-2 text-hc-ink-2 hover:bg-hc-bad-surface hover:text-hc-bad-ink" aria-label="Eyða">
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
            {sent && (
              <span role={sent.ok ? "status" : "alert"}
                className={`text-sm ${sent.ok ? "font-semibold text-hc-ok-ink" : "font-semibold text-hc-bad-ink"}`}>
                {sent.text}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Editor({ kind, value, api, saving, onCancel, onSave }: {
  kind: Kind; value: Program; api: Api; saving: boolean; onCancel: () => void; onSave: (p: Program) => void;
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

      {/* The programme's actual content, not just its description.
          Editing a programme without being able to touch the exercises or
          the meals in it meant the library could only ever be renamed —
          the sessions came from whoever seeded the table. Both editors own
          their own pickers, so the exercise library and the meal library
          arrive with them. */}
      {kind === "exercise" && isAdaptive(p.key) ? (
        /* The adaptive programme has no stored sessions, and an empty
           session editor says "this programme is blank" when what is true
           is "this programme is computed". hiit-styrkur is the only ACTIVE
           exercise programme, so this empty box was the one every coach
           saw — the ten with real sessions are all switched off. */
        <div className="rounded-xl bg-hc-info-surface p-3 ring-1 ring-hc-info-ink/25">
          <p className="text-sm font-semibold text-hc-info-ink">Æfingarnar eru reiknaðar fyrir hvern skjólstæðing</p>
          <p className="mt-1 text-xs leading-snug text-hc-ink-2">
            Þetta prógramm geymir ekki fastar æfingar. Þær eru settar saman eftir byrjunarstigi,
            álagi og meiðslum hvers og eins, og skjólstæðingurinn getur stillt þær sjálf/ur.
            Til að breyta uppbyggingunni þarf að breyta reglunum, ekki listanum hér.
          </p>
        </div>
      ) : kind === "exercise" ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-hc-ink-2">Æfingar í prógramminu</p>
          <ExerciseSessionsEditor api={api}
            sessions={(p.sessions ?? []) as never}
            onChange={(sessions) => set({
              sessions,
              /* Days per week follows the sessions rather than being typed
                 twice: a programme with four sessions and "3" in the box is
                 wrong in a way nobody notices until a client counts. */
              days_per_week: sessions.length || p.days_per_week || null,
            })} />
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-hc-ink-2">Dæmi um dag</p>
          <DayExampleEditor api={api}
            value={(p.day_example ?? []) as never}
            onChange={(day_example) => set({ day_example })} />
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
        <button type="button" onClick={() => onSave(p)} disabled={!p.name.trim() || saving}
          className={`${hcBtn.primary} disabled:opacity-40`}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Vista
        </button>
        <button type="button" onClick={onCancel} className={hcBtn.secondary}>Hætta við</button>
      </div>
    </section>
  );
}

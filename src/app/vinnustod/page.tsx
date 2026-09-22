"use client";

// Lifeline vinnustöð — the workstation for nurses (Lifeline and partners
// such as Vera) and Lifeline doctors. No /admin access needed: own cookie
// auth (src/lib/hc/ws-auth.ts). Queue by stage → patient card → record
// milestones → build and publish the action plan.

import { useCallback, useEffect, useMemo, useState } from "react";
import LifelineLogo from "@/app/components/LifelineLogo";
import PinPad from "@/app/components/hc/PinPad";
import PlanBuilder from "@/app/components/hc/PlanBuilder";
import { EVENT_LABELS, type JourneyEvent } from "@/lib/hc/events-labels";

interface Me { id: string; name: string; email: string; organization: string; role: "nurse" | "doctor" | "admin"; has_pin: boolean }
interface QueueRow {
  id: string; client_name: string; client_phone: string | null; stage: string; entry: string;
  blood_results_at: string | null; blood_test_done_at: string | null; measurements_done_at: string | null;
  report_generated_at: string | null; report_sms_sent_at: string | null;
  interview_booked_for: string | null; interview_mode: string | null; interview_done_at: string | null;
  plan_published_at: string | null; followup_booked_for: string | null; followup_done_at: string | null;
  referral_to_heilsugaesla: boolean; plan_status: string | null; updated_at: string;
}

const ws = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, credentials: "same-origin", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) } });

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("is-IS", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function minutesSince(iso: string | null) {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 0;
}

export default function Vinnustod() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const load = useCallback(async () => {
    const r = await ws("/api/vinnustod/me");
    setMe(r.ok ? (await r.json()).me : null);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  if (me === undefined) return <div className="p-10 text-center text-slate-500">Hleð…</div>;
  if (me === null) return <Login onDone={load} />;
  return <Workstation me={me} onLogout={() => setMe(null)} onPinSet={load} />;
}

// ── Login ──────────────────────────────────────────────────────────────────

function Login({ onDone }: { onDone: () => void }) {
  const [trusted, setTrusted] = useState<{ name: string } | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trust, setTrust] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ws("/api/vinnustod/auth/pin").then((r) => r.json()).then((j) => j.trusted && setTrusted({ name: j.name })).catch(() => {});
  }, []);

  const loginPin = async (v: string) => {
    setBusy(true); setError("");
    const r = await ws("/api/vinnustod/auth/pin", { method: "POST", body: JSON.stringify({ pin: v }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setPin(""); setError(j.error || "Tókst ekki."); if (j.locked) setTrusted(null); return; }
    onDone();
  };
  const loginPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await ws("/api/vinnustod/auth/login", { method: "POST", body: JSON.stringify({ email, password, trust_device: trust }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error || "Tókst ekki."); return; }
    onDone();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm">
        <LifelineLogo size="lg" />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Vinnustöð</p>
        {trusted && !usePassword ? (
          <div className="mt-6">
            <p className="text-center text-sm text-slate-600">Hæ {trusted.name.split(" ")[0]}, sláðu inn PIN</p>
            <div className="mt-5"><PinPad value={pin} onChange={setPin} onComplete={loginPin} disabled={busy} error={!!error} /></div>
            {error && <p role="alert" className="mt-4 text-center text-sm text-red-600">{error}</p>}
            <button onClick={() => setUsePassword(true)} className="mt-5 block w-full text-center text-sm text-slate-500">Nota lykilorð</button>
          </div>
        ) : (
          <form onSubmit={loginPw} className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Netfang" autoComplete="username" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Lykilorð" autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Treysta þessu tæki (PIN næst)</label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-[#10B981] py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Augnablik…" : "Skrá inn"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Workstation ────────────────────────────────────────────────────────────

const COLUMNS: { key: string; title: string; hint: string }[] = [
  { key: "report", title: "Bíður skýrslu", hint: "Svör komin. Læknir staðfestir." },
  { key: "tests", title: "Blóðprufa og mælingar", hint: "Virkjað, bíður niðurstaðna." },
  { key: "interview", title: "Bíður viðtals", hint: "Skýrsla tilbúin." },
  { key: "plan", title: "Bíður áætlunar", hint: "Viðtali lokið." },
  { key: "action", title: "Í aðgerð", hint: "Áætlun birt, eftirfylgd." },
];

function Workstation({ me, onLogout, onPinSet }: { me: Me; onLogout: () => void; onPinSet: () => void }) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const load = useCallback(async () => {
    const r = await ws("/api/vinnustod/queue");
    if (r.status === 401) { onLogout(); return; }
    if (r.ok) setRows((await r.json()).journeys);
  }, [onLogout]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.client_name.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  const logout = async () => { await ws("/api/vinnustod/auth/logout", { method: "POST" }); onLogout(); };

  if (planFor) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <button onClick={() => { setPlanFor(null); void load(); }} className="mb-4 text-sm font-medium text-slate-600 hover:text-slate-900">← Aftur í vinnustöð</button>
        <PlanBuilder journeyId={planFor} api={ws} onPublished={() => void load()} />
      </div>
    );
  }

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <LifelineLogo size="sm" />
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Vinnustöð</span>
          <span className="flex-1" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að nafni…" className="hidden w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm sm:block" />
          <button onClick={() => setShowGuide(true)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Verklag</button>
          <button onClick={() => setShowPin(true)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">{me.has_pin ? "Breyta PIN" : "Setja PIN"}</button>
          <span className="hidden text-sm text-slate-500 md:inline">{me.name} · {me.role === "doctor" ? "læknir" : me.role === "admin" ? "stjórnandi" : "hjúkrunarfr."}</span>
          <button onClick={logout} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium">Útskrá</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((c) => {
            const list = filtered.filter((r) => r.stage === c.key);
            return (
              <section key={c.key} className="rounded-2xl bg-white p-3 shadow-sm">
                <div className="mb-2 px-1">
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-bold text-[#0F172A]">{c.title}</h2>
                    <span className="text-sm font-semibold text-slate-400">{list.length}</span>
                  </div>
                  <p className="text-xs text-slate-500">{c.hint}</p>
                </div>
                <div className="space-y-2">
                  {list.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Ekkert hér</p>}
                  {list.map((r) => {
                    const waited = c.key === "report" ? minutesSince(r.blood_results_at) : 0;
                    const late = c.key === "report" && waited >= 5;
                    return (
                      <button key={r.id} onClick={() => setSelected(r.id)}
                        className={`w-full rounded-xl border p-3 text-left transition hover:shadow ${late ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50/60"}`}>
                        <p className="truncate font-semibold text-slate-800">{r.client_name}</p>
                        <p className="text-xs text-slate-500">
                          {c.key === "report" && `Svör fyrir ${waited} mín.${r.report_sms_sent_at ? " · SMS sent" : ""}`}
                          {c.key === "tests" && `Blóð ${r.blood_test_done_at ? "✓" : "–"} · Mælingar ${r.measurements_done_at ? "✓" : "–"}`}
                          {c.key === "interview" && (r.interview_booked_for ? `Bókað ${fmt(r.interview_booked_for)}` : "Óbókað")}
                          {c.key === "plan" && (r.plan_status === "draft" ? "Drög í vinnslu" : "Engin drög")}
                          {c.key === "action" && (r.followup_booked_for ? `Eftirfylgd ${fmt(r.followup_booked_for)}` : "Áætlun birt")}
                        </p>
                        <div className="mt-1 flex gap-1">
                          {r.entry === "b2b" && <span className="rounded bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-700">Fyrirtæki</span>}
                          {r.entry === "heilsugaesla" && <span className="rounded bg-violet-50 px-1.5 text-[10px] font-semibold text-violet-700">Tilvísun</span>}
                          {r.referral_to_heilsugaesla && <span className="rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-800">Vísað á HG</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {selected && <PatientDrawer id={selected} me={me} onClose={() => setSelected(null)} onChanged={load} onPlan={(id) => { setSelected(null); setPlanFor(id); }} />}
      {showPin && <PinModal onClose={() => setShowPin(false)} onDone={() => { setShowPin(false); onPinSet(); }} />}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}

// ── Patient drawer ─────────────────────────────────────────────────────────

interface Detail {
  journey: Record<string, string | boolean | null> & { id: string };
  patient: { full_name: string | null; kennitala: string | null; email: string | null; phone: string | null; address: string | null };
  orders: { id: string; kind: string; payment_route: string; paid_at: string | null; activation_code: string | null; activation_redeemed_at: string | null }[];
  audit: { actor: string; action: string; at: string; note: string | null }[];
  plan: { status: string; published_at: string | null; headline: string | null } | null;
  location: { name: string } | null;
  actor: { label: string; isDoctor: boolean };
}

function PatientDrawer({ id, me, onClose, onChanged, onPlan }: { id: string; me: Me; onClose: () => void; onChanged: () => void; onPlan: (id: string) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [when, setWhen] = useState("");
  const [mode, setMode] = useState<"in_person" | "video">("in_person");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await ws(`/api/vinnustod/journeys/${id}`);
    if (r.ok) setD(await r.json());
  }, [id]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const record = async (event: JourneyEvent, extra: Record<string, unknown> = {}) => {
    setBusy(true); setErr("");
    const r = await ws(`/api/vinnustod/journeys/${id}`, { method: "POST", body: JSON.stringify({ event, ...extra }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Tókst ekki."); return; }
    setWhen(""); setNote("");
    await load();
    onChanged();
  };

  const j = d?.journey;
  const isDoctor = me.role === "doctor" || me.role === "admin";
  const kt = d?.patient.kennitala;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Skjólstæðingur">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{d?.patient.full_name ?? "…"}</h2>
            <p className="text-sm text-slate-500">
              {kt ? `${kt.slice(0, 6)}-${kt.slice(6)}` : ""}{d?.patient.phone ? ` · ${d.patient.phone}` : ""}{d?.location ? ` · ${d.location.name}` : ""}
            </p>
            {d?.patient.email && <p className="text-sm text-slate-500">{d.patient.email}</p>}
          </div>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700" aria-label="Loka">×</button>
        </div>

        {j && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              {([
                ["Greitt", j.paid_at], ["Virkjað", j.protocol_activated_at], ["Blóðprufa", j.blood_test_done_at],
                ["Svör komin", j.blood_results_at], ["Mælingar", j.measurements_done_at], ["Skýrsla", j.report_generated_at],
                ["Viðtal bókað", j.interview_booked_for], ["Viðtali lokið", j.interview_done_at], ["Áætlun birt", j.plan_published_at],
                ["Eftirfylgd", j.followup_booked_for],
              ] as [string, string | boolean | null][]).map(([label, v]) => (
                <div key={label} className={`rounded-lg px-3 py-2 ${v ? "bg-emerald-50" : "bg-slate-50"}`}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`font-medium ${v ? "text-emerald-900" : "text-slate-400"}`}>{typeof v === "string" ? fmt(v) : "—"}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Aðgerðir</h3>

              {!j.report_generated_at && j.blood_results_at && (
                isDoctor
                  ? <button disabled={busy} onClick={() => record("report_generated")} className="w-full rounded-xl bg-[#0F172A] py-3 font-semibold text-white disabled:opacity-50">Staðfesta og búa til skýrslu</button>
                  : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Bíður þess að læknir staðfesti skýrsluna.</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {!j.blood_test_done_at && <Btn onClick={() => record("blood_test_done")} busy={busy}>Blóðprufa tekin</Btn>}
                {!j.blood_results_at && <Btn onClick={() => record("blood_results_ready")} busy={busy}>Blóðprufusvör komin</Btn>}
                {!j.measurements_done_at && <Btn onClick={() => record("measurements_done")} busy={busy}>Mælingum lokið</Btn>}
                {j.report_generated_at && !j.interview_done_at && <Btn onClick={() => record("interview_done")} busy={busy}>Viðtali lokið</Btn>}
                {j.plan_published_at && !j.followup_done_at && j.followup_booked_for && <Btn onClick={() => record("followup_done")} busy={busy}>Eftirfylgd lokið</Btn>}
              </div>

              {j.report_generated_at && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold">{j.interview_done_at ? "Bóka eftirfylgd" : "Bóka viðtal"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    {!j.interview_done_at && (
                      <select value={mode} onChange={(e) => setMode(e.target.value as "in_person" | "video")} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                        <option value="in_person">Á staðnum</option>
                        <option value="video">Myndsímtal</option>
                      </select>
                    )}
                    <button disabled={!when || busy}
                      onClick={() => record(j.interview_done_at ? "followup_booked" : "interview_booked", { at: new Date(when).toISOString(), mode })}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Bóka</button>
                  </div>
                </div>
              )}

              {j.report_generated_at && (
                <button onClick={() => onPlan(id)} className="w-full rounded-xl bg-[#10B981] py-3 font-semibold text-white hover:bg-[#047857]">
                  {d.plan ? (d.plan.status === "published" ? "Opna / uppfæra aðgerðaáætlun" : "Halda áfram með drög að áætlun") : "Búa til aðgerðaáætlun"}
                </button>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <p className="text-sm font-semibold text-amber-900">Tilvísun á Heilsugæsluna</p>
                <p className="text-xs text-amber-800">Ef heilsufarsvandi greinist sem gæti þurft meðferð. {isDoctor ? "" : "Læknir skráir tilvísun."}</p>
                {j.referral_to_heilsugaesla
                  ? <p className="mt-1 text-sm text-amber-900">Vísað {fmt(j.referred_at as string | null)}{j.referral_note ? `: ${j.referral_note}` : ""}</p>
                  : isDoctor && (
                    <div className="mt-2 flex gap-2">
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ástæða (fer ekki til skjólstæðings)" className="flex-1 rounded-lg border border-amber-200 px-2 py-1.5 text-sm" />
                      <button disabled={busy || !note} onClick={() => record("referral_heilsugaesla", { note })} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Skrá</button>
                    </div>
                  )}
              </div>
              {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Greiðslur og kóðar</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {d.orders.map((o) => (
                  <li key={o.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>{o.kind === "health_check" ? "Heilsufarsskoðun" : o.kind === "followup_3m" ? "Eftirfylgd" : o.kind === "reevaluation" ? "Endurmat" : "Aukaviðtal"} · {o.payment_route === "company" ? "fyrirtæki" : o.payment_route === "union" ? "stéttarfélag" : "sjálf(ur)"}</span>
                    <span className="font-mono text-xs text-slate-500">{o.activation_code}{o.activation_redeemed_at ? " ✓" : ""}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Saga</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {d.audit.map((a, i) => (
                  <li key={i} className="flex gap-2"><span className="w-24 shrink-0 text-slate-400">{fmt(a.at)}</span><span>{labelFor(a.action)} · {a.actor}{a.note ? ` · ${a.note}` : ""}</span></li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function labelFor(action: string) {
  if (action.startsWith("event:")) return EVENT_LABELS[action.slice(6) as JourneyEvent] ?? action;
  const map: Record<string, string> = {
    paid: "Greitt", paid_followup: "Eftirfylgd greidd", profile_complete: "Upplýsingar skráðar", welcome_seen: "Kynning skoðuð",
    plan_published: "Áætlun birt", plan_republished: "Áætlun uppfærð", plan_created: "Drög að áætlun", report_sms_escalation: "SMS til læknis",
    union_claim_sent: "Umsókn send stéttarfélagi",
  };
  return map[action] ?? action;
}

function Btn({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy: boolean }) {
  return <button disabled={busy} onClick={onClick} className="rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">{children}</button>;
}

function PinModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const save = async (v: string) => {
    const r = await ws("/api/vinnustod/auth/pin", { method: "PUT", body: JSON.stringify({ pin: v }) });
    if (!r.ok) { setPin(""); setErr((await r.json().catch(() => ({}))).error || "Tókst ekki."); return; }
    onDone();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="PIN">
        <p className="mb-4 text-center font-semibold">Veldu 4 stafa PIN</p>
        <PinPad value={pin} onChange={setPin} onComplete={save} error={!!err} />
        {err && <p className="mt-3 text-center text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}

function GuideModal({ onClose }: { onClose: () => void }) {
  const steps = [
    ["Undirbúningur", "Opnaðu skýrsluna í sjúklingagáttinni: svefn, hreyfing, næring, andleg líðan, mælingar og blóðprufur. Merktu við það sem stendur upp úr."],
    ["Viðtal (30–45 mín.)", "Byrjaðu á því sem skjólstæðingurinn vill breyta. Farðu yfir hverja stoð og niðurstöður mælinga og blóðprufa á mannamáli."],
    ["Frávik", "Ef niðurstöður gefa til kynna heilsufarsvanda sem gæti þurft meðferð: hafðu samband við lækni Lifeline, sem skráir tilvísun á Heilsugæsluna."],
    ["Aðgerðaáætlun", "Veldu sniðmát sem passar, dragðu inn 2–4 aðgerðir á stoð í mesta lagi og skrifaðu persónulegar athugasemdir. Færri og raunhæfar aðgerðir virka betur."],
    ["Birting", "Forskoðaðu og birtu. Skjólstæðingurinn fær tölvupóst. Minntu á eftirfylgd eftir 3 mánuði."],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Verklag">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Verklag viðtals</h2>
          <button onClick={onClose} className="text-2xl text-slate-400" aria-label="Loka">×</button>
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map(([t, b], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">{i + 1}</span>
              <div><p className="font-semibold">{t}</p><p className="text-sm text-slate-600">{b}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

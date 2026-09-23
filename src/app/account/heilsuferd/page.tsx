"use client";

// Heilsuferðin — the customer's self-service health-check journey. One flow
// for B2C and B2B; only the way in and the way of paying differ. Every step
// is either the customer's own action here, or advances by itself (patient
// portal, workstation). Backed by /api/hc/*.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BackLink from "@/app/components/hc/BackLink";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import PinPad from "@/app/components/hc/PinPad";
import CalendarConnect, { CalendarStatus, type CalendarApi } from "@/app/components/hc/CalendarConnect";
import type { JourneyStep, StepKey } from "@/lib/hc/stages";
import { formatIsk, type HcJourney, type HcLocation, type HcOrder, type HcPackage } from "@/lib/hc/types";
import { quote, type UnionRules } from "@/lib/hc/reimbursement";

interface JourneyData {
  journey: HcJourney;
  steps: JourneyStep[];
  profile: { email: string; full_name: string | null; phone: string | null; address: string | null; kennitala_last4: string | null; complete: boolean; company_name: string | null };
  location: HcLocation | null;
  packages: HcPackage[];
  orders: HcOrder[];
  claims: { id: string; order_id: string; union_id: string; union_name: string | null; reimbursable_isk: number; status: string; sent_at: string | null; sent_to: string | null }[];
  lectures: { id: string; slug: string; title: string; subtitle: string | null; kind: string; duration_min: number | null; pillar: string | null; is_welcome: boolean; completed_at: string | null }[];
  plan: { id: string; headline: string | null; published_at: string; review_date: string | null } | null;
  calendar_connected: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function api(url: string, init: RequestInit = {}) {
  const headers = { ...(await authHeaders()), ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) };
  return fetch(url, { ...init, headers });
}

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("is-IS", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric" }) : null;

export default function HeilsuferdPage() {
  return (
    <Suspense>
      <Heilsuferd />
    </Suspense>
  );
}

function Heilsuferd() {
  const router = useRouter();
  const params = useSearchParams();
  const stadur = params.get("stadur") || "";
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<StepKey | null>(null);

  const load = useCallback(async (): Promise<JourneyData | null> => {
    const r = await api(`/api/hc/journey${stadur ? `?stadur=${encodeURIComponent(stadur)}` : ""}`);
    if (r.status === 401) { setAuthed(false); return null; }
    if (!r.ok) { setError("Ekki tókst að sækja heilsuferðina. Reyndu aftur."); return null; }
    const j = (await r.json()) as JourneyData;
    setData(j);
    setOpen((o) => o ?? j.steps.find((s) => s.state === "current")?.key ?? null);
    return j;
  }, [stadur]);

  /** After a step is completed: reload and open the next step. */
  const advance = useCallback(async () => {
    const j = await load();
    const next = j?.steps.find((s) => s.state === "current")?.key ?? null;
    setOpen(next);
    if (next) setTimeout(() => document.getElementById(`step-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [load]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setAuthed(false); return; }
      if (!s.session.user.email_confirmed_at) { router.replace("/account/login?verify=1"); return; }
      setAuthed(true);
      await load();
    })();
  }, [load, router]);

  if (authed === false) return <FirstStep stadur={stadur} />;

  if (!data) {
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">{error || "Hleð heilsuferðinni…"}</div>
      </Shell>
    );
  }

  const done = data.steps.filter((s) => s.state === "done" && !s.optional).length;
  const required = data.steps.filter((s) => !s.optional).length;
  const current = data.steps.find((s) => s.state === "current");
  const healthOrder = data.orders.find((o) => o.journey_id === data.journey.id && (o.kind === "health_check" || o.kind === "reevaluation"));

  return (
    <Shell>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] via-[#0B3B30] to-[#065F46] p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
          Heilsuferðin þín{data.location ? ` · ${data.location.name}` : ""}
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {data.profile.full_name ? `Hæ ${data.profile.full_name.split(" ")[0]}` : "Velkomin(n)"}
        </h1>
        <p className="mt-1 text-emerald-100">
          {current ? <>Næsta skref: <strong className="text-white">{current.title}</strong></> : "Þú hefur lokið öllum skrefum. Vel gert."}
        </p>
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#A7F3D0] transition-all" style={{ width: `${Math.round((done / required) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-emerald-100">{done} af {required} skrefum lokið</p>
        </div>
        {data.profile.company_name && (
          <p className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs">Í boði {data.profile.company_name}</p>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Stepper */}
        <ol className="space-y-3" aria-label="Skref heilsuferðarinnar">
          {data.steps.map((s, i) => (
            <StepCard
              key={s.key}
              index={i + 1}
              step={s}
              open={open === s.key}
              onToggle={() => setOpen(open === s.key ? null : s.key)}
            >
              <StepBody step={s} data={data} reload={async () => { await load(); }} advance={advance} healthOrder={healthOrder ?? null} />
            </StepCard>
          ))}
        </ol>

        {/* Side */}
        <aside className="space-y-4">
          {healthOrder?.activation_code && (
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Virkjunarkóði</p>
              <CodeBox code={healthOrder.activation_code} />
              <p className="mt-2 text-xs text-slate-500">{healthOrder.activation_redeemed_at ? "Virkjaður í sjúklingagátt." : "Sláðu kóðann inn í sjúklingagáttina."}</p>
            </div>
          )}
          <LecturesCard lectures={data.lectures} />
          <ClaimsCard claims={data.claims} reload={async () => { await load(); }} />
          <SettingsCard />
          <p className="px-1 text-xs text-slate-400">
            Spurningar? Skrifaðu á <a className="underline" href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
          </p>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5]">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:pt-28">
        <div className="mb-4 flex items-center justify-between">
          <BackLink href="/account" label="Aðgangurinn minn" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Step 1 when logged out ─────────────────────────────────────────────────

function FirstStep({ stadur }: { stadur: string }) {
  const next = `/account/heilsuferd${stadur ? `?stadur=${encodeURIComponent(stadur)}` : ""}`;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#f0fdf4] to-[#dcfce7] px-4 py-16">
      <div className="w-full max-w-md text-center">
        <LifelineLogo size="lg" />
        <h1 className="mt-6 text-2xl font-bold text-[#0F172A]">Taktu fyrsta skrefið</h1>
        <p className="mt-2 text-slate-600">Stofnaðu frían aðgang og sjáðu valmöguleikana þína þaðan.</p>
        <div className="mt-6 space-y-3">
          <Link href={`/account/login?mode=signup&next=${encodeURIComponent(next)}`}
            className="block rounded-full bg-[#10B981] px-6 py-3 font-semibold text-white shadow-lg shadow-green-500/25 hover:bg-[#047857]">
            Stofna frían aðgang
          </Link>
          <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="block text-sm font-medium text-slate-600 hover:text-slate-900">
            Ég á nú þegar aðgang
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Step shell ─────────────────────────────────────────────────────────────

function StepCard({ index, step, open, onToggle, children }: {
  index: number; step: JourneyStep; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const tone = step.state === "done"
    ? { dot: "bg-[#10B981] text-white", ring: "border-emerald-100" }
    : step.state === "current"
      ? { dot: "bg-[#0F172A] text-white", ring: "border-slate-300 shadow-md" }
      : { dot: "bg-slate-100 text-slate-400", ring: "border-slate-100" };
  return (
    <li id={`step-${step.key}`} className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-white transition ${tone.ring}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tone.dot}`}>
          {step.state === "done" ? "✓" : index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`font-semibold ${step.state === "upcoming" ? "text-slate-400" : "text-[#0F172A]"}`}>{step.title}</span>
            {step.optional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">Valfrjálst</span>}
            {step.state === "current" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">Næst</span>}
          </span>
          <span className="block truncate text-sm text-slate-500">
            {step.state === "done" && step.doneAt ? `Lokið ${fmtDate(step.doneAt)}` : step.blurb}
          </span>
        </span>
        <span className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
      </button>
      {open && <div className="border-t border-slate-100 p-4 sm:p-5">{children}</div>}
    </li>
  );
}

function StepBody({ step, data, reload, advance, healthOrder }: { step: JourneyStep; data: JourneyData; reload: () => Promise<void>; advance: () => Promise<void>; healthOrder: HcOrder | null }) {
  const loc = data.location;
  const j = data.journey;
  const portal = loc?.patient_portal_url || "https://app.medalia.is";
  switch (step.key) {
    case "account":
      return <p className="text-sm text-slate-600">Aðgangurinn þinn er á <strong>{data.profile.email}</strong>. Hér heldur þú utan um alla heilsuferðina.</p>;
    case "profile":
      return <ProfileForm data={data} reload={reload} />;
    case "welcome":
      return <WelcomeStep data={data} />;
    case "package":
      return j.paid_at
        ? <PaidSummary order={healthOrder} />
        : <Checkout packages={data.packages.filter((p) => p.kind === "health_check")} profileComplete={data.profile.complete} reload={reload} />;
    case "protocol":
      return (
        <div className="space-y-3 text-sm text-slate-700">
          {!healthOrder ? <p>Virkjunarkóðinn birtist hér eftir greiðslu.</p> : (
            <>
              <p>Heilsufarsskoðunin sjálf fer fram í sjúklingagáttinni, þar sem heilbrigðisgögnin þín eru varðveitt. Sláðu inn virkjunarkóðann þinn þar til að opna hana:</p>
              {healthOrder.activation_code && <CodeBox code={healthOrder.activation_code} />}
              <ol className="list-decimal space-y-1 pl-5 text-slate-600">
                <li>Opnaðu sjúklingagáttina og skráðu þig inn með rafrænum skilríkjum.</li>
                <li>Sláðu inn kóðann og svaraðu spurningalistanum.</li>
                <li>Bókaðu blóðprufu og mælingar í gáttinni.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <a href={portal} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-5 font-semibold text-slate-800 hover:bg-slate-50">Opna sjúklingagátt</a>
                {step.state !== "done" && <CompleteButton label="Ég hef virkjað, ljúka skrefi" action="confirm_activated" onDone={advance} />}
              </div>
              <p className="text-xs text-slate-500">Skrefið merkist líka sjálfkrafa um leið og gáttin staðfestir kóðann.</p>
            </>
          )}
        </div>
      );
    case "blood":
      return <TestStep kind="blood" title={loc?.blood_test_site || "Heilsugæslan"} address={loc?.blood_test_address} info={loc?.blood_test_info} bookedFor={j.blood_test_booked_for} done={step.state === "done"} portal={portal} reload={reload} />;
    case "measurements":
      return <TestStep kind="measurements" title={loc?.measurement_site || "Mælingar"} address={loc?.measurement_address} info={loc?.measurement_info} bookedFor={j.measurements_booked_for} done={step.state === "done"} portal={portal} reload={reload} />;
    case "report":
      return (
        <p className="text-sm text-slate-600">
          {step.state === "done"
            ? "Skýrslan þín hefur verið staðfest af lækni. Hún er aðgengileg í sjúklingagáttinni og þú ferð yfir hana með hjúkrunarfræðingi í viðtalinu."
            : "Skýrslan verður til þegar niðurstöður blóðprufu og mælinga liggja fyrir. Læknir Lifeline staðfestir hana og þú færð tölvupóst."}
        </p>
      );
    case "interview":
      return (
        <div className="space-y-2 text-sm text-slate-600">
          <p>Í viðtalinu farið þið yfir svefn, hreyfingu, næringu og andlega líðan, mælingar og blóðprufur, og gerið saman áætlun til þriggja mánaða.</p>
          {j.interview_booked_for
            ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">
                <p>Bókað: <strong>{fmtDateTime(j.interview_booked_for)}</strong>{j.interview_mode === "video" ? " · myndsímtal" : loc?.interview_site ? ` · ${loc.interview_site}` : ""}</p>
                {j.meeting_url && (
                  <a href={j.meeting_url} target="_blank" rel="noreferrer"
                    className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-sm font-semibold text-white hover:bg-[#047857]">
                    Fara í fjarfundinn
                  </a>
                )}
              </div>
            )
            : j.report_generated_at && <a href={portal} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white">Bóka viðtal í sjúklingagátt</a>}
        </div>
      );
    case "plan":
      return data.plan
        ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700"><strong>{data.plan.headline || "Aðgerðaáætlunin þín"}</strong>{data.plan.review_date ? ` · endurmat ${fmtDate(data.plan.review_date)}` : ""}</p>
            <Link href="/account/heilsuferd/aaetlun" className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857]">Opna áætlunina</Link>
          </div>
        )
        : <p className="text-sm text-slate-600">Hjúkrunarfræðingurinn gengur frá áætluninni eftir viðtalið. Hún birtist hér og þú færð tölvupóst.</p>;
    case "followup":
      return <FollowupStep data={data} kind="followup_3m" reload={reload} />;
    case "reevaluation":
      return <FollowupStep data={data} kind="reevaluation" reload={reload} />;
    default:
      return null;
  }
}

/** Completes a step the customer can vouch for, then opens the next step. */
function CompleteButton({ label, action, onDone }: { label: string; action: string; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button type="button" disabled={busy}
        onClick={async () => {
          setBusy(true); setErr("");
          const r = await api("/api/hc/journey", { method: "POST", body: JSON.stringify({ action }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          if (!r.ok) { setErr(j.error || "Tókst ekki."); return; }
          await onDone();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#10B981] px-5 font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {busy ? "Augnablik…" : label}
      </button>
      {err && <p role="alert" className="w-full text-sm text-red-600">{err}</p>}
    </>
  );
}

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="flex-1 rounded-xl bg-emerald-50 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.15em] text-emerald-900">{code}</span>
      <button
        onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="rounded-xl border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        {copied ? "Afritað" : "Afrita"}
      </button>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────

function splitAddress(a: string | null) {
  const m = /^(.*),\s*(\d{3})\s+(.+)$/.exec(a || "");
  return m ? { street: m[1], postcode: m[2], town: m[3] } : { street: a || "", postcode: "", town: "" };
}

function ProfileForm({ data, reload }: { data: JourneyData; reload: () => Promise<void> }) {
  const addr = splitAddress(data.profile.address);
  const [f, setF] = useState({
    full_name: data.profile.full_name || "",
    phone: data.profile.phone || "",
    address: addr.street,
    postcode: addr.postcode,
    town: addr.town,
    kennitala: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors({}); setSaved(false);
    const r = await api("/api/hc/profile", { method: "POST", body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErrors(j.errors || { form: j.error || "Vistun mistókst." }); return; }
    setSaved(true);
    await reload();
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        aria-invalid={!!errors[k]}
        className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[#10B981] ${errors[k] ? "border-red-300" : "border-slate-300"}`}
        {...props}
      />
      {errors[k] && <span className="mt-1 block text-xs text-red-600">{errors[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">Við þurfum þessar upplýsingar fyrir sjúklingagáttina og til að útbúa umsókn til stéttarfélagsins þíns ef við á.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("full_name", "Fullt nafn", { autoComplete: "name" })}
        {field("kennitala", data.profile.kennitala_last4 ? `Kennitala (skráð: ••••••-${data.profile.kennitala_last4})` : "Kennitala", { inputMode: "numeric", placeholder: data.profile.kennitala_last4 ? "Sláðu inn til að breyta" : "000000-0000" })}
        {field("phone", "Farsími", { autoComplete: "tel", inputMode: "tel" })}
        {field("address", "Heimilisfang", { autoComplete: "street-address" })}
        {field("postcode", "Póstnúmer", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 3 })}
        {field("town", "Bæjarfélag", { autoComplete: "address-level2" })}
      </div>
      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
          {busy ? "Vistar…" : "Vista upplýsingar"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Vistað</span>}
      </div>
      <p className="text-xs text-slate-500">Kennitalan er dulkóðuð og aðeins notuð fyrir heilbrigðisþjónustuna og umsóknir sem þú sendir sjálf(ur).</p>
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        Ábending: Í stillingum hér til hliðar getur þú sett upp <strong>PIN</strong> fyrir fljótlegri innskráningu og tengt ferðina við <strong>Google eða Apple dagatal</strong>.
      </div>
    </form>
  );
}

// ── Welcome ────────────────────────────────────────────────────────────────

function WelcomeStep({ data }: { data: JourneyData }) {
  const welcome = data.lectures.find((l) => l.is_welcome);
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p>Stutt kynning á því sem framundan er og fjórum stoðum heilsu: svefni, hreyfingu, næringu og andlegri líðan.</p>
      {welcome
        ? <Link href={`/account/heilsuferd/fraedsla/${welcome.slug}`} className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857]">
            {welcome.completed_at ? "Horfa aftur" : "Horfa á kynninguna"}{welcome.duration_min ? ` · ${welcome.duration_min} mín.` : ""}
          </Link>
        : <p>Kynningin er væntanleg.</p>}
    </div>
  );
}

// ── Checkout ───────────────────────────────────────────────────────────────

interface CheckoutInfo {
  package: HcPackage;
  unions: { id: string; name: string; settlement: "reimbursement" | "direct"; rules_summary: string | null; rules: UnionRules; reimbursement_isk: number; explanation: string; can_email: boolean }[];
  eligibility_error: string | null;
  profile_complete: boolean;
  company_code: { ok: true; company_name: string | null; package_key: string; contribution_percent: number; contribution_isk: number | null } | { ok: false; error: string } | null;
}

/** A card that toggles a payment contribution on or off. Real button, aria-pressed. */
function ContributionToggle({ on, onToggle, title, hint, disabled, children }: {
  on: boolean; onToggle: () => void; title: string; hint: string; disabled?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border transition ${on ? "border-[#10B981] bg-emerald-50/40 ring-2 ring-[#10B981]/20" : "border-slate-200 bg-white"} ${disabled ? "opacity-50" : ""}`}>
      <button type="button" aria-pressed={on} disabled={disabled} onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-not-allowed">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-[#10B981] bg-[#10B981] text-white" : "border-slate-300 bg-white"}`}>
          {on && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <span><span className="block text-sm font-semibold text-slate-800">{title}</span><span className="block text-xs text-slate-500">{hint}</span></span>
      </button>
      {on && children && <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

function Checkout({ packages, profileComplete, reload }: { packages: HcPackage[]; profileComplete: boolean; reload: () => Promise<void> }) {
  const [pkgKey, setPkgKey] = useState(packages[0]?.key ?? "");
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [useCompany, setUseCompany] = useState(false);
  const [useUnion, setUseUnion] = useState(false);
  const [unionId, setUnionId] = useState("");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CheckoutInfo["company_code"]>(null);
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!pkgKey) return;
    (async () => {
      const r = await api(`/api/hc/checkout?package=${encodeURIComponent(pkgKey)}`);
      if (r.ok) setInfo(await r.json());
    })();
  }, [pkgKey]);

  const union = info?.unions.find((u) => u.id === unionId) ?? null;
  const company = useCompany && codeState?.ok === true ? codeState : null;
  const q = useMemo(() => quote({
    priceIsk: info?.package.price_isk ?? 0,
    employer: company ? { percent: company.contribution_percent, fixed_isk: company.contribution_isk } : null,
    union: useUnion && union ? { settlement: union.settlement, rules: union.rules } : null,
    unionCategory: info?.package.union_category ?? "health_check",
  }), [info, company, useUnion, union]);

  const checkCode = async () => {
    setCodeState(null);
    const r = await api(`/api/hc/checkout?package=${encodeURIComponent(pkgKey)}&code=${encodeURIComponent(code)}`);
    if (r.ok) setCodeState((await r.json()).company_code);
  };

  const pay = async () => {
    setBusy(true); setErr("");
    const r = await api("/api/hc/checkout", {
      method: "POST",
      body: JSON.stringify({
        package_key: pkgKey,
        use_company: useCompany, company_code: useCompany ? code : undefined,
        use_union: useUnion, union_id: useUnion ? unionId : undefined,
        union_consent: consent, accept_terms: terms,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Greiðsla tókst ekki."); return; }
    await reload();
  };

  if (!profileComplete) return <p className="text-sm text-slate-600">Kláraðu fyrst skrefið „Upplýsingar um þig“. Þær þarf til að ganga frá kaupum.</p>;
  if (!info) return <p className="text-sm text-slate-500">Hleð…</p>;

  const companyCovers = company ? (company.contribution_isk != null ? formatIsk(company.contribution_isk) : `${company.contribution_percent}%`) : "";
  const canPay = terms && !busy && !info.eligibility_error &&
    (!useCompany || codeState?.ok === true) &&
    (!useUnion || (!!union && (union.settlement !== "direct" || consent)));

  return (
    <div className="space-y-5">
      {packages.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => (
            <button key={p.key} type="button" aria-pressed={p.key === pkgKey} onClick={() => setPkgKey(p.key)} className={`rounded-2xl border p-4 text-left ${p.key === pkgKey ? "border-[#10B981] ring-2 ring-[#10B981]/30" : "border-slate-200"}`}>
              <p className="font-semibold">{p.name}</p><p className="text-sm text-slate-500">{formatIsk(p.price_isk)}</p>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold text-[#0F172A]">{info.package.name}</h3>
          <span className="text-lg font-bold text-[#047857]">{formatIsk(info.package.price_isk)}</span>
        </div>
        {info.package.tagline && <p className="text-sm font-medium text-slate-500">{info.package.tagline}</p>}
        {info.package.description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{info.package.description}</p>}
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {info.package.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-slate-700"><span className="text-[#10B981]">✓</span>{x}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Tekur einhver þátt í kostnaðinum?</p>
        <p className="text-xs text-slate-500">Veldu annað, bæði eða hvorugt. Án þátttöku greiðir þú sjálf(ur) með korti.</p>
        <ContributionToggle on={useCompany} onToggle={() => setUseCompany((v) => !v)}
          title="Vinnuveitandinn minn tekur þátt" hint="Þú slærð inn persónulegan kóða frá fyrirtækinu þínu.">
          <label className="block text-sm font-medium text-slate-700" htmlFor="company-code">Kóði frá vinnuveitanda</label>
          <div className="mt-1 flex gap-2">
            <input id="company-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeState(null); }} placeholder="FY-XXXX-XXXX" className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 font-mono uppercase tracking-wider" />
            <button type="button" onClick={checkCode} disabled={code.length < 8} className="rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white disabled:opacity-40">Staðfesta</button>
          </div>
          {codeState?.ok === true && <p className="mt-2 text-sm text-emerald-700">✓ {codeState.company_name ?? "Vinnuveitandi"} greiðir {codeState.contribution_isk != null ? formatIsk(codeState.contribution_isk) : codeState.contribution_percent >= 100 ? "allt" : `${codeState.contribution_percent}%`}.</p>}
          {codeState?.ok === false && <p className="mt-2 text-sm text-red-600">{codeState.error}</p>}
        </ContributionToggle>
        <ContributionToggle on={useUnion} onToggle={() => setUseUnion((v) => !v)} disabled={!info.unions.length}
          title="Stéttarfélagið mitt tekur þátt"
          hint={info.unions.length ? "Við reiknum endurgreiðsluna eftir reglum félagsins, af því sem þú greiðir sjálf(ur)." : "Ekkert félag er komið í samstarf enn."}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="union-select">Stéttarfélag</label>
          <select id="union-select" value={unionId} onChange={(e) => setUnionId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Veldu félag…</option>
            {info.unions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {union && (
            <div className="mt-2 text-sm text-slate-600">
              {q.explanation && <p>{q.explanation}</p>}
              {union.rules_summary && <p className="text-xs text-slate-500">{union.rules_summary}</p>}
              {union.settlement === "direct" ? (
                <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  Ég staðfesti aðild mína að {union.name} og heimila Lifeline Health að innheimta styrkinn beint hjá félaginu. Félagið fær nafn, kennitölu og lýsingu þjónustunnar, engar heilsufarsupplýsingar.
                </label>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Þú færð tilbúna umsókn (PDF) sem þú getur sent félaginu beint héðan með einum smelli.</p>
              )}
            </div>
          )}
        </ContributionToggle>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm">
        <Row label="Verð" value={formatIsk(q.priceIsk)} />
        {q.employerIsk > 0 && <Row label={`${company?.company_name ?? "Vinnuveitandi"} greiðir${company && company.contribution_isk == null && company.contribution_percent < 100 ? ` (${companyCovers})` : ""}`} value={`−${formatIsk(q.employerIsk)}`} />}
        {q.directGrantIsk > 0 && <Row label={`Styrkur ${union?.name ?? ""} (dreginn frá)`} value={`−${formatIsk(q.directGrantIsk)}`} />}
        <Row label="Þú greiðir núna" value={formatIsk(q.chargedIsk)} strong />
        {q.reimbursementIsk > 0 && (
          <>
            <Row label={`Endurgreiðsla frá ${union?.name ?? "félagi"}`} value={`−${formatIsk(q.reimbursementIsk)}`} muted />
            <Row label="Kostnaður þinn eftir endurgreiðslu" value={formatIsk(q.netCostIsk)} strong accent />
          </>
        )}
        {useUnion && union && q.chargedIsk === 0 && q.employerIsk >= q.priceIsk && (
          <p className="mt-2 text-xs text-slate-500">Vinnuveitandinn greiðir allt, svo ekkert er eftir til að sækja um hjá félaginu.</p>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
        <span>Ég samþykki <a href="/soluskilmalar" target="_blank" className="underline">söluskilmála</a> Lifeline Health.</span>
      </label>
      {info.eligibility_error && <p className="text-sm text-amber-700">{info.eligibility_error}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button type="button" onClick={pay} disabled={!canPay} className="w-full rounded-full bg-[#10B981] px-6 py-3 font-semibold text-white shadow-lg shadow-green-500/20 hover:bg-[#047857] disabled:opacity-40">
        {busy ? "Augnablik…" : q.chargedIsk > 0 ? `Greiða ${formatIsk(q.chargedIsk)}` : "Staðfesta"}
      </button>
    </div>
  );
}

function Row({ label, value, strong, muted, accent }: { label: string; value: string; strong?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "font-semibold text-slate-900" : muted ? "text-slate-500" : "text-slate-700"} ${accent ? "border-t border-slate-100 pt-2 text-[#047857]" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function PaidSummary({ order }: { order: HcOrder | null }) {
  if (!order) return <p className="text-sm text-slate-600">Greitt.</p>;
  const how = order.payment_route === "company_union" ? "Vinnuveitandi og stéttarfélag taka þátt" : order.payment_route === "company" ? "Vinnuveitandi greiðir" : order.payment_route === "union" ? "Með þátttöku stéttarfélags" : "Greitt með korti";
  return (
    <div className="text-sm text-slate-600">
      <p>{how} · {fmtDate(order.paid_at)}</p>
      {order.amount_charged_isk > 0 && <p>Greitt: {formatIsk(order.amount_charged_isk)}</p>}
      {order.union_reimbursement_isk > 0 && <p>Væntanleg endurgreiðsla frá félagi: {formatIsk(order.union_reimbursement_isk)} (sjá „Umsóknir til stéttarfélags“).</p>}
    </div>
  );
}

// ── Tests (blood / measurements) ───────────────────────────────────────────

function TestStep({ kind, title, address, info, bookedFor, done, portal, reload }: {
  kind: "blood" | "measurements"; title: string; address?: string | null; info?: string | null;
  bookedFor: string | null; done: boolean; portal: string; reload: () => Promise<void>;
}) {
  const [at, setAt] = useState(bookedFor ? bookedFor.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await api("/api/hc/journey", { method: "POST", body: JSON.stringify({ action: "set_booking", kind, at: at ? new Date(at).toISOString() : null }) });
    setSaving(false);
    await reload();
  };
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="font-semibold text-slate-800">{title}</p>
        {address && <p>{address}</p>}
        {info && <p className="mt-1 text-slate-500">{info}</p>}
      </div>
      {done ? <p className="text-emerald-700">Lokið. Niðurstöður berast lækni sjálfkrafa.</p> : (
        <>
          <a href={portal} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857]">Bóka í sjúklingagátt</a>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              Bókaður tími (fer í dagatalið þitt)
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <button onClick={save} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{saving ? "Vistar…" : "Vista tíma"}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Follow-up / re-evaluation ──────────────────────────────────────────────

function FollowupStep({ data, kind, reload }: { data: JourneyData; kind: "followup_3m" | "reevaluation"; reload: () => Promise<void> }) {
  const j = data.journey;
  const order = data.orders.find((o) => o.journey_id === j.id && (kind === "followup_3m" ? o.kind === "followup_3m" || o.kind === "extra_followup" : false));
  const pkgs = data.packages.filter((p) => (kind === "followup_3m" ? p.kind === "followup_3m" : p.kind === "reevaluation" || p.kind === "extra_followup"));
  const [buying, setBuying] = useState<string | null>(null);

  if (kind === "followup_3m" && !j.interview_done_at) return <p className="text-sm text-slate-600">Eftirfylgd opnast eftir fyrsta viðtalið. Hún er ráðlögð en valfrjáls.</p>;
  if (kind === "reevaluation" && !j.plan_published_at) return <p className="text-sm text-slate-600">Eftir ár býðst endurmat, eða aukaviðtal við hjúkrunarfræðing hvenær sem er.</p>;

  if (order) {
    return (
      <div className="space-y-2 text-sm text-slate-600">
        <p>Greitt. Virkjaðu eftirfylgdina í sjúklingagáttinni með kóðanum og bókaðu tíma:</p>
        {order.activation_code && <CodeBox code={order.activation_code} />}
        {j.followup_booked_for && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">Bókað: <strong>{fmtDateTime(j.followup_booked_for)}</strong></p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {kind === "reevaluation" && j.reevaluation_due_at && <p className="text-sm text-slate-600">Endurmat er ráðlagt frá {fmtDate(j.reevaluation_due_at)}.</p>}
      {pkgs.map((p) =>
        buying === p.key ? (
          <div key={p.key} className="rounded-2xl border border-slate-200 p-4">
            <Checkout packages={[p]} profileComplete={data.profile.complete} reload={async () => { setBuying(null); await reload(); }} />
            <button onClick={() => setBuying(null)} className="mt-2 text-sm text-slate-500">Hætta við</button>
          </div>
        ) : (
          <div key={p.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{p.name}</p>
              <p className="text-sm text-slate-500">{p.description}</p>
            </div>
            <span className="font-semibold text-[#047857]">{formatIsk(p.price_isk)}</span>
            <button onClick={() => setBuying(p.key)} className="rounded-full bg-[#10B981] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857]">Velja</button>
          </div>
        ),
      )}
    </div>
  );
}

// ── Side cards ─────────────────────────────────────────────────────────────

const PILLAR_LABEL: Record<string, string> = { sleep: "Svefn", exercise: "Hreyfing", nutrition: "Næring", mental: "Andleg líðan", general: "Almennt" };

function LecturesCard({ lectures }: { lectures: JourneyData["lectures"] }) {
  if (!lectures.length) return null;
  const done = lectures.filter((l) => l.completed_at).length;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold text-[#0F172A]">Fræðsla</p>
        <span className="text-xs text-slate-400">{done}/{lectures.length}</span>
      </div>
      <ul className="mt-3 space-y-1">
        {lectures.map((l) => (
          <li key={l.id}>
            <Link href={`/account/heilsuferd/fraedsla/${l.slug}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${l.completed_at ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {l.completed_at ? "✓" : l.kind === "video" ? "▶" : l.kind === "slides" ? "▤" : "¶"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{l.title}</span>
                <span className="block text-xs text-slate-400">{l.pillar ? PILLAR_LABEL[l.pillar] : ""}{l.duration_min ? ` · ${l.duration_min} mín.` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClaimsCard({ claims, reload }: { claims: JourneyData["claims"]; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  if (!claims.length) return null;

  const download = async (orderId: string) => {
    const r = await api(`/api/hc/claims/${orderId}`);
    if (!r.ok) return;
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "umsokn-endurgreidsla.pdf"; a.click();
    URL.revokeObjectURL(url);
  };
  const send = async (orderId: string, resend = false) => {
    if (!confirm(resend ? "Senda umsóknina aftur á stéttarfélagið? Þú færð afrit í tölvupósti." : "Senda umsóknina á stéttarfélagið? Þú færð afrit í tölvupósti.")) return;
    setBusy(orderId);
    const r = await api(`/api/hc/claims/${orderId}`, { method: "POST", body: JSON.stringify({ action: "send", resend }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg({ ...msg, [orderId]: r.ok ? `Sent á ${j.sent_to}` : j.error || "Sending mistókst." });
    if (r.ok) await reload();
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="font-semibold text-[#0F172A]">Umsóknir til stéttarfélags</p>
      <div className="mt-3 space-y-3">
        {claims.map((c) => (
          <div key={c.id} className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">{c.union_name}</p>
            <p className="text-slate-500">Endurgreiðsla: {formatIsk(c.reimbursable_isk)}</p>
            <p className="text-xs text-slate-400">{c.sent_at ? `Send ${fmtDate(c.sent_at)} á ${c.sent_to}` : "Ekki send"}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => download(c.order_id)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold">Sækja PDF</button>
              <button type="button" onClick={() => send(c.order_id, !!c.sent_at)} disabled={busy === c.order_id}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${c.sent_at ? "border border-slate-300 bg-white text-slate-700" : "bg-[#10B981] text-white"}`}>
                {busy === c.order_id ? "Sendir…" : c.sent_at ? "Senda aftur" : "Senda á félagið"}
              </button>
            </div>
            {msg[c.order_id] && <p className="mt-1 text-xs text-slate-600">{msg[c.order_id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Customer calendar: Google push sync (instant) or .ics subscription.
const CUSTOMER_CALENDAR: CalendarApi = {
  call: api,
  googleStatusUrl: "/api/hc/google",
  startGoogle: async () => {
    const r = await api("/api/hc/google/start", { method: "POST", body: "{}" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) window.location.href = j.url;
    else alert(j.error || "Tókst ekki að tengja við Google.");
  },
  icsTokenUrl: "/api/hc/calendar-token",
  subscriptionName: "Lifeline heilsuferð",
};

function SettingsCard() {
  const [pinStep, setPinStep] = useState<"idle" | "first" | "confirm" | "done">("idle");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinEnabled, setPinEnabled] = useState<boolean | null>(null);
  // Opens by itself when coming back from Google (?google=…) or a ?cal=1 link.
  const [calOpen, setCalOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.has("google") || q.get("cal") === "1";
  });
  const [calKey, setCalKey] = useState(0);

  useEffect(() => {
    fetch("/api/account/pin").then((r) => r.json()).then((j) => setPinEnabled(!!j.enabled)).catch(() => setPinEnabled(false));
  }, []);

  const onPin = async (v: string) => {
    if (pinStep === "first") { setFirst(v); setPin(""); setPinStep("confirm"); return; }
    if (v !== first) { setPinErr("PIN-númerin stemma ekki. Reyndu aftur."); setPin(""); setFirst(""); setPinStep("first"); return; }
    const r = await api("/api/account/pin", { method: "POST", body: JSON.stringify({ pin: v }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setPinErr(j.error || "Tókst ekki."); setPin(""); setFirst(""); setPinStep("first"); return; }
    setPinStep("done"); setPinEnabled(true); setPin("");
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="font-semibold text-[#0F172A]">Stillingar</p>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-800">Innskráning með PIN</p>
        <p className="text-xs text-slate-500">Fjögurra stafa PIN á þessu tæki í stað lykilorðs.</p>
        {pinStep === "idle" && (
          <button onClick={() => { setPinStep("first"); setPinErr(""); }} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">
            {pinEnabled ? "Breyta PIN" : "Setja upp PIN"}
          </button>
        )}
        {(pinStep === "first" || pinStep === "confirm") && (
          <div className="mt-3">
            <p className="mb-3 text-center text-sm text-slate-700">{pinStep === "first" ? "Veldu PIN" : "Sláðu PIN inn aftur"}</p>
            <PinPad value={pin} onChange={setPin} onComplete={onPin} error={!!pinErr} />
            {pinErr && <p className="mt-2 text-center text-xs text-red-600">{pinErr}</p>}
            <button onClick={() => { setPinStep("idle"); setPin(""); }} className="mt-3 block w-full text-center text-xs text-slate-500">Hætta við</button>
          </div>
        )}
        {pinStep === "done" && <p className="mt-2 text-xs text-emerald-700">PIN er virkt á þessu tæki.</p>}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-800">Dagatal</p>
        <p className="text-xs text-slate-500">Blóðprufa, mælingar og viðtöl.</p>
        <div className="mt-1"><CalendarStatus key={calKey} api={CUSTOMER_CALENDAR} onOpen={() => setCalOpen(true)} /></div>
        <CalendarConnect
          api={CUSTOMER_CALENDAR}
          open={calOpen}
          onClose={() => { setCalOpen(false); setCalKey((k) => k + 1); }}
          intro="Blóðprufa, mælingar og viðtöl birtast í dagatalinu þínu með áminningu og uppfærast sjálfkrafa ef tími breytist."
        />
      </div>
    </div>
  );
}

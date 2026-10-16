"use client";

// Heilsuferð admin — overview of the self-maintained health-check journey:
// funnel by stage, recent journeys, packages & prices, locations (partner
// sites) and workstation users (nurses / doctors, incl. partners like Vera).
// Nobody here moves a person forward — the journey runs itself; this is
// for configuration and oversight.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStaffGuard } from "@/lib/useStaffGuard";
import AdminTabs from "../components/AdminTabs";
import DiscountsTab from "./DiscountsTab";
import CodesTab from "./CodesTab";
import PartnersTab from "./PartnersTab";
import { adminJson } from "../hc-api";
import { useNow } from "@/app/components/account/ui/useNow";
import { STAGE_LABELS } from "@/lib/hc/stages";
import { formatIsk, type HcLocation, type HcPackage } from "@/lib/hc/types";

interface Overview {
  funnel: Record<string, number>;
  revenue: { self: number; union: number; company: number; count: number };
  journeys: { id: string; client_name: string | null; stage: string; entry: string; created_at: string; updated_at: string; report_sms_sent_at: string | null; referral_to_heilsugaesla: boolean }[];
  packages: (HcPackage & { active: boolean })[];
  locations: (HcLocation & { active: boolean })[];
}
interface Worker {
  id: string; email: string; name: string; phone: string | null; organization: string;
  role: string; location_ids: string[]; receives_report_sms: boolean; active: boolean;
  activated: boolean; last_login_at: string | null;
  /** When the current invite / reset link stops working (null when none). */
  invite_expires_at?: string | null;
  /* What a participant sees of this person on the Þjálfari tab. */
  bio: string | null;
  photo_url: string | null;
  credentials: string | null;
  specialties: string[] | null;
  accepting_clients: boolean;
}

const TABS = [
  { key: "overview", label: "Yfirlit" },
  { key: "packages", label: "Pakkar" },
  { key: "locations", label: "Staðir" },
  { key: "workers", label: "Vinnustöð" },
  { key: "discounts", label: "Afslættir" },
  { key: "codes", label: "Virkjunarkóðar" },
  { key: "partners", label: "Samstarfsaðilar" },
];
const FUNNEL = ["account", "profile", "welcome", "package", "protocol", "tests", "report", "interview", "plan", "action", "completed"];

export default function HeilsuferdAdmin() {
  const { authorized, loading } = useStaffGuard();
  /* ?tab=workers opens the Vinnustöð tab, so the pointer from /admin/team
     lands on the editor rather than the overview. Read once on mount; the
     tab is local state after that. */
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "overview";
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((x) => x.key === t) ? t! : "overview";
  });
  const [data, setData] = useState<Overview | null>(null);
  const load = useCallback(async () => {
    const r = await adminJson<Overview>("/api/admin/hc/overview");
    if (r.ok) setData(r.data);
  }, []);
  useEffect(() => {
    if (!authorized) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [authorized, load]);

  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Heilsuferð</h1>
          <p className="text-sm text-slate-500">Sjálfvirkt ferli heilsufarsskoðunar fyrir einstaklinga og fyrirtæki.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/unions" className="rounded-lg border border-slate-200 px-3 py-1.5">Stéttarfélög</Link>
          <Link href="/admin/lectures" className="rounded-lg border border-slate-200 px-3 py-1.5">Fræðsla</Link>
          <Link href="/admin/coach/plans" className="rounded-lg border border-slate-200 px-3 py-1.5">Aðgerðaáætlanir</Link>
          <Link href="/admin/vinnustod" className="rounded-lg border border-slate-200 px-3 py-1.5">Vinnustöð</Link>
        </div>
      </div>
      <AdminTabs tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-6">
        {!data ? <p className="text-slate-500">Hleð…</p> : (
          <>
            {tab === "overview" && <OverviewTab data={data} />}
            {tab === "packages" && <PackagesTab packages={data.packages} onSaved={load} />}
            {tab === "locations" && <LocationsTab locations={data.locations} onSaved={load} />}
            {tab === "workers" && <WorkersTab locations={data.locations} />}
            {tab === "discounts" && <DiscountsTab />}
            {tab === "codes" && <CodesTab />}
            {tab === "partners" && <PartnersTab />}
          </>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: Overview }) {
  const max = Math.max(1, ...FUNNEL.map((s) => data.funnel[s] || 0));
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Greiddar pantanir" value={String(data.revenue.count)} />
        <Stat label="Greitt af einstaklingum" value={formatIsk(data.revenue.self)} />
        <Stat label="Greitt með stéttarfélagi" value={formatIsk(data.revenue.union)} />
        <Stat label="Reikningsfært fyrirtækjum" value={formatIsk(data.revenue.company)} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-bold">Hvar er fólk statt?</h2>
        <div className="space-y-1.5">
          {FUNNEL.map((s) => (
            <div key={s} className="flex items-center gap-3 text-sm">
              <span className="w-44 shrink-0 text-slate-600">{STAGE_LABELS[s] ?? s}</span>
              <div className="h-5 flex-1 rounded bg-slate-50">
                <div className="h-5 rounded bg-emerald-400/80" style={{ width: `${((data.funnel[s] || 0) / max) * 100}%` }} />
              </div>
              <span className="w-10 text-right tabular-nums font-semibold">{data.funnel[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Nafn</th><th className="px-4 py-2">Staða</th><th className="px-4 py-2">Leið</th><th className="px-4 py-2">Uppfært</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {data.journeys.map((j) => (
              <tr key={j.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{j.client_name || "—"}</td>
                <td className="px-4 py-2">{STAGE_LABELS[j.stage] ?? j.stage}{j.report_sms_sent_at && j.stage === "report" ? " · SMS sent" : ""}</td>
                <td className="px-4 py-2 text-slate-500">{j.entry === "b2b" ? "Fyrirtæki" : j.entry === "heilsugaesla" ? "Tilvísun" : "Einstaklingur"}{j.referral_to_heilsugaesla ? " · vísað á HG" : ""}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(j.updated_at).toLocaleDateString("is-IS")}</td>
                <td className="px-4 py-2 text-right">{["plan", "action", "interview"].includes(j.stage) && <Link href={`/admin/coach/plans/${j.id}`} className="text-emerald-700 hover:underline">Áætlun</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>;
}

function PackagesTab({ packages, onSaved }: { packages: Overview["packages"]; onSaved: () => void }) {
  return <div className="grid gap-4 lg:grid-cols-2">{packages.map((p) => <PackageCard key={p.key} p={p} onSaved={onSaved} />)}</div>;
}

function PackageCard({ p, onSaved }: { p: Overview["packages"][number]; onSaved: () => void }) {
  const [f, setF] = useState({ name: p.name, tagline: p.tagline ?? "", description: p.description ?? "", includes: p.includes.join("\n"), price_isk: String(p.price_isk), active: p.active });
  const [msg, setMsg] = useState("");
  const save = async () => {
    const r = await adminJson("/api/admin/hc/overview", { method: "PUT", body: JSON.stringify({ type: "package", key: p.key, ...f, includes: f.includes.split("\n").map((x) => x.trim()).filter(Boolean) }) });
    setMsg(r.ok ? "Vistað" : r.error || "Villa");
    if (r.ok) onSaved();
  };
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
      <p className="text-xs font-mono text-slate-400">{p.key} · {p.kind}</p>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold" />
      <input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="Slagorð" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      <textarea value={f.includes} onChange={(e) => setF({ ...f, includes: e.target.value })} rows={5} placeholder="Innifalið, ein lína á lið" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">Verð <input type="number" value={f.price_isk} onChange={(e) => setF({ ...f, price_isk: e.target.value })} className="w-32 rounded-lg border border-slate-300 px-2 py-1.5" /> kr.</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Virkur</label>
        <span className="flex-1" />
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
        <button onClick={save} className="rounded-lg bg-[#10B981] px-4 py-1.5 font-semibold text-white">Vista</button>
      </div>
    </div>
  );
}

const LOC_FIELDS: [keyof HcLocation, string][] = [
  ["name", "Heiti"], ["region", "Svæði"],
  ["blood_test_site", "Blóðprufa: staður"], ["blood_test_address", "Blóðprufa: heimilisfang"], ["blood_test_info", "Blóðprufa: leiðbeiningar"],
  ["measurement_site", "Mælingar: staður"], ["measurement_address", "Mælingar: heimilisfang"], ["measurement_info", "Mælingar: leiðbeiningar"],
  ["interview_site", "Viðtal: staður"], ["interview_address", "Viðtal: heimilisfang"], ["patient_portal_url", "Slóð á sjúklingagátt"],
];

function LocationsTab({ locations, onSaved }: { locations: Overview["locations"]; onSaved: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const add = async () => {
    const r = await adminJson("/api/admin/hc/overview", { method: "PUT", body: JSON.stringify({ type: "new_location", slug, name }) });
    if (r.ok) { setSlug(""); setName(""); onSaved(); }
  };
  return (
    <div className="space-y-4">
      {locations.map((l) => <LocationCard key={l.id} l={l} onSaved={onSaved} />)}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nýr staður, t.d. Akureyri" className="rounded-lg border border-slate-300 px-3 py-2" />
        <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="slóð, t.d. akureyri" className="rounded-lg border border-slate-300 px-3 py-2 font-mono" />
        <button onClick={add} disabled={!slug || !name} className="rounded-lg bg-[#10B981] px-4 py-2 font-semibold text-white disabled:opacity-40">Bæta við stað</button>
      </div>
    </div>
  );
}

function LocationCard({ l, onSaved }: { l: Overview["locations"][number]; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>(Object.fromEntries(LOC_FIELDS.map(([k]) => [k, (l[k] as string | null) ?? ""])));
  const [msg, setMsg] = useState("");
  const save = async () => {
    const r = await adminJson("/api/admin/hc/overview", { method: "PUT", body: JSON.stringify({ type: "location", id: l.id, ...f }) });
    setMsg(r.ok ? "Vistað" : r.error || "Villa");
    if (r.ok) onSaved();
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="font-bold">{l.name}</h3>
        <a href={`/heilsuskodun/${l.slug}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">/heilsuskodun/{l.slug}</a>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {LOC_FIELDS.map(([k, label]) => (
          <label key={k} className="text-xs text-slate-600">{label}
            <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">{msg && <span className="text-xs text-slate-500">{msg}</span>}<button onClick={save} className="rounded-lg bg-[#10B981] px-4 py-1.5 text-sm font-semibold text-white">Vista</button></div>
    </div>
  );
}

const ORG: Record<string, string> = { lifeline: "Lifeline", vera: "Vera", heilsugaesla: "Heilsugæsla" };
const ROLE: Record<string, string> = { nurse: "Hjúkrunarfræðingur", doctor: "Læknir", admin: "Stjórnandi" };
const MONTHS_IS = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const dayIs = (iso: string) => { const d = new Date(iso); return `${d.getDate()}. ${MONTHS_IS[d.getMonth()]}`; };

type InviteResult = { name: string; email: string; url: string; sent: boolean; expires_at: string | null };

/** What happened to the invite: sent, or not — and the link either way. */
function InviteNotice({ r, onClose }: { r: InviteResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(r.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <div role="status" className={`rounded-2xl border p-4 text-sm ${r.sent ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p className="font-semibold">{r.sent ? `Boð sent til ${r.email}` : "Póstur fór ekki – afritaðu hlekkinn"}</p>
      <p className="mt-1">
        {r.sent
          ? `${r.name} fær tölvupóst með hlekk til að velja lykilorð.`
          : `Ekki tókst að senda póst til ${r.email}. Sendu ${r.name} hlekkinn eftir annarri öruggri leið.`}
        {r.expires_at ? ` Hlekkurinn gildir til ${dayIs(r.expires_at)}.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 max-w-full flex-1 truncate rounded-lg bg-white/70 px-2 py-1.5 text-xs">{r.url}</code>
        <button type="button" onClick={() => void copy()} className="rounded-lg border border-current/30 bg-white px-3 py-1.5 text-xs font-semibold">
          {copied ? "Afritað" : "Afrita hlekk"}
        </button>
        <button type="button" onClick={onClose} className="px-2 py-1.5 text-xs font-semibold opacity-80 hover:opacity-100">Loka</button>
      </div>
    </div>
  );
}

function WorkersTab({ locations }: { locations: Overview["locations"] }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [edit, setEdit] = useState<Partial<Worker> | null>(null);
  const [msg, setMsg] = useState("");
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const now = useNow();
  const load = useCallback(async () => {
    const r = await adminJson<{ workers: Worker[] }>("/api/admin/hc/workers");
    if (r.ok) setWorkers(r.data.workers);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const save = async (invite: boolean) => {
    if (!edit) return;
    setInvite(null);
    const r = await adminJson<{ worker: { name: string; email: string }; invite_url: string | null; sent: boolean; expires_at: string | null }>(
      "/api/admin/hc/workers", { method: "POST", body: JSON.stringify({ ...edit, send_invite: invite }) });
    if (!r.ok) { setMsg(r.error || "Villa"); return; }
    if (invite && r.data.invite_url) {
      setMsg("");
      setInvite({ name: r.data.worker.name, email: r.data.worker.email, url: r.data.invite_url, sent: !!r.data.sent, expires_at: r.data.expires_at });
    } else setMsg("Vistað.");
    setEdit(null); await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">Notendur vinnustöðvarinnar (/vinnustod). Þeir fá engan aðgang að stjórnborðinu.</p>
        <button onClick={() => setEdit({ organization: "vera", role: "nurse", location_ids: [], active: true, receives_report_sms: false })} className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-white">Nýr notandi</button>
      </div>
      {msg && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{msg}</p>}
      {invite && <InviteNotice r={invite} onClose={() => setInvite(null)} />}
      {edit && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-3">
          <input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Nafn" className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="Netfang" className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="Farsími (fyrir SMS)" className="rounded-lg border border-slate-300 px-3 py-2" />
          <select value={edit.organization} onChange={(e) => setEdit({ ...edit, organization: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2">
            {Object.entries(ORG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2">
            {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {locations.map((l) => (
              <label key={l.id} className="flex items-center gap-1">
                <input type="checkbox" checked={(edit.location_ids ?? []).includes(l.id)}
                  onChange={(e) => setEdit({ ...edit, location_ids: e.target.checked ? [...(edit.location_ids ?? []), l.id] : (edit.location_ids ?? []).filter((x) => x !== l.id) })} />
                {l.name}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={!!edit.receives_report_sms} onChange={(e) => setEdit({ ...edit, receives_report_sms: e.target.checked })} /> Fær SMS ef skýrsla bíður í 5 mín. (læknar)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Virkur</label>

          {/* The profile a participant reads before deciding to talk to this
              person, or to switch to them. Separate from the account fields
              above: those decide what the worker can do, these decide what a
              stranger knows about them. */}
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500 sm:col-span-3">Það sem þátttakendur sjá</p>
          <input value={edit.credentials ?? ""} onChange={(e) => setEdit({ ...edit, credentials: e.target.value })}
            placeholder="Titill og nám, t.d. „MSc í íþróttafræði“" className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2" />
          <input value={edit.photo_url ?? ""} onChange={(e) => setEdit({ ...edit, photo_url: e.target.value })}
            placeholder="Hlekkur á mynd (https://…)" className="rounded-lg border border-slate-300 px-3 py-2" />
          <textarea value={edit.bio ?? ""} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} rows={3} maxLength={1200}
            placeholder="Stutt kynning í fyrstu persónu — hver þú ert og hvernig þú vinnur."
            className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-3" />
          <input value={(edit.specialties ?? []).join(", ")}
            onChange={(e) => setEdit({ ...edit, specialties: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
            placeholder="Sérsvið, aðskilin með kommu — t.d. „Svefn, Styrktarþjálfun, Næring“"
            className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-3" />
          <label className="flex items-center gap-2 sm:col-span-3">
            <input type="checkbox" checked={edit.accepting_clients !== false}
              onChange={(e) => setEdit({ ...edit, accepting_clients: e.target.checked })} />
            Tekur við nýjum þátttakendum
            <span className="text-xs text-slate-500">— ef ekki, heldur hann sínum en birtist ekki í listanum þegar fólk skiptir um þjálfara.</span>
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button onClick={() => save(false)} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Vista</button>
            <button onClick={() => save(true)} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">{edit.activated ? "Vista og senda nýjan hlekk" : "Vista og senda boð"}</button>
            <button onClick={() => setEdit(null)} className="px-3 text-slate-500">Hætta við</button>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-3">Staðir: notandi sér aðeins skjólstæðinga á völdum stöðum. Samstarfsaðili án staðar sér engan.</p>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Nafn</th><th className="px-4 py-2">Hlutverk</th><th className="px-4 py-2">Staðir</th><th className="px-4 py-2">Staða</th><th /></tr></thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-t border-slate-100">
                <td className="px-4 py-2"><p className="font-medium">{w.name}</p><p className="text-xs text-slate-500">{w.email}</p></td>
                <td className="px-4 py-2">{ROLE[w.role]} · {ORG[w.organization]}{w.receives_report_sms ? " · SMS" : ""}</td>
                <td className="px-4 py-2 text-slate-500">{w.location_ids.map((id) => locations.find((l) => l.id === id)?.name).filter(Boolean).join(", ") || (w.organization === "lifeline" ? "Allir" : "Enginn")}</td>
                <td className="px-4 py-2">
                  {!w.active ? "Óvirkur" : w.activated ? "Virkur" : "Boð ósamþykkt"}
                  {w.active && !w.activated && w.invite_expires_at && (
                    <p className={`text-xs ${new Date(w.invite_expires_at).getTime() < now ? "text-red-700" : "text-slate-500"}`}>
                      {new Date(w.invite_expires_at).getTime() < now ? `Hlekkur rann út ${dayIs(w.invite_expires_at)}` : `Hlekkur gildir til ${dayIs(w.invite_expires_at)}`}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2 text-right"><button onClick={() => setEdit(w)} className="text-emerald-700 hover:underline">Breyta</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

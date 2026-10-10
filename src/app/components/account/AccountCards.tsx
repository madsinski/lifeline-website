"use client";

// The account itself, in the heilsuferð's "Aðgangur": personal details,
// password, sign-out and deleting the account. (Payments, documents, privacy
// and calendar/PIN come from their own components.)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";

async function api(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
    // A multipart boundary is part of the Content-Type; naming the type
    // without one leaves the body unparseable on the server.
    ? { "Content-Type": "application/json" } : {}) } });
}

const card = "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6";
const input = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
const btn = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition disabled:opacity-50";

interface Profile { email: string | null; full_name: string | null; phone: string | null; address: string | null; kennitala_last4: string | null; complete: boolean }

function splitAddress(a: string | null) {
  const m = /^(.*),\s*(\d{3})\s+(.+)$/.exec(a ?? "");
  return m ? { street: m[1], postcode: m[2], town: m[3] } : { street: a ?? "", postcode: "", town: "" };
}

export function ProfileCard() {
  const [p, setP] = useState<Profile | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ full_name: "", phone: "", address: "", postcode: "", town: "", kennitala: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [loadKey, setLoadKey] = useState(0);
  const load = async () => { setLoadKey((k) => k + 1); };
  useEffect(() => {
    (async () => {
    const r = await api("/api/hc/profile");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setP(j.profile);
    setNeedsConsent(!!j.has_journey && !j.health_consent);
    const a = splitAddress(j.profile.address);
    setF({ full_name: j.profile.full_name ?? "", phone: j.profile.phone ?? "", address: a.street, postcode: a.postcode, town: a.town, kennitala: "" });
    })();
  }, [loadKey]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors({});
    const r = await api("/api/hc/profile", { method: "POST", body: JSON.stringify({ ...f, accept_health_consent: consent }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErrors(j.errors || { form: j.error || "Tókst ekki að vista." }); return; }
    setEdit(false);
    await load();
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} {...props} />
      {errors[k] && <span className="mt-1 block text-xs text-red-600">{errors[k]}</span>}
    </label>
  );

  return (
    <section className={card} aria-labelledby="acc-profile">
      <div className="flex items-center gap-2">
        <h2 id="acc-profile" className="flex-1 text-lg font-bold text-slate-900">Persónuupplýsingar</h2>
        {p && !edit && <button type="button" onClick={() => setEdit(true)} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}><Pencil className="h-4 w-4" aria-hidden />Breyta</button>}
      </div>
      {!p && (
        <div className="mt-3 grid animate-pulse gap-x-6 gap-y-3 sm:grid-cols-2" aria-busy="true" aria-label="Hleð persónuupplýsingum">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 rounded bg-slate-200/80" />
              <div className="mt-1.5 h-4 w-40 rounded bg-slate-200/60" />
            </div>
          ))}
        </div>
      )}
      {p && !edit && (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[["Nafn", p.full_name], ["Netfang", p.email], ["Sími", p.phone], ["Heimilisfang", p.address], ["Kennitala", p.kennitala_last4 ? `••••••-${p.kennitala_last4}` : null]].map(([k, v]) => (
            <div key={k as string}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt><dd className="text-slate-900">{v || <span className="text-slate-400">Vantar</span>}</dd></div>
          ))}
        </dl>
      )}
      {p && edit && (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("full_name", "Fullt nafn", { autoComplete: "name" })}</div>
          {field("phone", "Sími", { autoComplete: "tel", inputMode: "tel" })}
          {field("kennitala", p.kennitala_last4 ? "Ný kennitala (valfrjálst)" : "Kennitala", { inputMode: "numeric", placeholder: p.kennitala_last4 ? `Skráð: ••••••-${p.kennitala_last4}` : "000000-0000" })}
          <div className="sm:col-span-2">{field("address", "Heimilisfang", { autoComplete: "street-address" })}</div>
          {field("postcode", "Póstnúmer", { inputMode: "numeric", maxLength: 3 })}
          {field("town", "Bæjarfélag")}
          {needsConsent && (
            <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" />
              <span>Ég samþykki að Lifeline vinni með heilsufarsupplýsingar mínar vegna heilsufarsskoðunarinnar. <a href="/privacy" className="underline">Persónuverndarstefna</a></span>
            </label>
          )}
          {(errors.form || errors.consent) && <p className="text-sm text-red-600 sm:col-span-2">{errors.form || errors.consent}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>{busy ? "Vista…" : "Vista"}</button>
            <button type="button" onClick={() => setEdit(false)} className={`${btn} text-slate-600 hover:bg-slate-100`}>Hætta við</button>
          </div>
        </form>
      )}
    </section>
  );
}

export function PasswordCard() {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    if (a !== b) { setMsg({ ok: false, text: "Lykilorðin stemma ekki." }); return; }
    const { error } = await supabase.auth.updateUser({ password: a });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "Lykilorðinu var breytt." }); setA(""); setB(""); setOpen(false);
  };
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Lykilorð</p>
          <p className="text-xs text-slate-500">Til að skrá þig inn með netfangi.</p>
        </div>
        {!open && <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}>Breyta</button>}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <input type="password" value={a} onChange={(e) => setA(e.target.value)} placeholder="Nýtt lykilorð (minnst 8 stafir)" autoComplete="new-password" className={input} />
          <input type="password" value={b} onChange={(e) => setB(e.target.value)} placeholder="Nýja lykilorðið aftur" autoComplete="new-password" className={input} />
          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={a.length < 8} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>Vista lykilorð</button>
            <button type="button" onClick={() => setOpen(false)} className={`${btn} text-slate-600 hover:bg-slate-100`}>Hætta við</button>
          </div>
        </div>
      )}
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={async () => { await supabase.auth.signOut(); router.push("/account/login"); }}
      className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ${className}`}>
      <LogOut className="h-4 w-4" aria-hidden /> Skrá út
    </button>
  );
}

export function DeleteAccountCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const del = async () => {
    if (text !== "EYÐA") return;
    setBusy(true); setErr("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr("Þú ert ekki innskráð(ur)."); setBusy(false); return; }
    const r = await fetch("https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || j.message || "Tókst ekki að eyða aðganginum."); setBusy(false); return; }
    await supabase.auth.signOut();
    router.push("/");
  };
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-700">Eyða aðgangi</p>
          <p className="text-xs text-slate-500">Eyðir aðganginum og gögnunum hjá Lifeline. Sjúkraskráin í sjúklingagáttinni fylgir eigin reglum.</p>
        </div>
        {!open && <button type="button" onClick={() => setOpen(true)} className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}>Eyða</button>}
      </div>
      {open && (
        <div className="mt-3 rounded-2xl bg-red-50 p-4">
          <p className="text-sm text-red-900">Þetta er ekki hægt að afturkalla. Skrifaðu <strong>EYÐA</strong> til að staðfesta.</p>
          <input value={text} onChange={(e) => setText(e.target.value)} className={`${input} mt-2 bg-white`} aria-label="Staðfesting" />
          {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void del()} disabled={text !== "EYÐA" || busy} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>{busy ? "Eyði…" : "Já, eyða aðganginum mínum"}</button>
            <button type="button" onClick={() => { setOpen(false); setText(""); }} className={`${btn} text-slate-600 hover:bg-white`}>Hætta við</button>
          </div>
        </div>
      )}
    </div>
  );
}

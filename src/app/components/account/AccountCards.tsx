"use client";

// The account itself, in the heilsuferð's "Aðgangur": personal details,
// password, sign-out and deleting the account. (Payments, documents, privacy
// and calendar/PIN come from their own components.)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, Field, SavedNote, accountCard, accountInput, accountLabel, friendlyError, useFlash } from "./ui";

async function api(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
    // A multipart boundary is part of the Content-Type; naming the type
    // without one leaves the body unparseable on the server.
    ? { "Content-Type": "application/json" } : {}) } });
}

// On the account primitives (./ui, hc tokens), so these cards look the same
// on /account and on /app/adgangur.
const card = `${accountCard} p-5 sm:p-6`;
const input = `${accountInput} mt-1`;

interface Profile { email: string | null; full_name: string | null; phone: string | null; address: string | null; kennitala_last4: string | null; complete: boolean }

function splitAddress(a: string | null) {
  const m = /^(.*),\s*(\d{3})\s+(.+)$/.exec(a ?? "");
  return m ? { street: m[1], postcode: m[2], town: m[3] } : { street: a ?? "", postcode: "", town: "" };
}

export function ProfileCard() {
  const { t } = useI18n();
  const [p, setP] = useState<Profile | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ full_name: "", phone: "", address: "", postcode: "", town: "", kennitala: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /* "Vistað ✓" beside Breyta once the form has collapsed back to it. */
  const [savedMsg, flashSaved, clearSaved] = useFlash(4000);

  const [loadKey, setLoadKey] = useState(0);
  const load = async () => { setLoadKey((k) => k + 1); };
  useEffect(() => {
    (async () => {
    const r = await api("/api/hc/profile").catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.profile) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    setP(j.profile);
    setNeedsConsent(!!j.has_journey && !j.health_consent);
    const a = splitAddress(j.profile.address);
    setF({ full_name: j.profile.full_name ?? "", phone: j.profile.phone ?? "", address: a.street, postcode: a.postcode, town: a.town, kennitala: "" });
    })();
  }, [loadKey]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors({}); clearSaved();
    try {
      const r = await api("/api/hc/profile", { method: "POST", body: JSON.stringify({ ...f, accept_health_consent: consent }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const fieldErrors = j.errors && typeof j.errors === "object" ? j.errors as Record<string, string> : null;
        setErrors(fieldErrors && Object.keys(fieldErrors).length
          // A field error for a field this form does not show still has to be seen.
          ? { ...fieldErrors, form: fieldErrors.form || fieldErrors.consent || t("comp.ac.checkfields", "Lagfærðu það sem er merkt hér fyrir ofan og reyndu aftur.") }
          : { form: friendlyError(j.error || (r.status === 401 ? "unauthorized" : ""), t("comp.ac.savefailed", "Tókst ekki að vista.")) });
        return;
      }
      // Show what was saved right away; the reload below confirms it.
      if (j.profile) setP(j.profile);
      setEdit(false);
      flashSaved(t("acc.common.saved", "Vistað"));
      await load();
    } catch (err) {
      setErrors({ form: friendlyError(err, t("comp.ac.savefailed", "Tókst ekki að vista.")) });
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      <span className={accountLabel}>{label}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} {...props} />
      {errors[k] && <span className="mt-1 block text-xs text-hc-bad-ink">{errors[k]}</span>}
    </label>
  );

  return (
    <section className={card} aria-labelledby="acc-profile">
      <div className="flex items-center gap-2">
        <h2 id="acc-profile" className="flex-1 text-lg font-bold text-hc-ink">{t("comp.ac.personal", "Persónuupplýsingar")}</h2>
        {p && !edit && <SavedNote msg={savedMsg} />}
        {p && !edit && <Button size="sm" variant="secondary" onClick={() => { clearSaved(); setEdit(true); }} icon={<Pencil className="h-3.5 w-3.5" aria-hidden />}>{t("acct.q.edit", "Breyta")}</Button>}
      </div>
      {!p && loadError && <Alert tone="bad" compact className="mt-3">{t("comp.ac.loadfailed", "Tókst ekki að sækja persónuupplýsingarnar. Endurhlaððu síðuna til að reyna aftur.")}</Alert>}
      {!p && !loadError && (
        <div className="mt-3 grid animate-pulse gap-x-6 gap-y-3 sm:grid-cols-2" aria-busy="true" aria-label={t("comp.ac.loading", "Hleð persónuupplýsingum")}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 rounded bg-hc-sunken-2" />
              <div className="mt-1.5 h-4 w-40 rounded bg-hc-sunken-2" />
            </div>
          ))}
        </div>
      )}
      {p && !edit && (
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[[t("acct.q.name", "Nafn"), p.full_name], [t("acct.q.email", "Netfang"), p.email], [t("comp.ac.phone", "Sími"), p.phone], [t("acct.q.address", "Heimilisfang"), p.address], [t("acct.q.kennitala", "Kennitala"), p.kennitala_last4 ? `••••••-${p.kennitala_last4}` : null]].map(([k, v]) => (
            <Field key={k as string} label={k}>{v || <span className="text-hc-ink-3">{t("acct.q.missing", "Vantar")}</span>}</Field>
          ))}
        </dl>
      )}
      {p && edit && (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("full_name", "Fullt nafn", { autoComplete: "name" })}</div>
          {field("phone", t("comp.ac.phone", "Sími"), { autoComplete: "tel", inputMode: "tel" })}
          {field("kennitala", p.kennitala_last4 ? t("comp.ac.newkt", "Ný kennitala (valfrjálst)") : t("comp.ac.kennitala", "Kennitala"), { inputMode: "numeric", placeholder: p.kennitala_last4 ? `Skráð: ••••••-${p.kennitala_last4}` : "000000-0000" })}
          <div className="sm:col-span-2">{field("address", t("acct.q.address", "Heimilisfang"), { autoComplete: "street-address" })}</div>
          {field("postcode", t("comp.ac.postcode", "Póstnúmer"), { inputMode: "numeric", maxLength: 3 })}
          {field("town", t("comp.ac.town", "Bæjarfélag"))}
          {needsConsent && (
            <label className="flex items-start gap-2 text-sm text-hc-ink-2 sm:col-span-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" />
              <span>{t("comp.ac.consent", "Ég samþykki að Lifeline vinni með heilsufarsupplýsingar mínar vegna heilsufarsskoðunarinnar.")} <a href="/privacy" className="underline">{t("comp.ac.privacypolicy", "Persónuverndarstefna")}</a></span>
            </label>
          )}
          {(errors.form || errors.consent) && <Alert tone="bad" compact className="sm:col-span-2">{errors.form || errors.consent}</Alert>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" busy={busy}>{busy ? t("acc.common.saving", "Vista…") : t("comp.ac.save", "Vista")}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setEdit(false); setErrors({}); }}>{t("comp.ac.cancel", "Hætta við")}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function PasswordCard() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [savedMsg, flashSaved, clearSaved] = useFlash(5000);
  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr("");
    if (a.length < 12) { setErr(t("comp.ac.pwshort", "Lykilorðið þarf að vera að minnsta kosti 12 stafir.")); return; }
    if (a !== b) { setErr(t("comp.ac.nomatch", "Lykilorðin stemma ekki.")); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: a });
      if (error) throw error;
      setA(""); setB(""); setOpen(false);
      flashSaved(t("comp.ac.pwchanged", "Lykilorðinu var breytt."));
    } catch (e2) {
      setErr(friendlyError(e2, t("comp.ac.pwfailed", "Tókst ekki að breyta lykilorðinu.")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-hc-ink">{t("comp.ac.password", "Lykilorð")}</p>
          <p className="text-xs text-hc-ink-3">{t("comp.ac.tosignin", "Til að skrá þig inn með netfangi.")}</p>
        </div>
        {!open && <SavedNote msg={savedMsg} />}
        {!open && <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setErr(""); clearSaved(); }}>{t("acct.q.edit", "Breyta")}</Button>}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 max-w-sm space-y-2">
          <input type="password" value={a} onChange={(e) => setA(e.target.value)} placeholder={t("acc.pw.new12", "Nýtt lykilorð (minnst 12 stafir)")} aria-label={t("acc.pw.new12", "Nýtt lykilorð (minnst 12 stafir)")} autoComplete="new-password" className={input} />
          <input type="password" value={b} onChange={(e) => setB(e.target.value)} placeholder={t("comp.ac.newpwagain", "Nýja lykilorðið aftur")} aria-label={t("comp.ac.newpwagain", "Nýja lykilorðið aftur")} autoComplete="new-password" className={input} />
          {a.length > 0 && a.length < 12 && <p className="text-xs text-hc-ink-3">{t("comp.ac.pwcount", "Minnst 12 stafir")} ({a.length}/12)</p>}
          {err && <Alert tone="bad" compact>{err}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" busy={busy} disabled={a.length < 12 || !b}>{busy ? t("acc.common.saving", "Vista…") : t("comp.ac.savepw", "Vista lykilorð")}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setA(""); setB(""); setErr(""); }}>{t("comp.ac.cancel", "Hætta við")}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" className={className} busy={busy} icon={<LogOut className="h-4 w-4" aria-hidden />}
      onClick={async () => {
        setBusy(true);
        // Leave even if the server call fails (offline): the local session
        // is cleared either way, and staying put would look like a dead button.
        await supabase.auth.signOut().catch(() => supabase.auth.signOut({ scope: "local" }).catch(() => undefined));
        router.push("/account/login");
      }}>
      {busy ? t("comp.ac.signingout", "Skrái út…") : t("comp.ac.signout", "Skrá út")}
    </Button>
  );
}

export function DeleteAccountCard() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const del = async () => {
    if (text !== t("comp.ac.deleteword", "EYÐA")) return;
    setBusy(true); setErr("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr(t("comp.ac.notsignedin", "Þú ert ekki innskráð(ur).")); setBusy(false); return; }
    const r = await fetch("https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId: session.user.id }),
    }).catch((e: unknown) => e as Error);
    if (r instanceof Error) { setErr(friendlyError(r, t("comp.ac.deletefailed", "Tókst ekki að eyða aðganginum."))); setBusy(false); return; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(friendlyError(j.error || j.message || (r.status === 401 ? "unauthorized" : ""), t("comp.ac.deletefailed", "Tókst ekki að eyða aðganginum.")));
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
  };
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-700">{t("comp.ac.delete", "Eyða aðgangi")}</p>
          <p className="text-xs text-hc-ink-3">{t("comp.ac.deletedesc", "Eyðir aðganginum og gögnunum hjá Lifeline. Sjúkraskráin í sjúklingagáttinni fylgir eigin reglum.")}</p>
        </div>
        {!open && <Button size="sm" variant="dangerOutline" onClick={() => setOpen(true)}>{t("comp.ac.deleteshort", "Eyða")}</Button>}
      </div>
      {open && (
        <div className="mt-3 rounded-hc-card bg-hc-bad-surface p-4 ring-1 ring-rose-200">
          <p className="text-sm text-hc-bad-ink">{t("comp.ac.cannotundo", "Þetta er ekki hægt að afturkalla. Skrifaðu")} <strong>{t("comp.ac.deleteword", "EYÐA")}</strong> {t("comp.ac.toconfirm", "til að staðfesta.")}</p>
          <input value={text} onChange={(e) => setText(e.target.value)} className={`${input} mt-2 max-w-xs`} aria-label={t("comp.ac.confirmation", "Staðfesting")} />
          {err && <p role="alert" className="mt-2 text-sm text-hc-bad-ink">{err}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => void del()} disabled={text !== t("comp.ac.deleteword", "EYÐA")} busy={busy}>{busy ? t("comp.ac.deleting", "Eyði…") : t("comp.ac.yesdelete", "Já, eyða aðganginum mínum")}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setText(""); setErr(""); }}>{t("comp.ac.cancel", "Hætta við")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

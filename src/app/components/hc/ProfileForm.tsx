"use client";

// The participant's own details — name, kennitala, phone, address — and the
// health-data consent that has to go with them.
//
// Lifted out of the journey page so there is one of it. It is the first
// thing a new participant does and it is step one of the onboarding
// walkthrough; two copies of a form that writes a kennitala would drift,
// and the one that drifted would be the one nobody was looking at.
//
// Writes to /api/hc/profile, which owns validation and the consent stamp.

import { useState } from "react";
import { renderHealthAssessmentConsent } from "@/lib/platform-terms-content";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

function splitAddress(a: string | null) {
  const m = /^(.*),\s*(\d{3})\s+(.+)$/.exec(a || "");
  return m ? { street: m[1], postcode: m[2], town: m[3] } : { street: a || "", postcode: "", town: "" };
}

/** Only what the form needs, so a caller does not have to hold a whole journey. */
export interface ProfileFormData {
  profile: {
    email: string;
    full_name: string | null;
    phone: string | null;
    address: string | null;
    kennitala_last4: string | null;
    complete: boolean;
    health_consent?: boolean;
  };
}

/** GDPR 9. gr.: informed consent for processing health data, with the full text one tap away. */
export function ConsentBox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div className={`rounded-xl border p-3 text-sm ${error ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#10B981]" />
        <span className="text-slate-700">
          Ég hef lesið <strong>upplýst samþykki fyrir heilsumat</strong> og samþykki að Lifeline Health vinni með heilsufarsupplýsingar mínar vegna heilsufarsskoðunarinnar. Ég get dregið samþykkið til baka hvenær sem er.
        </span>
      </label>
      <details className="mt-2 pl-8">
        <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Lesa samþykkið í heild</summary>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-600">{renderHealthAssessmentConsent()}</pre>
      </details>
      {error && <p className="mt-2 pl-8 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function ProfileForm({ data, reload, api, track = "care" }: {
  data: ProfileFormData;
  reload: () => Promise<void>;
  /** The caller's fetch wrapper, so this works from any surface. */
  api: Api;
  /*
   * Which set of details this journey actually needs.
   *
   * "care" is the health check: kennitala, phone and address, because the
   * patient portal and the union application need them — this form has
   * always said so in its own first line.
   *
   * "app" is the coaching-only track, where neither of those things exists.
   * Asking for a kennitala there collects a national health-service
   * identifier for no purpose, which is a data minimisation problem before
   * it is a conversion problem. A name is what the app needs.
   */
  track?: "care" | "app";
}) {
  const addr = splitAddress(data.profile.address);
  const [f, setF] = useState({
    full_name: data.profile.full_name || "",
    phone: data.profile.phone || "",
    address: addr.street,
    postcode: addr.postcode,
    town: addr.town,
    kennitala: "",
  });
  const [consent, setConsent] = useState(!!data.profile.health_consent);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors({}); setSaved(false);
    const r = await api("/api/hc/profile", { method: "POST", body: JSON.stringify({ ...f, accept_health_consent: consent }) });
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
      <p className="text-sm text-slate-600">
        {track === "app"
          ? "Bara nafnið, til að heilsa þér og setja á áætlunina. Kennitölu þarf ekki fyrir þjálfunina."
          : "Við þurfum þessar upplýsingar fyrir sjúklingagáttina og til að útbúa umsókn til stéttarfélagsins þíns ef við á."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("full_name", "Fullt nafn", { autoComplete: "name" })}
        {/* Everything below here exists for the patient portal and the union
            application. Neither is part of the coaching track, so neither is
            asked for there. */}
        {track === "care" && (
          <>
            {field("kennitala", data.profile.kennitala_last4 ? `Kennitala (skráð: ••••••-${data.profile.kennitala_last4})` : "Kennitala", { inputMode: "numeric", placeholder: data.profile.kennitala_last4 ? "Sláðu inn til að breyta" : "000000-0000" })}
            {field("phone", "Farsími", { autoComplete: "tel", inputMode: "tel" })}
            {field("address", "Heimilisfang", { autoComplete: "street-address" })}
            {field("postcode", "Póstnúmer", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 3 })}
            {field("town", "Bæjarfélag", { autoComplete: "address-level2" })}
          </>
        )}
      </div>
      {!data.profile.health_consent && <ConsentBox checked={consent} onChange={setConsent} error={errors.consent} />}
      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
          {busy ? "Vistar…" : "Vista upplýsingar"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Vistað</span>}
      </div>
      {track === "care" && (
        <p className="text-xs text-slate-500">Kennitalan er dulkóðuð og aðeins notuð fyrir heilbrigðisþjónustuna og umsóknir sem þú sendir sjálf(ur).</p>
      )}
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        Ábending: Í stillingum hér til hliðar getur þú sett upp <strong>PIN</strong> fyrir fljótlegri innskráningu og tengt ferðina við <strong>Google eða Apple dagatal</strong>.
      </div>
    </form>
  );
}

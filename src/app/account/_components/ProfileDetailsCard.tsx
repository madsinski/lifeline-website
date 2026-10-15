"use client";

// Persónuupplýsingar on Aðgangur.
//
// Not AccountCards' ProfileCard: that one saves through /api/hc/profile,
// which requires a kennitala and a split street/postcode/town address and
// does not carry the emergency contact, date of birth or sex this page has
// always written. So this keeps the page's own form — restyled, writing
// through the clients_decrypted view as before — and uses the same DOB
// input as the body-composition profile.

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, Field, SectionCard, accountInput, accountLabel, fmtDate, fmtMonthYear } from "@/app/components/account/ui";
import { DobFields } from "./BiodyProfileModal";
import type { Profile } from "./types";

const SEX_KEYS = ["female", "male", "other", "prefer_not_to_say"] as const;

export default function ProfileDetailsCard({ user, profile, onSaved }: {
  user: User;
  profile: Profile;
  onSaved: (p: Profile) => void;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<Profile>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const sexLabel = (k: string) => ({
    male: t("acct.q.male", "Karl"),
    female: t("acct.q.female", "Kona"),
    other: t("acct.p.annad", "Annað"),
    prefer_not_to_say: t("acc.profile.nosay", "Vil ekki svara"),
  } as Record<string, string>)[k];
  const missing = <span className="text-hc-ink-3">{t("acct.p.ekki-skrad", "Ekki skráð")}</span>;

  const start = () => { setF(profile); setError(""); setSavedMsg(""); setEditing(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.firstName.trim()) { setError(t("acc.profile.firstname-required", "Fornafn vantar.")); return; }
    setSaving(true);
    const fullName = `${f.firstName.trim()} ${f.lastName.trim()}`.trim();
    const { error: upErr } = await supabase.from("clients_decrypted").update({
      full_name: fullName,
      phone: f.phone.trim() || null,
      address: f.address.trim() || null,
      emergency_contact_name: f.emergencyName.trim() || null,
      emergency_contact_phone: f.emergencyPhone.trim() || null,
      date_of_birth: f.dob || null,
      sex: f.sex || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (upErr) { setSaving(false); setError(upErr.message); return; }
    await supabase.auth.updateUser({ data: { full_name: fullName, phone: f.phone.trim() } });
    setSaving(false);
    setEditing(false);
    onSaved({ ...f, firstName: f.firstName.trim(), lastName: f.lastName.trim() });
    setSavedMsg(t("acct.p.upplysingarnar-voru-vistadar", "Upplýsingarnar voru vistaðar."));
  };

  const input = (k: keyof Profile, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className={accountLabel}>{label}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={`${accountInput} mt-1`} {...props} />
    </label>
  );

  return (
    <SectionCard id="profile" title={t("acct.p.personuupplysingar", "Persónuupplýsingar")}
      description={t("acct.p.nafn-simi-heimilisfang-og-tengilid", "Nafn, sími, heimilisfang og tengiliður í neyð")}
      action={!editing ? <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" aria-hidden />} onClick={start}>{t("acct.q.edit", "Breyta")}</Button> : undefined}>
      {savedMsg && !editing && <Alert tone="ok" compact className="mb-4" onDismiss={() => setSavedMsg("")}>{savedMsg}</Alert>}
      {!editing ? (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("acct.q.name", "Nafn")}>{`${profile.firstName} ${profile.lastName}`.trim() || missing}</Field>
          <Field label={t("acct.q.email", "Netfang")}>{user.email}</Field>
          <Field label={t("acct.p.simi", "Sími")}>{profile.phone || missing}</Field>
          <Field label={t("acct.q.address", "Heimilisfang")}>{profile.address || missing}</Field>
          <Field label={t("acct.p.tengilidur-i-neyd", "Tengiliður í neyð")}>
            {profile.emergencyName ? `${profile.emergencyName}${profile.emergencyPhone ? ` (${profile.emergencyPhone})` : ""}` : missing}
          </Field>
          <Field label={t("acct.p.faedingardagur", "Fæðingardagur")}>{profile.dob ? fmtDate(profile.dob, {}, locale) : missing}</Field>
          <Field label={t("acct.q.sex", "Kyn")}>{sexLabel(profile.sex) || missing}</Field>
          <Field label={t("acct.p.adgangur-fra", "Aðgangur frá")}>{user.created_at ? fmtMonthYear(user.created_at, locale) : "—"}</Field>
        </dl>
      ) : (
        <form onSubmit={save} className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {input("firstName", t("acct.q.firstname", "Fornafn"), { autoComplete: "given-name", required: true })}
          {input("lastName", t("acct.q.lastname", "Eftirnafn"), { autoComplete: "family-name" })}
          <label className="block sm:col-span-2">
            <span className={accountLabel}>{t("acct.q.email", "Netfang")}</span>
            <input value={user.email || ""} disabled className={`${accountInput} mt-1`} />
          </label>
          {input("phone", t("acct.p.simi", "Sími"), { type: "tel", autoComplete: "tel", inputMode: "tel" })}
          {input("address", t("acct.q.address", "Heimilisfang"), { autoComplete: "street-address" })}
          {input("emergencyName", t("acct.p.tengilidur-i-neyd", "Tengiliður í neyð"), { placeholder: t("acct.p.nafn-tengilids", "Nafn tengiliðs") })}
          {input("emergencyPhone", t("acct.p.simi-tengilids", "Sími tengiliðs"), { type: "tel", inputMode: "tel" })}
          <div className="sm:col-span-2">
            <span className={`${accountLabel} mb-1`}>{t("acct.p.faedingardagur", "Fæðingardagur")}</span>
            <DobFields value={f.dob} onChange={(dob) => setF((p) => ({ ...p, dob }))} idPrefix="profile-dob" />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className={accountLabel}>{t("acct.q.sex", "Kyn")}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {SEX_KEYS.map((k) => (
                <button key={k} type="button" aria-pressed={f.sex === k} onClick={() => setF({ ...f, sex: k })}
                  className={`rounded-hc-element px-3.5 py-2 text-sm font-medium ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
                    f.sex === k ? "bg-hc-brand-surface text-hc-brand-text ring-2 ring-hc-brand-dark" : "bg-hc-surface text-hc-ink-2 ring-hc-control hover:bg-hc-sunken"}`}>
                  {sexLabel(k)}
                </button>
              ))}
            </div>
          </fieldset>
          {error && <Alert tone="bad" compact className="sm:col-span-2">{error}</Alert>}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" busy={saving}>{t("acc.common.savechanges", "Vista breytingar")}</Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setError(""); }} disabled={saving}>{t("acct.cancel", "Hætta við")}</Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

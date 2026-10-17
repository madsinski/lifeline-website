"use client";

// Activating (or editing) the body-composition profile that Biody — the
// measurement partner — needs before a líkamssamsetningarmæling. First
// activation also records the GDPR Art. 9(2)(a) health-data consent, in the
// same server call, so the consent has its audit trail (PDF, IP, UA, hash)
// and Biody activation is gated by it.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { HEALTH_CONSENT_VERSION, renderHealthAssessmentConsent } from "@/lib/platform-terms-content";
import { Alert, Button, Modal, accountInput, accountLabel, friendlyError } from "@/app/components/account/ui";

/** DD / MM / YYYY with auto-advance; the parent keeps ISO YYYY-MM-DD. */
export function DobFields({ value, onChange, idPrefix = "dob" }: { value: string; onChange: (iso: string) => void; idPrefix?: string }) {
  const { t } = useI18n();
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const [initialY = "", initialM = "", initialD = ""] = (value || "").split("-");
  const [dd, setDd] = useState(initialD);
  const [mm, setMm] = useState(initialM);
  const [yyyy, setYyyy] = useState(initialY);

  const emit = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const dayN = Math.min(31, Math.max(1, parseInt(d, 10) || 0));
      const monN = Math.min(12, Math.max(1, parseInt(m, 10) || 0));
      onChange(`${y}-${String(monN).padStart(2, "0")}-${String(dayN).padStart(2, "0")}`);
    } else if (value) {
      onChange("");
    }
  };
  const digits = (s: string, max: number) => s.replace(/[^0-9]/g, "").slice(0, max);
  const cls = `${accountInput} text-center tabular-nums`;

  return (
    <div className="flex items-stretch gap-2">
      <label className="flex-1" htmlFor={`${idPrefix}-d`}>
        <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-hc-ink-3">{t("acct.q.day", "Dagur")}</span>
        <input id={`${idPrefix}-d`} type="text" inputMode="numeric" autoComplete="bday-day" placeholder="DD" maxLength={2} value={dd} required className={cls}
          onChange={(e) => { const v = digits(e.target.value, 2); setDd(v); emit(v, mm, yyyy); if (v.length === 2) monthRef.current?.focus(); }} />
      </label>
      <label className="flex-1" htmlFor={`${idPrefix}-m`}>
        <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-hc-ink-3">{t("acct.q.month", "Mánuður")}</span>
        <input id={`${idPrefix}-m`} ref={monthRef} type="text" inputMode="numeric" autoComplete="bday-month" placeholder="MM" maxLength={2} value={mm} required className={cls}
          onChange={(e) => { const v = digits(e.target.value, 2); setMm(v); emit(dd, v, yyyy); if (v.length === 2) yearRef.current?.focus(); }} />
      </label>
      <label className="flex-[1.4]" htmlFor={`${idPrefix}-y`}>
        <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-hc-ink-3">{t("acct.q.year", "Ár")}</span>
        <input id={`${idPrefix}-y`} ref={yearRef} type="text" inputMode="numeric" autoComplete="bday-year" placeholder="ÁÁÁÁ" maxLength={4} value={yyyy} required className={cls}
          onChange={(e) => { const v = digits(e.target.value, 4); setYyyy(v); emit(dd, mm, v); }} />
      </label>
    </div>
  );
}

type Activity = "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "";

export default function BiodyProfileModal({ userId, onClose, onActivated, onSaved }: {
  userId: string;
  onClose: () => void;
  onActivated?: () => void;
  /** Sex and date of birth are also on Persónuupplýsingar; keep it in step. */
  onSaved?: (p: { sex: string; dob: string }) => void;
}) {
  const { t, tv } = useI18n();
  const [biodyActive, setBiodyActive] = useState(false);
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<Activity>("");
  const [dob, setDob] = useState("");
  const [acceptHealth, setAcceptHealth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [biodyWasActive, setBiodyWasActive] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clients_decrypted")
        .select("sex, height_cm, weight_kg, activity_level, date_of_birth, biody_patient_id")
        .eq("id", userId)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        setSex((d.sex as "male" | "female" | "") || "");
        setHeightCm(d.height_cm ? String(d.height_cm) : "");
        setWeightKg(d.weight_kg ? String(d.weight_kg) : "");
        setActivityLevel((d.activity_level as Activity) || "");
        setDob((d.date_of_birth as string) || "");
        setBiodyActive(!!d.biody_patient_id);
        setBiodyWasActive(!!d.biody_patient_id);
      }
      setLoading(false);
    })();
  }, [userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!sex || !heightCm || !weightKg || !activityLevel || !dob) {
      setError(t("acct.p.fylltu-ut-alla-reiti", "Fylltu út alla reiti."));
      return;
    }
    if (!biodyActive && !acceptHealth) {
      setError(t("acct.p.samthykktu-medferd-heilsufarsupply", "Samþykktu meðferð heilsufarsupplýsinga til að virkja."));
      return;
    }
    setSaving(true);
    setError("");

    if (!biodyActive) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/account/onboard/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            sex,
            date_of_birth: dob,
            height_cm: Number(heightCm),
            weight_kg: Number(weightKg),
            activity_level: activityLevel,
            accept_health_consent: true,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) {
          setSaving(false);
          setError(friendlyError(j.error === "health_consent_required" ? "" : (typeof j.detail === "string" ? j.detail : j.error === "profile_update_failed" ? "" : j.error), t("acc.biody.failed", "Virkjun tókst ekki. Hafðu samband við okkur.")));
          return;
        }
        // The API can succeed while Biody itself soft-fails; say so rather
        // than showing "Breyta upplýsingum" and reverting on the next load.
        if (j.biody_activated === false) {
          setSaving(false);
          setError(friendlyError(typeof j.biody_error === "string" ? j.biody_error : "", t("acc.biody.failed-retry", "Ekki tókst að virkja hjá Biody. Reyndu aftur eða hafðu samband.")));
          return;
        }
        setBiodyActive(true);
        onActivated?.();
      } catch (err) {
        setSaving(false);
        setError(friendlyError(err, t("acc.biody.failed", "Virkjun tókst ekki. Hafðu samband við okkur.")));
        return;
      }
    } else {
      // Already active: a plain profile update through the view.
      const { error: upErr } = await supabase.from("clients_decrypted").update({
        sex,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        activity_level: activityLevel,
        ...(dob ? { date_of_birth: dob } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      if (upErr) { setSaving(false); setError(friendlyError(upErr, t("acc.biody.savefailed", "Tókst ekki að vista upplýsingarnar. Reyndu aftur."))); return; }
    }

    onSaved?.({ sex, dob });
    setSaving(false);
    setSaved(true);
    setTimeout(() => onClose(), 900);
  }

  const select = `${accountInput} mt-1`;
  return (
    <Modal onClose={onClose} dismissable={!saving}
      title={biodyActive ? t("acct.p.breyta-upplysingum-fyrir-likamssam", "Breyta upplýsingum fyrir líkamssamsetningu") : t("acct.p.virkja-likamssamsetningarmaelingu", "Virkja líkamssamsetningarmælingu")}
      description={biodyActive
        ? t("acct.p.hafdu-upplysingarnar-rettar-svo-ma", "Hafðu upplýsingarnar réttar svo mælingar og ráðleggingar séu nákvæmar.")
        : t("acc.biody.intro", "Nokkur atriði svo hægt sé að stofna þig hjá Biody, samstarfsaðila okkar sem sér um líkamssamsetningarmælinguna.")}>
      {loading ? (
        <p className="py-6 text-center text-sm text-hc-ink-3">{t("acct.q.loading", "Augnablik…")}</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={accountLabel}>{t("acct.q.sexlabel", "Kyn")}</span>
              <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female" | "")} required className={select}>
                <option value="">{t("acct.q.select", "Veldu…")}</option>
                <option value="female">{t("acct.q.female", "Kona")}</option>
                <option value="male">{t("acct.q.male", "Karl")}</option>
              </select>
              <span className="mt-1 block text-[11px] leading-snug text-hc-ink-3">{t("acc.biody.sex-why", "Mælitækið reiknar út frá líffræðilegu kyni.")}</span>
            </label>
            <label className="block">
              <span className={accountLabel}>{t("acct.q.activity", "Hreyfing")}</span>
              <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as Activity)} required className={select}>
                <option value="">{t("acct.q.select", "Veldu…")}</option>
                <option value="sedentary">{t("acct.q.act0", "Kyrrseta — lítil sem engin hreyfing")}</option>
                <option value="light">{t("acct.q.act1", "Létt — hreyfing 1–3 daga í viku")}</option>
                <option value="moderate">{t("acct.q.act2", "Miðlungs — hreyfing 3–5 daga í viku")}</option>
                <option value="very_active">{t("acct.q.act3", "Mjög virk/virkur — hreyfing 6–7 daga í viku")}</option>
                <option value="extra_active">{t("acct.q.act4", "Mjög mikil — hörð þjálfun daglega")}</option>
              </select>
            </label>
            <label className="block">
              <span className={accountLabel}>{t("acct.q.heightcm", "Hæð (cm)")}</span>
              <input type="number" min={100} max={230} step={1} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required className={select} />
            </label>
            <label className="block">
              <span className={accountLabel}>{t("acct.q.weightkg", "Þyngd (kg)")}</span>
              <input type="number" min={30} max={300} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required className={select} />
            </label>
            <div className="sm:col-span-2">
              <span className={`${accountLabel} mb-1`}>{t("acct.p.faedingardagur", "Fæðingardagur")}</span>
              <DobFields value={dob} onChange={setDob} idPrefix="biody-dob" />
            </div>
          </div>

          {!biodyActive && (
            <div className="space-y-2 border-t border-hc-hairline pt-4">
              <p className="text-sm font-semibold text-hc-ink">{tv("acct.p.consent-version", "Upplýst samþykki fyrir heilsufarsskoðun ({{v}})", { v: HEALTH_CONSENT_VERSION })}</p>
              <p className="text-xs text-hc-ink-3">{t("acc.biody.gdpr", "9. gr. (2)(a) GDPR · krafa fyrir vinnslu heilsufarsupplýsinga")}</p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-hc-element bg-hc-sunken p-3 font-sans text-[11px] leading-relaxed text-hc-ink-2 ring-1 ring-hc-hairline">
{renderHealthAssessmentConsent()}
              </pre>
              <label className="flex cursor-pointer select-none items-start gap-2">
                <input type="checkbox" checked={acceptHealth} onChange={(e) => setAcceptHealth(e.target.checked)} className="mt-1 h-4 w-4 accent-[#047857]" />
                <span className="text-sm text-hc-ink-2">
                  {tv("acc.biody.consent", "Ég veiti upplýst og beint samþykki fyrir vinnslu heilsufarsupplýsinga minna í tengslum við heilsumat Lifeline Health ({{v}}).", { v: HEALTH_CONSENT_VERSION })}
                </span>
              </label>
            </div>
          )}

          {error && <Alert tone="bad" compact>{error}</Alert>}
          {saved && <Alert tone="ok" compact>{biodyWasActive ? t("acct.q.saved", "Vistað.") : t("acc.biody.activated", "Vistað og virkjað.")}</Alert>}
          <div className="flex items-center justify-end gap-2 border-t border-hc-hairline pt-4">
            <Button variant="secondary" onClick={onClose} disabled={saving}>{t("acct.q.close", "Loka")}</Button>
            <Button type="submit" busy={saving} disabled={saved || (!biodyActive && !acceptHealth)}>
              {biodyActive ? t("acc.common.savechanges", "Vista breytingar") : t("acc.biody.activate", "Vista og virkja")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

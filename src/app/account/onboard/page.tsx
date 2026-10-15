"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, Check, ClipboardCheck, ShieldCheck, Zap } from "lucide-react";
import { AccountLoading, Alert, Button, PageHero, SectionCard, accountInput, accountInset, accountLabel, useDialog, DialogProvider } from "@/app/components/account/ui";
import { DobFields } from "../_components/BiodyProfileModal";
import {
  HEALTH_CONSENT_VERSION,
  renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";

// Legacy B2C onboarding wizard. The new canonical flow goes
// signup → /account/welcome (slideshow) → /account; body-composition
// profile + health-data consent are collected later via the
// BiodyProfileModal on the dashboard, so this wizard is no longer
// reached in the natural flow.
//
// We keep the page reachable in case an old link points here, and
// redirect to /account if welcome_seen_at is already stamped (which
// it is for anyone who has completed the slideshow). For users who
// somehow ended up here without seeing the slideshow we still show
// the wizard so they're not stuck.

type Stage = "welcome" | "consent" | "profile" | "saving";
type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "";

export default function AccountOnboardPage() {
  return <DialogProvider><Onboard /></DialogProvider>;
}

function Onboard() {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("welcome");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  // Consent. Research/marketing opt-outs were already captured
  // at signup (/account/login) — no need to re-prompt here.
  const [acceptHealth, setAcceptHealth] = useState(false);

  // Profile
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("");

  // Scroll to top on every stage change so the user sees the new step header
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  // Auth gate + preload. If the user is actually B2B, bounce to the B2B welcome.
  // If the user already has a complete profile + welcome_seen_at, bounce
  // straight to /account so revisits don't re-run the wizard.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/account/login?next=/account/onboard"); return; }
      setEmail(user.email || "");
      const { data } = await supabase
        .from("clients_decrypted")
        .select("full_name, sex, date_of_birth, height_cm, weight_kg, activity_level, company_id, welcome_seen_at")
        .eq("id", user.id)
        .maybeSingle();
      const fn = ((data?.full_name as string | null) || user.email?.split("@")[0] || "").split(" ")[0];
      setFirstName(fn || "");
      // B2B user should not land here — send them to the B2B welcome page
      if (data?.company_id) {
        router.replace("/account/welcome");
        return;
      }
      // The slideshow now stamps welcome_seen_at on completion. Once
      // that's set, the canonical place for body-composition profile
      // + health consent is the BiodyProfileModal on the dashboard,
      // not this wizard. Bounce them home.
      if (data?.welcome_seen_at) {
        router.replace("/account");
        return;
      }
      // Pre-fill whatever they may have set before (e.g. opened BiodyProfileModal once)
      if (data?.sex) setSex(data.sex as "male" | "female");
      if (data?.date_of_birth) setDob(data.date_of_birth as string);
      if (data?.height_cm) setHeightCm(String(data.height_cm));
      if (data?.weight_kg) setWeightKg(String(data.weight_kg));
      if (data?.activity_level) setActivityLevel(data.activity_level as ActivityLevel);
      setLoading(false);
    })();
  }, [router]);

  const submit = async () => {
    if (!sex || !dob || !heightCm || !weightKg || !activityLevel) {
      setError(t("acct.ob.fillall", "Fylltu út alla reiti."));
      setStage("profile");
      return;
    }
    if (!acceptHealth) {
      setError(t("acct.ob.needconsent", "Samþykktu meðferð heilsufarsupplýsinga til að halda áfram."));
      setStage("consent");
      return;
    }
    setStage("saving");
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/account/onboard/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sex,
          date_of_birth: dob,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          activity_level: activityLevel,
          accept_health_consent: true,
          // research_opt_out + marketing_opt_out captured at signup
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError(typeof j.detail === "string" ? j.detail : j.error || t("acct.ob.failedsupport", "Uppsetning tókst ekki. Hafðu samband við þjónustuna."));
        setStage("profile");
        return;
      }
      router.push("/account");
    } catch (e) {
      setError((e as Error).message || t("acct.ob.failed", "Uppsetning tókst ekki."));
      setStage("profile");
    }
  };

  if (loading) return <AccountLoading label={t("acct.ob.loading", "Hleð…")} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-hc-brand-surface via-white to-white">
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6 sm:py-14">
        {/* Signed-in-as, with a "wrong account?" escape hatch: prevents the
            cross-tab session bleed where a confirmation link is opened with
            another Lifeline session in the same browser. */}
        {email && (
          <div className={`${accountInset} flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs`}>
            <span className="text-hc-ink-2">
              {t("acct.ob.signedinas", "Skráð(ur) inn sem")} <strong className="font-mono text-hc-ink">{email}</strong>
            </span>
            <Button variant="link" onClick={async () => {
              const ok = await confirm({
                title: t("acct.ob.signoutq", "Skrá út og opna skráninguna aftur með öðrum aðgangi?"),
                confirmLabel: t("acct.ob.signout", "Skrá út"), cancelLabel: t("acct.cancel", "Hætta við"),
              });
              if (!ok) return;
              await supabase.auth.signOut();
              router.replace("/account/login?next=/account/onboard");
            }}>
              {t("acct.ob.wrongaccount", "Rangur aðgangur? Skrá út")}
            </Button>
          </div>
        )}
        <StageIndicator stage={stage} />

        {stage === "welcome" && <WelcomeStage firstName={firstName} onContinue={() => setStage("consent")} />}
        {stage === "consent" && (
          <ConsentStage acceptHealth={acceptHealth} setAcceptHealth={setAcceptHealth}
            onBack={() => setStage("welcome")} onContinue={() => { setError(""); setStage("profile"); }} />
        )}
        {stage === "profile" && (
          <ProfileStage email={email}
            sex={sex} setSex={setSex} dob={dob} setDob={setDob}
            heightCm={heightCm} setHeightCm={setHeightCm} weightKg={weightKg} setWeightKg={setWeightKg}
            activityLevel={activityLevel} setActivityLevel={setActivityLevel}
            error={error} onBack={() => setStage("consent")} onContinue={submit} />
        )}
        {stage === "saving" && (
          <SectionCard className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-hc-brand-dark border-t-transparent" />
            <p className="text-sm text-hc-ink-2">{t("acct.ob.saving", "Set upp sniðið þitt…")}</p>
          </SectionCard>
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function StageIndicator({ stage }: { stage: Stage }) {
  const { t } = useI18n();
  const order: Stage[] = ["welcome", "consent", "profile"];
  const idx = order.indexOf(stage);
  const steps = [
    { key: "welcome", label: t("acct.ob.st-intro", "Kynning") },
    { key: "consent", label: t("acct.ob.st-consent", "Samþykki") },
    { key: "profile", label: t("acct.ob.st-profile", "Upplýsingar") },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
              done ? "bg-hc-brand-dark text-white" : active ? "bg-hc-focus text-white" : "bg-slate-200 text-hc-ink-3"}`}>
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={`font-medium ${active ? "text-hc-ink" : "text-hc-ink-3"}`}>{s.label}</span>
            {i < steps.length - 1 && <span aria-hidden className="text-slate-300">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function WelcomeStage({ firstName, onContinue }: { firstName: string; onContinue: () => void }) {
  const { t, tv } = useI18n();
  const after = [
    { icon: ShieldCheck, title: t("account.steps.1.title", "Farðu í heilsumat"), body: t("acct.ob.s1desc", "Bókaðu grunnheilsufarsskoðunina þína á mælingastöð Lifeline í Reykjavík.") },
    { icon: ClipboardCheck, title: t("account.steps.2.title", "Fáðu skýrsluna þína"), body: t("acct.ob.s2desc", "Lifeline-læknir fer yfir niðurstöðurnar þínar og setur saman persónulega áætlun.") },
    { icon: Zap, title: t("account.steps.3.title", "Byrjaðu þjálfun"), body: t("acct.ob.s3desc", "Daglegar aðgerðir í hreyfingu, næringu, svefni og andlegri líðan — í appinu.") },
  ];
  return (
    <div className="space-y-5">
      <PageHero kicker={t("acct.ob.welcome", "Velkomin(n) til Lifeline Health")}
        title={firstName ? tv("acct.ob.hi", "Hæ, {{name}}", { name: firstName }) : t("acct.ob.welcome", "Velkomin(n) til Lifeline Health")}
        body={t("acct.ob.lede", "Lifeline Health sameinar markvissa heilsufarsskoðun og persónulega daglega þjálfun. Þekktu tölurnar þínar, byggðu upp betri venjur og fylgstu með framförum — með leiðsögn íslenskra lækna og þjálfara.")} />

      <SectionCard title={t("acct.ob.next", "Hvað gerist næst")} description={t("acct.ob.twosteps", "Tvö stutt skref svo við getum sett upp Lifeline-aðganginn þinn og líkamssamsetningarsniðið.")}>
        <ol className="space-y-4">
          <Step n={1} title={t("acct.ob.acceptconsent", "Samþykktu meðferð heilsufarsupplýsinga")}>{t("acct.ob.consentwhy", "Hefðbundið samþykki svo við megum vinna með heilsufarsupplýsingarnar þínar með lögmætum hætti.")}</Step>
          <Step n={2} title={t("acct.ob.confirm", "Staðfestu upplýsingarnar þínar")}>{t("acct.ob.confirmwhy", "Kyn, fæðingardagur, hæð, þyngd og hreyfing — fyrir líkamssamsetningarsniðið þitt.")}</Step>
        </ol>
        <div className="mt-6 border-t border-hc-hairline pt-6">
          <h3 className="mb-3 text-sm font-semibold text-hc-ink">{t("acct.ob.after", "Eftir skráningu")}</h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {after.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.title} className={`${accountInset} p-4`}>
                  <span aria-hidden className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-hc-brand-surface text-hc-brand-text"><Icon className="h-5 w-5" /></span>
                  <p className="text-sm font-semibold text-hc-ink">{a.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-hc-ink-2">{a.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={onContinue}>{t("acct.ob.start", "Byrjum")}<ArrowRight className="h-4 w-4" aria-hidden /></Button>
        </div>
      </SectionCard>
    </div>
  );
}

function ConsentStage({ acceptHealth, setAcceptHealth, onBack, onContinue }: {
  acceptHealth: boolean; setAcceptHealth: (v: boolean) => void;
  onBack: () => void; onContinue: () => void;
}) {
  const { t, tv } = useI18n();
  return (
    <SectionCard title={t("acct.doc.consent", "Upplýst samþykki fyrir heilsumat")}
      description={t("acct.ob.gdpr", "Áður en þú getur hafið heilsumat þarftu að veita upplýst samþykki fyrir vinnslu heilsufarsupplýsinga skv. 9. gr. GDPR og laga nr. 74/1997 um réttindi sjúklinga. Samþykkið er skráð rafrænt með tímastimpli, IP-tölu og vafraauðkenni. Þú færð staðfestingarskjal með tölvupósti.")}>
      <h3 className="mb-2 text-sm font-semibold text-hc-ink">
        {tv("acct.p.consent-version", "Upplýst samþykki fyrir heilsumat ({{v}})", { v: HEALTH_CONSENT_VERSION })}
      </h3>
      <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-hc-element bg-hc-sunken p-4 font-sans text-[12px] leading-relaxed text-hc-ink-2 ring-1 ring-hc-hairline">
{renderHealthAssessmentConsent()}
      </pre>
      <label className="mt-3 flex cursor-pointer select-none items-start gap-2">
        <input type="checkbox" checked={acceptHealth} onChange={(e) => setAcceptHealth(e.target.checked)} className="mt-1 h-4 w-4 accent-[#047857]" />
        <span className="text-sm text-hc-ink-2">
          {tv("acc.biody.consent", "Ég veiti upplýst og beint samþykki fyrir vinnslu heilsufarsupplýsinga minna í tengslum við heilsumat Lifeline Health ({{v}}).", { v: HEALTH_CONSENT_VERSION })}
        </span>
      </label>
      <div className="mt-6 flex items-center justify-between border-t border-hc-hairline pt-4">
        <Button variant="secondary" onClick={onBack}>{t("acct.ob.back", "Til baka")}</Button>
        <Button onClick={onContinue} disabled={!acceptHealth}>
          {acceptHealth ? t("acct.ob.continue2", "Halda áfram") : t("acct.ob.acceptdoc", "Samþykktu skjalið")}
          {acceptHealth && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </SectionCard>
  );
}

function ProfileStage({
  email,
  sex, setSex, dob, setDob, heightCm, setHeightCm, weightKg, setWeightKg,
  activityLevel, setActivityLevel, error, onBack, onContinue,
}: {
  email: string;
  sex: "male" | "female" | ""; setSex: (v: "male" | "female" | "") => void;
  dob: string; setDob: (v: string) => void;
  heightCm: string; setHeightCm: (v: string) => void;
  weightKg: string; setWeightKg: (v: string) => void;
  activityLevel: ActivityLevel; setActivityLevel: (v: ActivityLevel) => void;
  error: string; onBack: () => void; onContinue: () => void;
}) {
  const { t } = useI18n();
  const control = `${accountInput} mt-1`;
  return (
    <SectionCard title={t("acct.ob.confirm", "Staðfestu upplýsingarnar þínar")} description={t("acct.ob.bcwhy", "Þetta setur upp líkamssamsetningarsniðið þitt hjá mælingaaðilanum okkar.")}>
      <label className="block">
        <span className={accountLabel}>{t("acct.ob.email", "Netfang")}</span>
        <input type="email" value={email} disabled className={control} />
      </label>

      <div className="mt-5 space-y-4 border-t border-hc-hairline pt-5">
        <h3 className="text-sm font-semibold text-hc-ink">{t("acct.ob.bcprofile", "Líkamssamsetningarsnið")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("acct.q.sexlabel", "Kyn")}>
            <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female" | "")} required className={control}>
              <option value="">{t("acct.ob.select", "Veldu…")}</option>
              <option value="female">{t("acct.ob.female", "Kona")}</option>
              <option value="male">{t("acct.ob.male", "Karl")}</option>
            </select>
          </FormField>
          <FormField label={t("acct.ob.activity", "Hreyfing")}>
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)} required className={control}>
              <option value="">{t("acct.ob.select", "Veldu…")}</option>
              <option value="sedentary">{t("acct.ob.act0", "Kyrrseta — lítil sem engin hreyfing")}</option>
              <option value="light">{t("acct.ob.act1", "Létt — hreyfing 1–3 daga í viku")}</option>
              <option value="moderate">{t("acct.ob.act2", "Miðlungs — hreyfing 3–5 daga í viku")}</option>
              <option value="very_active">{t("acct.ob.act3", "Mjög virk/virkur — hreyfing 6–7 daga í viku")}</option>
              <option value="extra_active">{t("acct.ob.act4", "Mjög mikil — hörð þjálfun daglega")}</option>
            </select>
          </FormField>
          <FormField label={t("acct.ob.height", "Hæð (cm)")}>
            <input type="number" min={100} max={230} step={1} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required className={control} />
          </FormField>
          <FormField label={t("acct.ob.weight", "Þyngd (kg)")}>
            <input type="number" min={30} max={300} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required className={control} />
          </FormField>
          <div className="sm:col-span-2">
            <span className={`${accountLabel} mb-1`}>{t("acct.ob.dob", "Fæðingardagur")}</span>
            <DobFields value={dob} onChange={setDob} idPrefix="onboard-dob" />
          </div>
        </div>
      </div>

      {error && <Alert tone="bad" compact className="mt-4">{error}</Alert>}

      <div className="mt-6 flex items-center justify-between border-t border-hc-hairline pt-4">
        <Button variant="secondary" onClick={onBack}>{t("acct.ob.back", "Til baka")}</Button>
        <Button onClick={onContinue}>{t("acct.ob.save", "Vista og ljúka uppsetningu")}<Check className="h-4 w-4" aria-hidden /></Button>
      </div>
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hc-brand-dark text-xs font-bold text-white">{n}</span>
      <div>
        <p className="text-sm font-semibold text-hc-ink">{title}</p>
        <p className="text-sm leading-relaxed text-hc-ink-2">{children}</p>
      </div>
    </li>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={accountLabel}>{label}</span>
      {children}
    </label>
  );
}

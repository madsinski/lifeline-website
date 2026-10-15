"use client";

// B2B company signup, after /business/login has created and confirmed the
// contact person's account: confirm-email gate → platform terms + DPA →
// company details → the company page. Icelandic first, on the shared
// AuthShell like the other signup flows (/byrja, /business/onboard).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import AuthShell, { authInput, authLabel, authLink, authPrimary } from "@/app/components/AuthShell";
import { cleanKennitala, isValidKennitala, formatKennitala } from "@/lib/kennitala";
import {
  TOS_KEY,
  TOS_VERSION,
  DPA_KEY,
  DPA_VERSION,
  renderTermsOfService,
  renderDataProcessingAgreement,
} from "@/lib/platform-terms-content";
import ResendB2BConfirmation from "./ResendConfirmation";

const AGREEMENT_VERSION = "1.0"; // legacy column on companies — kept for backwards compat

type Step = "agreement" | "company";

const OFFLINE = "Engin tenging. Athugaðu netið og reyndu aftur.";

export default function BusinessSignupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("agreement");

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  // Email-confirmation gate (#13): an unconfirmed user must not be able to
  // sign agreements or create a company.
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const [tosChecked, setTosChecked] = useState(false);
  const [dpaChecked, setDpaChecked] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyKennitala, setCompanyKennitala] = useState("");

  // Contact-person details (#14) — captured so the signing contact is
  // identifiable, not just whoever happens to hold the account.
  const [contactKennitala, setContactKennitala] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPosition, setContactPosition] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      // No session — bounce to the canonical login page (signup tab) and come
      // back here once authenticated. /business/login is the single source of
      // truth for auth UI.
      if (!data.user) {
        router.replace("/business/login?mode=signup&next=/business/signup");
        return;
      }
      setUserId(data.user.id);
      setUserEmail(data.user.email || "");

      // Email-confirmation gate (#13). Supabase sets email_confirmed_at
      // only once the user has clicked the confirmation link. Block the
      // whole onboarding flow until then.
      if (!data.user.email_confirmed_at) {
        setNeedsEmailConfirm(true);
        setLoading(false);
        return;
      }
      // If they already manage companies, send them to the picker instead
      const { data: ownedCompanies } = await supabase
        .from("companies")
        .select("id")
        .eq("contact_person_id", data.user.id)
        .limit(1);
      if (ownedCompanies && ownedCompanies.length > 0) {
        router.replace("/business/account");
        return;
      }

      // Skip the agreement step if they've already accepted both current
      // versions (returning users creating an additional company).
      const { data: accRows } = await supabase
        .from("platform_agreement_acceptances")
        .select("document_key, document_version")
        .eq("user_id", data.user.id);
      const accepted = new Set((accRows ?? []).map((r: { document_key: string; document_version: string }) => `${r.document_key}@${r.document_version}`));
      const alreadyAccepted = accepted.has(`${TOS_KEY}@${TOS_VERSION}`) && accepted.has(`${DPA_KEY}@${DPA_VERSION}`);
      setStep(alreadyAccepted ? "company" : "agreement");
      setLoading(false);
    })();
  }, [router]);

  const handleAgreement = async () => {
    if (!tosChecked || !dpaChecked || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) authHeaders.Authorization = `Bearer ${token}`;

      const acceptOne = async (key: string, version: string) => {
        const r = await fetch("/api/platform/accept-terms", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ document_key: key, document_version: version }),
        });
        if (!r.ok) {
          throw new Error(r.status === 401 || r.status === 403
            ? "Innskráningin er útrunnin eða netfangið óstaðfest. Skráðu þig inn aftur og reyndu svo aftur."
            : "Ekki tókst að skrá samþykkið. Reyndu aftur.");
        }
      };

      // Record both acceptances. Order doesn't matter — idempotent via unique index.
      await Promise.all([
        acceptOne(TOS_KEY, TOS_VERSION),
        acceptOne(DPA_KEY, DPA_VERSION),
      ]);
      setStep("company");
    } catch (e) {
      setError(e instanceof TypeError ? OFFLINE : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!userId) return;
    if (!companyName.trim()) { setError("Sláðu inn nafn fyrirtækisins."); return; }
    if (!isValidKennitala(companyKennitala)) {
      setError("Kennitala fyrirtækisins er ekki gild. Hún á að vera 10 tölustafir.");
      return;
    }
    if (!isValidKennitala(contactKennitala)) {
      setError("Kennitalan þín er ekki gild. Hún á að vera 10 tölustafir.");
      return;
    }
    if (!contactPhone.trim()) { setError("Sláðu inn símanúmerið þitt."); return; }
    if (!contactPosition.trim()) { setError("Sláðu inn starfsheitið þitt hjá fyrirtækinu."); return; }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/business/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: companyName.trim(),
          kennitala: cleanKennitala(companyKennitala),
          contact_kennitala: cleanKennitala(contactKennitala),
          contact_phone: contactPhone.trim(),
          contact_position: contactPosition.trim(),
          agreement_version: AGREEMENT_VERSION,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The route answers with short codes; turn the ones a person can act on into sentences.
        throw new Error(
          res.status === 401 ? "Innskráningin er útrunnin. Skráðu þig inn aftur og reyndu svo aftur."
          : j.error === "email_not_confirmed" ? "Staðfestu netfangið fyrst og endurhlaððu svo síðuna."
          : res.status === 400 ? "Athugaðu upplýsingarnar um fyrirtækið og reyndu aftur."
          : "Ekki tókst að skrá fyrirtækið. Reyndu aftur eftir smástund.",
        );
      }
      // Stays "Skrái fyrirtækið…" until the company page takes over.
      router.push(`/business/${j.id}`);
    } catch (e) {
      setError(e instanceof TypeError ? OFFLINE : (e as Error).message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthShell>
        <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-hc-ink-2">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Hleð…
        </div>
      </AuthShell>
    );
  }

  if (needsEmailConfirm) {
    return (
      <AuthShell>
        <section className="text-center">
          <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-warn-surface text-hc-warn-ink">
            <Mail className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-hc-ink">Staðfestu netfangið fyrst</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-hc-ink-2">
            Til að vernda fyrirtækið þarftu að staðfesta netfangið áður en þú samþykkir skilmála, skráir
            fyrirtækið eða undirritar samninga. Við sendum staðfestingarhlekk á:
          </p>
          <p className="mt-4 break-all rounded-hc-element bg-hc-sunken px-4 py-3 text-sm font-semibold text-hc-ink">{userEmail}</p>
          <p className="mt-3 text-xs leading-relaxed text-hc-ink-3">
            Smelltu á hlekkinn og endurhlaððu svo síðuna. Finnurðu hann ekki? Athugaðu ruslpóstinn.
          </p>
          <ResendB2BConfirmation email={userEmail} className="mt-5" />
          <button type="button" onClick={() => window.location.reload()} className={`mt-3 ${authPrimary}`}>
            Ég hef staðfest — endurhlaða
          </button>
        </section>
      </AuthShell>
    );
  }

  const stepN = step === "agreement" ? 2 : 3;
  const stepLabel = step === "agreement"
    ? t("b2b.signup.stepper.agreement", "Samningur")
    : t("b2b.signup.stepper.company", "Fyrirtæki");
  const pane = "max-h-80 overflow-y-auto whitespace-pre-wrap rounded-hc-element bg-hc-sunken p-4 font-sans text-[12px] leading-relaxed text-hc-ink ring-1 ring-hc-hairline";
  const errorBox = error && (
    <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{error}</p>
  );

  return (
    <AuthShell
      width={step === "agreement" ? "lg" : "md"}
      step={{ n: stepN, of: 3 }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-hc-brand-text">
        {t("b2b.signup.header", "Fyrirtækjaskráning")} · {stepLabel}
      </p>

      {step === "agreement" && (
        <section className="mt-2 space-y-8">
          <header>
            <h1 className="text-2xl font-bold text-hc-ink">Notkunarskilmálar og vinnslusamningur</h1>
            <p className="mt-2 text-sm leading-relaxed text-hc-ink-2">
              Tvö skjöl gilda um notkun fyrirtækisins á Lifeline-gáttinni og um meðferð persónuupplýsinga
              starfsfólks samkvæmt persónuverndarlögum (nr. 90/2018) og GDPR. Lestu bæði og samþykktu.
              Þjónustusamningurinn sjálfur er undirritaður síðar, þegar verkefnið hefur verið sett upp.
            </p>
          </header>

          {/* Terms of Service */}
          <div>
            <h2 className="mb-1 text-lg font-semibold text-hc-ink">1. Notkunarskilmálar ({TOS_VERSION})</h2>
            <p className="mb-2 text-xs text-hc-ink-3">Hvernig þú og starfsfólkið notið Lifeline-gáttina.</p>
            <pre className={pane}>{renderTermsOfService()}</pre>
            <label className="mt-3 flex min-h-11 cursor-pointer select-none items-start gap-3">
              <input
                type="checkbox"
                checked={tosChecked}
                onChange={(e) => setTosChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-hc-brand-dark"
              />
              <span className="text-sm text-hc-ink">
                Ég hef lesið og samþykki notkunarskilmála Lifeline Health ({TOS_VERSION}) fyrir hönd fyrirtækisins.
              </span>
            </label>
          </div>

          {/* Data Processing Agreement */}
          <div>
            <h2 className="mb-1 text-lg font-semibold text-hc-ink">2. Vinnslusamningur ({DPA_VERSION})</h2>
            <p className="mb-2 text-xs text-hc-ink-3">Hvernig Lifeline vinnur með persónuupplýsingar starfsfólksins.</p>
            <pre className={pane}>{renderDataProcessingAgreement()}</pre>
            <label className="mt-3 flex min-h-11 cursor-pointer select-none items-start gap-3">
              <input
                type="checkbox"
                checked={dpaChecked}
                onChange={(e) => setDpaChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-hc-brand-dark"
              />
              <span className="text-sm text-hc-ink">
                Ég staðfesti heimild mína til að skuldbinda fyrirtækið og samþykki vinnslusamninginn ({DPA_VERSION}).
              </span>
            </label>
          </div>

          <p className="text-xs leading-relaxed text-hc-ink-3">
            Tímastimpill, IP-tala og vafraauðkenni eru skráð sem hluti af samþykkinu.{" "}
            <Link href="/terms" className={authLink}>Skoða skilmálana á vefnum</Link>
          </p>

          {errorBox}

          <button
            type="button"
            onClick={() => void handleAgreement()}
            disabled={!tosChecked || !dpaChecked || submitting}
            aria-busy={submitting}
            className={authPrimary}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {submitting ? "Skrái samþykki…" : "Samþykkja bæði og halda áfram"}
          </button>
        </section>
      )}

      {step === "company" && (
        <section className="mt-2">
          <h1 className="text-2xl font-bold text-hc-ink">Fyrirtækið</h1>
          <p className="mt-1 text-sm text-hc-ink-2">
            Við stofnum svæði fyrir fyrirtækið. Á næsta skjá geturðu bætt starfsfólki við.
          </p>
          <form onSubmit={handleCreateCompany} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className={authLabel}>Nafn fyrirtækis</span>
              <input
                type="text" required autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={authInput}
              />
            </label>
            <label className="block">
              <span className={authLabel}>Kennitala fyrirtækis</span>
              <input
                type="text" required inputMode="numeric"
                value={companyKennitala}
                onChange={(e) => setCompanyKennitala(e.target.value)}
                onBlur={() => setCompanyKennitala((v) => formatKennitala(v))}
                placeholder="000000-0000"
                className={authInput}
              />
              <span className="mt-1 block text-xs text-hc-ink-3">10 tölustafir</span>
            </label>

            <div className="border-t border-hc-hairline pt-4">
              <p className="text-sm font-semibold text-hc-ink">Um þig sem tengilið</p>
              <p className="mt-0.5 text-xs leading-relaxed text-hc-ink-3">
                Staðfestir hver skuldbindur fyrirtækið. Kennitalan þín er geymd dulkóðuð.
              </p>
            </div>
            <label className="block">
              <span className={authLabel}>Kennitalan þín</span>
              <input
                type="text" required inputMode="numeric"
                value={contactKennitala}
                onChange={(e) => setContactKennitala(e.target.value)}
                onBlur={() => setContactKennitala((v) => formatKennitala(v))}
                placeholder="000000-0000"
                className={authInput}
              />
              <span className="mt-1 block text-xs text-hc-ink-3">10 tölustafir</span>
            </label>
            <label className="block">
              <span className={authLabel}>Símanúmer</span>
              <input
                type="tel" required autoComplete="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="000 0000"
                className={authInput}
              />
            </label>
            <label className="block">
              <span className={authLabel}>Starfsheiti hjá fyrirtækinu</span>
              <input
                type="text" required autoComplete="organization-title"
                value={contactPosition}
                onChange={(e) => setContactPosition(e.target.value)}
                placeholder="t.d. mannauðsstjóri, framkvæmdastjóri"
                className={authInput}
              />
            </label>

            {errorBox}

            <button type="submit" disabled={submitting} aria-busy={submitting} className={authPrimary}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {submitting ? "Skrái fyrirtækið…" : "Skrá fyrirtækið"}
            </button>
          </form>
        </section>
      )}
    </AuthShell>
  );
}

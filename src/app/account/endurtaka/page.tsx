"use client";

/*
 * "Byrja upp á nýtt" — rewind onboarding and walk it again.
 *
 * Built to be bookmarked on a phone. Changing anything in the onboarding
 * flow used to mean registering another address to see the change, which is
 * a confirmation email, a mailbox round trip and a new password per pass —
 * and eighteen madsinski+… accounts in the database as evidence.
 *
 * One tap puts the signed-in account back to the moment after signup and
 * sends it into the welcome deck. The account, the password and the inbox
 * stay as they are.
 *
 * Deliberately a page rather than a link that acts on load: a URL that
 * wipes state when something merely fetches it is a URL that gets wiped by
 * a link preview.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RotateCcw, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getMyStaffRole } from "@/lib/staff-role";
import { Alert, Button, accountCard, accountInset } from "@/app/components/account/ui";

export default function ReplayOnboardingPage() {
  const { t, tv } = useI18n();
  const router = useRouter();
  const [who, setWho] = useState<string | null | undefined>(undefined);
  /* Who may use it. The API refuses everyone but active staff and
     plus-alias test addresses (it deletes consent rows); the page says so
     up front rather than offering a button that a real client could press
     and only then be told no. */
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ consents: number } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email ?? null;
      setWho(email);
      if (!email) { setAllowed(false); return; }
      const role = await getMyStaffRole(email).catch(() => null);
      setAllowed(!!role || email.includes("+"));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const reset = useCallback(async () => {
    setBusy(true); setErr("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const r = await fetch("/api/account/reset-onboarding", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setErr(j.error || t("acct.replay.failed", "Tókst ekki að núllstilla.")); return; }
    setDone({ consents: j.consentsDeleted ?? 0 });
  }, [t]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-white px-5 py-10">
      <div className={`${accountCard} p-6`}>
        <h1 className="text-lg font-bold text-hc-ink">{t("acct.replay.start", "Byrja upp á nýtt")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
          {t("acct.replay.what", "Setur aðganginn aftur í sama horf og rétt eftir nýskráningu, svo hægt sé að fara aftur í gegnum kynninguna og skilmálana. Aðgangurinn, lykilorðið og netfangið haldast óbreytt.")}
        </p>

        {(who === undefined || (who && allowed === null)) && <p className="mt-4 text-sm text-hc-ink-3">{t("acct.loading", "Hleð…")}</p>}
        {who === null && (
          <Alert tone="warn" compact className="mt-4">
            {t("acct.replay.signin", "Þú þarft að vera skráð/ur inn.")} <a href="/account/login" className="font-semibold underline">{t("acct.signin", "Skrá inn")}</a>
          </Alert>
        )}
        {who && allowed === false && (
          <Alert tone="info" compact className="mt-4">
            {t("acct.replay.staffonly", "Þessi síða er aðeins fyrir starfsfólk og prófunaraðganga (netfang með +).")}{" "}
            <a href="/account" className="font-semibold underline">{t("acct.replay.back", "Aftur á Mínar síður")}</a>
          </Alert>
        )}

        {who && allowed && !done && (
          <>
            <p className={`${accountInset} mt-4 px-3 py-2 text-sm text-hc-ink-2`}>{who}</p>
            {/* What it clears, before it clears it — a reset that lists its
                own scope afterwards is a reset you have to undo to read. */}
            <ul className="mt-3 space-y-1 text-sm text-hc-ink-2">
              <li>{t("acct.q.introagain", "· Kynningin birtist aftur")}</li>
              <li>{t("acct.replay.b1", "· Skilmálar þarf að samþykkja á ný")}</li>
              <li>{t("acct.replay.b2", "· Samþykki fyrir heilsufarsupplýsingum núllstillist")}</li>
            </ul>
            <Button variant="danger" className="mt-5 w-full" onClick={() => void reset()} busy={busy} icon={<RotateCcw className="h-4 w-4" aria-hidden />}>
              {t("acct.replay.button", "Núllstilla og byrja aftur")}
            </Button>
            {err && <Alert tone="bad" compact className="mt-3">{err}</Alert>}
          </>
        )}

        {done && (
          <>
            <Alert tone="ok" compact className="mt-4">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 shrink-0" aria-hidden />
              {done.consents ? tv("acct.replay.resetn", "Núllstillt · {{n}} samþykki fjarlægð.", { n: done.consents }) : t("acct.replay.reset", "Núllstillt.")}</span>
            </Alert>
            <Button className="mt-4 w-full" onClick={() => router.push("/account/welcome")}>
              {t("acct.replay.gotointro", "Fara í kynninguna")}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

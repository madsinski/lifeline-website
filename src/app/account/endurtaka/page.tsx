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
import { RotateCcw, Check, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ReplayOnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [who, setWho] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ consents: number } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setWho(data.session?.user?.email ?? null);
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-lg font-bold text-[#0F172A]">{t("acct.replay.start", "Byrja upp á nýtt")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          Setur aðganginn aftur í sama horf og rétt eftir nýskráningu, svo hægt sé að fara aftur
          í gegnum kynninguna og skilmálana. Aðgangurinn, lykilorðið og netfangið haldast óbreytt.
        </p>

        {who === undefined && <p className="mt-4 text-sm text-gray-500">{t("acct.loading", "Hleð…")}</p>}
        {who === null && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t("acct.replay.signin", "Þú þarft að vera skráð/ur inn.")} <a href="/account/login" className="font-semibold underline">{t("acct.signin", "Skrá inn")}</a>
          </p>
        )}

        {who && !done && (
          <>
            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{who}</p>
            {/* What it clears, before it clears it — a reset that lists its
                own scope afterwards is a reset you have to undo to read. */}
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              <li>· Kynningin birtist aftur</li>
              <li>· Skilmálar þarf að samþykkja á ný</li>
              <li>· Samþykki fyrir heilsufarsupplýsingum núllstillist</li>
            </ul>
            <button
              type="button"
              onClick={() => void reset()}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#10B981] py-2.5 font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
              Núllstilla og byrja aftur
            </button>
            {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
          </>
        )}

        {done && (
          <>
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Núllstillt{done.consents ? ` · ${done.consents} samþykki fjarlægð` : ""}.
            </p>
            <button
              type="button"
              onClick={() => router.push("/account/welcome")}
              className="mt-4 w-full rounded-lg bg-[#10B981] py-2.5 font-semibold text-white hover:bg-[#047857]"
            >
              {t("acct.replay.gotointro", "Fara í kynninguna")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

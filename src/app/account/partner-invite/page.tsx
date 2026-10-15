"use client";

// Where an ábyrgðarfélagi invitation lands.
//
// Two jobs: say who is asking and what they will see, and get the answer.
// The second one is the reason this is a page rather than a link straight
// into settings — somebody arriving from an email has not agreed to
// anything yet, and the honest version of this screen makes declining as
// easy as accepting.
//
// Not logged in: say what the invitation is first, then ask them to sign in.
// Sending somebody to a login form before telling them what it is for is
// how invitations get deleted.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Handshake, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

type State =
  | { k: "loading" }
  | { k: "invalid" }
  | { k: "ready"; inviter: string | null; authed: boolean }
  | { k: "done"; inviter: string | null }
  | { k: "declined" };

export default function PartnerInvitePage() {
  const { t, tv } = useI18n();
  /* From the URL, once. It cannot change without a navigation, so there is
     nothing for an effect to do here. */
  const [token] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("t"));
  const [s, setS] = useState<State>({ k: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setTimeout(() => setS({ k: "invalid" }), 0); return; }
    const [r, sess] = await Promise.all([
      fetch(`/api/hc/partner/accept?t=${encodeURIComponent(token)}`).then((x) => x.json()).catch(() => null),
      supabase.auth.getSession(),
    ]);
    /* Off the effect's own tick — the awaits above resolve inside the
       effect that started them. */
    setTimeout(() => {
      if (!r?.ok) { setS({ k: "invalid" }); return; }
      setS({ k: "ready", inviter: r.inviter ?? null, authed: !!sess.data.session });
    }, 0);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const answer = async (decline: boolean) => {
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const at = data.session?.access_token;
    const r = await fetch("/api/hc/partner/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(at ? { Authorization: `Bearer ${at}` } : {}) },
      body: JSON.stringify({ token, decline }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setS({ k: "invalid" }); return; }
    setS(decline ? { k: "declined" } : { k: "done", inviter: j.inviter ?? null });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50">
          <Handshake className="h-6 w-6 text-emerald-700" aria-hidden />
        </span>

        {s.k === "loading" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("acct.partner.loading", "Hleð boðinu…")}
          </p>
        )}

        {s.k === "invalid" && (
          <>
            <h1 className="mt-4 text-xl font-bold text-slate-900">{t("acct.partner.invalid", "Boðið er ekki í gildi")}</h1>
            <p className="mt-1.5 text-sm text-slate-600">
              {t("acct.partner.expired", "Hlekkurinn er útrunninn eða þegar notaður. Biddu um nýtt boð.")}
            </p>
          </>
        )}

        {s.k === "ready" && (
          <>
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {s.inviter ? tv("acct.partner.askedyou", "{{name}} bað þig um að vera félagi", { name: s.inviter }) : t("acct.partner.invited", "Þú fékkst boð um að vera félagi")}
            </h1>
            {/* What they are agreeing to, before they agree. The whole point
                of the feature is that it is one number and nothing else, so
                that is what the screen says. */}
            <p className="mt-2 text-sm text-slate-600">
              {t("acct.partner.yousee", t("acct.partner.yousee", "Þú sérð eitt: hversu marga af síðustu 14 dögum hann gerði eitthvað. Ekki hvað hann gerði, engar mælingar og engar skýrslur. Þú getur hætt hvenær sem er."))}
            </p>
            {s.authed ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void answer(false)}
                  className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {t("acct.partner.yes", "Já, ég er til")}
                </button>
                <button type="button" disabled={busy} onClick={() => void answer(true)}
                  className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50">
                  {t("acct.q.nothanks", "Nei, takk")}
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <p className="text-sm text-slate-600">{t("acct.partner.signinto", "Skráðu þig inn til að svara boðinu.")}</p>
                <Link href={`/account/login?next=${encodeURIComponent(`/account/partner-invite?t=${token ?? ""}`)}`}
                  className="mt-2 inline-block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
                  {t("acct.partner.signin", "Skrá mig inn")}
                </Link>
              </div>
            )}
          </>
        )}

        {s.k === "done" && (
          <>
            <h1 className="mt-4 text-xl font-bold text-slate-900">{t("acct.partner.connected", "Þá eruð þið tengd")}</h1>
            <p className="mt-1.5 text-sm text-slate-600">
              {s.inviter ? tv("acct.partner.cannow", "{{name}} getur nú valið þig sem félaga.", { name: s.inviter }) : t("acct.partner.answered", "Boðinu er svarað.")}
              {" "}Þú getur gert það sama úr þínum stillingum.
            </p>
            <Link href="/app/adgangur"
              className="mt-5 inline-block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
              {t("acct.partner.tosettings", "Í stillingar")}
            </Link>
          </>
        )}

        {s.k === "declined" && (
          <>
            <h1 className="mt-4 text-xl font-bold text-slate-900">{t("acct.partner.declined", "Boðinu er hafnað")}</h1>
            <p className="mt-1.5 text-sm text-slate-600">{t("acct.partner.noreminders", "Við sendum engar frekari áminningar um þetta.")}</p>
          </>
        )}
      </div>
    </main>
  );
}

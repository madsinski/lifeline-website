"use client";

// The eight-question health questionnaire.
//
// Each answer saves on tap rather than at the end: the app's own flow lets
// someone stop halfway, and losing six answers because the seventh was never
// reached is the kind of thing that stops people finishing at all.
//
// The stored value is always the English option string, because the app
// writes and reads those. Icelandic is a rendering.

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT } from "./../useT";
import { useI18n } from "@/lib/i18n";
import { appBrand, appCard, appHeaderBar, greenHeader } from "./../ui";

interface Q { key: string; question: string; options: readonly string[]; is: { q: string; o: string[] } | null }

export default function Quiz() {
  const api = useApi();
  const t = useT();
  const { locale } = useI18n();
  const isIs = locale !== "en";
  const [qs, setQs] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/app/questionnaire");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => { setQs(j?.questions ?? []); setAnswers(j?.answers ?? {}); }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const answer = async (q: Q, optionEn: string) => {
    if (busy) return;
    setBusy(q.key); setErr(null);
    const prev = answers[q.key];
    setAnswers((a) => ({ ...a, [q.key]: optionEn }));
    const r = await api("/api/app/questionnaire", {
      method: "POST", body: JSON.stringify({ key: q.key, answer: optionEn }),
    });
    if (!r.ok) {
      setErr(t("qz.saveFailed"));
      setAnswers((a) => ({ ...a, [q.key]: prev })); // put it back
    }
    setBusy(null);
  };

  if (!qs) return <div className="h-40 animate-pulse rounded-[14px] bg-white" aria-hidden />;
  const done = qs.filter((q) => answers[q.key]).length;

  return (
    <div className="space-y-3">
      <div className={appHeaderBar} style={greenHeader}>
        <Check className="h-[18px] w-[18px]" aria-hidden />
        <span className="flex-1 text-[15px] font-bold">{done} / {qs.length} {t("qz.progress")}</span>
      </div>

      <p className="px-1 text-xs" style={{ color: appBrand.ink2 }}>{t("qz.intro")}</p>
      {err && (
        <p className={`${appCard} border-l-[3px] px-4 py-3 text-sm`} role="alert"
          style={{ borderLeftColor: appBrand.error, color: appBrand.ink2 }}>{err}</p>
      )}

      {qs.map((q) => {
        const labels = isIs && q.is ? q.is.o : q.options;
        return (
          <section key={q.key} className={`${appCard} p-4`}>
            <p className="text-sm font-bold" style={{ color: appBrand.ink1 }}>
              {isIs && q.is ? q.is.q : q.question}
            </p>
            <div className="mt-2 space-y-1.5">
              {q.options.map((optEn, i) => {
                const on = answers[q.key] === optEn;
                return (
                  <button key={optEn} type="button" disabled={busy === q.key}
                    onClick={() => void answer(q, optEn)}
                    className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-60"
                    style={on
                      ? { borderColor: appBrand.primary, background: `${appBrand.primary}10`, color: appBrand.ink1 }
                      : { borderColor: appBrand.hairline, color: appBrand.ink2 }}>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2"
                      style={{ borderColor: on ? appBrand.primary : appBrand.ink4, background: on ? appBrand.primary : "transparent" }}>
                      {on && <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />}
                    </span>
                    {labels[i] ?? optEn}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {done === qs.length && (
        <p className={`${appCard} p-4 text-center text-sm font-semibold`} style={{ color: appBrand.primaryDark }}>
          {t("qz.done")}
        </p>
      )}
    </div>
  );
}

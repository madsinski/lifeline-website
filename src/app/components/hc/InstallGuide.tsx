"use client";

// How to put Lifeline on your home screen or desktop, and why it matters.
//
// Notifications are the reason this exists. On iPhone, iOS allows web push
// only for an installed app — Safari will not even offer the permission
// otherwise. On Android and desktop Chrome push works in the tab, but an
// installed window still gets notifications when the browser is closed,
// which is the difference between a reminder and a reminder you saw.
//
// The steps differ per browser and there is no reliable way to detect the
// browser for certain, so the right one is guessed, shown first, and the
// others stay one tap away rather than being hidden behind a guess.

import { useState } from "react";
import { ChevronDown, Share, MonitorDown, MoreVertical, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Segmented from "./Segmented";

type Platform = "ios" | "android" | "desktop";

const STEPS = (t: (k: string, f?: string) => string): Record<string, { label: string; Icon: typeof Share; steps: string[]; note?: string }> => (
  {
  ios: {
    label: t("comp.inst.ios", "iPhone eða iPad"),
    Icon: Share,
    steps: [
      t("comp.inst.ios1", "Opnaðu lifelinehealth.is í Safari (ekki Chrome — á iPhone er það Safari sem setur upp appið)."),
      t("comp.inst.ios2", "Ýttu á Deila-táknið í tækjastikunni (kassi með ör upp úr)."),
      t("comp.inst.ios3", "Skrunaðu niður og veldu „Bæta á heimaskjá“."),
      t("comp.inst.ios4", "Ýttu á „Bæta við“ og opnaðu Lifeline af heimaskjánum."),
      t("comp.inst.desk3", "Farðu í Stillingar → Áminningar og veldu „Tilkynning í símanum“."),
    ],
    note: t("comp.inst.ioswhy", "Á iPhone leyfir Apple tilkynningar aðeins í uppsettu appi. Safari spyr ekki um leyfi fyrr en þú opnar Lifeline af heimaskjánum."),
  },
  android: {
    label: "Android",
    Icon: MoreVertical,
    steps: [
      t("comp.inst.and1", "Opnaðu lifelinehealth.is í Chrome."),
      t("comp.inst.and2", "Ýttu á þrjá punkta uppi í hægra horninu."),
      t("comp.inst.and3", "Veldu „Setja upp app“ eða „Bæta á heimaskjá“."),
      t("comp.inst.and4", "Opnaðu Lifeline af heimaskjánum."),
      t("comp.inst.desk3", "Farðu í Stillingar → Áminningar og veldu „Tilkynning í símanum“."),
    ],
  },
  desktop: {
    label: t("comp.inst.desktop", "Tölva (Chrome eða Edge)"),
    Icon: MonitorDown,
    steps: [
      t("comp.inst.desk1", "Ýttu á uppsetningartáknið hægra megin í veffangastikunni — skjár með ör niður."),
      t("comp.inst.andalt", "Sést það ekki? Þrír punktar → „Varpa, vista og deila“ → „Setja upp síðu sem app“."),
      t("comp.inst.desk2", "Veldu „Setja upp“. Lifeline opnast í sínum eigin glugga."),
      t("comp.inst.desk3", "Farðu í Stillingar → Áminningar og veldu „Tilkynning í símanum“."),
    ],
    note: t("comp.inst.why", "Uppsett app fær tilkynningar þótt vafrinn sé lokaður."),
  },
}
);


/**
 * What the screen looks like at the step that matters.
 *
 * The instructions are accurate but they are words about an interface, and
 * the one place people get stuck is recognising the row to tap — it is
 * halfway down a sheet of a dozen similar rows with an icon they have never
 * looked at closely. So this draws it: the sheet, some neighbours greyed
 * out, and the row you want picked out in brand colour with its real label.
 *
 * Drawn rather than screenshotted. A screenshot of iOS would be a copy of
 * Apple's interface that goes stale every September and has to be retaken on
 * a device we do not have in CI; a sketch stays true as long as the row is
 * still called "Bæta á heimaskjá", and it says plainly that it is a sketch.
 */
function Sketch({ platform }: { platform: Platform }) {
  const { t } = useI18n();
  const rows: Record<Platform, { before: string[]; target: string; icon: string; after: string[]; chrome: "share" | "menu" | "bar" }> = {
    ios: {
      chrome: "share",
      before: ["Afrita", t("comp.inst.addreading", "Bæta í leslista"), t("comp.inst.addbookmark", "Bæta við bókamerki")],
      target: t("comp.inst.addhome", "Bæta á heimaskjá"),
      icon: "＋",
      after: [t("comp.inst.copylink", "Afrita slóð")],
    },
    android: {
      chrome: "menu",
      before: [t("comp.inst.newtab", "Ný flipi"), t("comp.inst.bookmarks", "Bókamerki"), t("comp.inst.downloads", "Niðurhal")],
      target: "Setja upp app",
      icon: "⤓",
      after: [t("acct.q.settings", "Stillingar")],
    },
    desktop: {
      chrome: "bar",
      before: [],
      target: "Setja upp Lifeline",
      icon: "⤓",
      after: [],
    },
  };
  const r = rows[platform];

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-hc-card border border-hc-hairline bg-hc-sunken-2 p-3">
        {/* The bit of browser chrome you press first. */}
        <div className="mb-2 flex items-center gap-2 rounded-hc-element bg-hc-surface px-2.5 py-2 shadow-hc-card">
          <span className="truncate text-[11px] text-hc-ink-3">lifelinehealth.is</span>
          <span className="flex-1" />
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold ${
            r.chrome === "bar" ? "bg-hc-brand-dark text-white ring-2 ring-hc-brand-dark/30" : "bg-hc-sunken-2 text-hc-ink-2"}`} aria-hidden>
            {r.chrome === "share" ? "⇪" : r.chrome === "menu" ? "⋮" : "⤓"}
          </span>
        </div>

        {/* The sheet or menu it opens, with the row to tap. */}
        {r.chrome !== "bar" && (
          <div className="rounded-hc-element bg-hc-surface p-1.5 shadow-hc-card">
            {r.before.map((x) => (
              <div key={x} className="flex items-center justify-between px-2 py-1.5 text-[11px] text-hc-ink-3">
                <span>{x}</span><span aria-hidden>▢</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-hc-brand-surface px-2 py-2 ring-1 ring-hc-brand-dark/40">
              <span className="text-[11px] font-bold text-hc-brand-text">{r.target}</span>
              <span className="grid h-5 w-5 place-items-center rounded bg-hc-brand-dark text-[11px] font-bold text-white" aria-hidden>{r.icon}</span>
            </div>
            {r.after.map((x) => (
              <div key={x} className="flex items-center justify-between px-2 py-1.5 text-[11px] text-hc-ink-3">
                <span>{x}</span><span aria-hidden>▢</span>
              </div>
            ))}
          </div>
        )}
        {r.chrome === "bar" && (
          <p className="rounded-hc-element bg-hc-surface px-2.5 py-2 text-[11px] font-bold text-hc-brand-text shadow-hc-card">{r.target}</p>
        )}
      </div>
      <figcaption className="mt-1.5 text-[11px] text-hc-ink-3">
        {t("comp.inst.simplified", "Einfölduð mynd — hnappurinn getur heitið örlítið annað eftir útgáfu.")}
      </figcaption>
    </figure>
  );
}

/** Best guess from the user agent, with the others a tap away. */
function guess(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export default function InstallGuide({ bare = false, defaultOpen = false }: {
  /** Drop the card shell, for use inside another card. */
  bare?: boolean;
  /** Start expanded, where this is the point of the step rather than an aside. */
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [pick, setPick] = useState<Platform>(guess);
  const installed = typeof window !== "undefined"
    && (window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true);

  const cur = STEPS(t)[pick];

  return (
    <section className={bare
      ? "overflow-hidden rounded-hc-card ring-1 ring-hc-hairline print:hidden"
      : "rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-hc-hairline print:hidden"}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left">
        <span className={`flex h-10 w-10 items-center justify-center rounded-hc-element ${installed ? "bg-hc-brand-surface text-hc-brand-text" : "bg-hc-sunken-2 text-hc-ink-2"}`}>
          {installed ? <Check className="h-5 w-5" aria-hidden /> : <MonitorDown className="h-5 w-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hc-ink">{t("acct.q.lifelineasapp", "Lifeline sem app")}</span>
          <span className="block text-sm text-hc-ink-2">
            {installed
              ? t("comp.inst.installed", "Uppsett á þessu tæki — tilkynningar virka.")
              : t("comp.inst.title", "Settu Lifeline á heimaskjáinn til að fá tilkynningar")}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-hc-ink-3 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-hc-hairline p-4">
          {installed && (
            <p className="rounded-hc-element bg-hc-brand-surface px-3 py-2 text-sm font-medium text-hc-brand-text">
              {t("comp.inst.already", "Þetta tæki er þegar með Lifeline uppsett. Leiðbeiningarnar hér fyrir neðan eru fyrir næsta tæki.")}
            </p>
          )}

          {/* The guess is only a guess, so all three are selectable. */}
          <Segmented<Platform> label={t("comp.inst.device", "Tækið þitt")} size="sm"
            value={pick} onChange={setPick}
            options={(Object.keys(STEPS(t)) as Platform[]).map((k) => ({ value: k, label: STEPS(t)[k].label }))} />

          {/* The picture before the words: the one place people get stuck
              is recognising the row to tap. */}
          <Sketch platform={pick} />
          <ol className="space-y-2">
            {cur.steps.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-hc-ink">
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-hc-sunken-2 text-[11px] font-bold text-hc-ink-2">
                  {i + 1}
                </span>
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ol>

          {cur.note && (
            <p className="rounded-hc-element bg-hc-warn-surface px-3 py-2 text-xs text-hc-warn-ink">{cur.note}</p>
          )}
        </div>
      )}
    </section>
  );
}

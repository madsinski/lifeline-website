"use client";

// The client's own action plan, as the coach sees it.
//
// This renders MyActions — the participant's component, unchanged — so the
// coach is looking at the same screen the client is, with the same
// hold-to-drag reordering. Building a second plan view for staff is how the
// two drift: the coach's PlanBuilder uses HTML5 drag, which never worked on
// a tablet, and it has been showing a different shape of the same plan.
//
// The trick that makes the reuse free is `coachApi`: MyActions posts to
// /api/hc/actions, which by design only ever means "my own journey". The
// wrapper rewrites that one path to the workstation's as-client route for
// this journey. The component does not know, which is the point — there is
// no staff branch inside it to get wrong.

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldQuestion } from "lucide-react";
import MyActions from "./MyActions";
import EmptyState from "./EmptyState";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";
import type { ActionPlan } from "@/lib/hc/types";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** What the coach may know about the client's consent — dates and flags. */
export interface ConsentState {
  has_report: boolean;
  on_behalf?: boolean;
  imported_at?: string;
  client_confirmed_at?: string | null;
  confirmation_requested_at?: string | null;
  visible_to_client?: boolean;
  on_behalf_consent_at?: string | null;
}

interface Bundle {
  journey_id: string;
  plan: ActionPlan | null;
  logs: ActionLog[];
  prefs: ActionPref[];
  consent: ConsentState;
}

const day = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("is-IS", { day: "numeric", month: "long" }) : "";

/**
 * Where the client stands on their report, in one line.
 *
 * Staff read the report under Art. 9(2)(h) — care — and that is not gated on
 * the client agreeing to anything. What the client's confirmation governs is
 * their OWN copy: a report staff entered is held off their screens until
 * they confirm it came from where it says. So this banner exists to stop a
 * coach referring to results the client cannot actually see yet, which is
 * the real failure mode. Posture v1.15.
 */
export function ConsentBanner({ consent }: { consent: ConsentState }) {
  if (!consent.has_report) return null;

  // The client's own upload needs nobody's confirmation.
  if (!consent.on_behalf) {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Skýrslan er þeirra eigin — þau sjá hana í appinu.</span>
      </p>
    );
  }

  if (consent.visible_to_client) {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Staðfest af skjólstæðingi {day(consent.client_confirmed_at)} — þau sjá skýrsluna í appinu.
        </span>
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Skjólstæðingur hefur ekki staðfest skýrsluna sem var skráð fyrir þau
        {consent.imported_at ? ` ${day(consent.imported_at)}` : ""}.
        {" "}Þú getur notað hana í viðtalinu, en <strong>þau sjá hana ekki sjálf</strong> fyrr en þau staðfesta hana.
      </span>
    </p>
  );
}

export default function CoachAsClient({ api, journeyId }: { api: Api; journeyId: string }) {
  const [d, setD] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const path = `/api/vinnustod/journeys/${journeyId}/as-client`;

  const load = useCallback(async () => {
    const r = await api(path).catch(() => null);
    const body = r?.ok ? await r.json().catch(() => null) : null;
    /* Deferred out of the effect's own tick, the way Caseload does it — the
       React Compiler lint rejects a setState reached synchronously from an
       effect, and this is the shape the rest of these screens use. */
    setTimeout(() => {
      if (!r?.ok || !body) { setErr(r?.status === 403 ? "forbidden" : "failed"); return; }
      setD(body);
    }, 0);
  }, [api, path]);

  useEffect(() => { void load(); }, [load]);

  /*
   * MyActions' own fetches, pointed at this journey.
   *
   * Only /api/hc/actions is rewritten, because that is the one this view's
   * component writes to. Anything else it asks for — the meal library, say —
   * is the same for everybody and can go straight through. A rewrite that
   * tried to be clever about every /api/hc/* path would silently send a
   * coach's own plan reads to a client's journey.
   */
  const coachApi = useCallback<Api>((url, init) => (
    url.startsWith("/api/hc/actions") ? api(path, init) : api(url, init)
  ), [api, path]);

  if (err === "forbidden") {
    return <EmptyState variant="empty" title="Ekki í þínum umdæmum"
      body="Þessi heilsuferð er á starfsstöð sem þú hefur ekki aðgang að." />;
  }
  if (err) {
    return <EmptyState variant="empty" title="Gat ekki opnað áætlunina"
      body="Reyndu aftur. Ef þetta heldur áfram, hafðu samband við tækniþjónustu." />;
  }
  if (!d) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Hleð áætluninni…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ConsentBanner consent={d.consent} />

      {!d.plan ? (
        <EmptyState variant="waiting" title="Engin áætlun birt"
          body="Þegar áætlunin hefur verið birt sést hún hér eins og skjólstæðingurinn sér hana." />
      ) : (
        <>
          {/* Said once, plainly: what happens here lands on their screen. */}
          <p className="px-1 text-xs text-slate-500">
            Þetta er áætlunin eins og skjólstæðingurinn sér hana. Breytingar sem þú gerir hér
            birtast hjá þeim og eru skráðar á þig.
          </p>
          <MyActions api={coachApi} journeyId={d.journey_id} plan={d.plan}
            logs={d.logs} prefs={d.prefs} onLogs={(logs) => setD((p) => (p ? { ...p, logs } : p))} />
        </>
      )}
    </div>
  );
}

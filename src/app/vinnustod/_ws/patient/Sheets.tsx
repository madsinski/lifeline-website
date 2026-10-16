"use client";

// What opens over a client's workspace.
//
// The four tabs are places; these are things you do and close again —
// the interview, a referral, a message, a payment, the audit trail. All of
// them use the shared hc Sheet (portal, scroll lock, Escape, drag to
// dismiss, aria-modal) instead of the hand-rolled overlay this page had.

import { useState } from "react";
import { Stethoscope } from "lucide-react";
import Sheet from "@/app/components/hc/Sheet";
import Referrals from "@/app/components/hc/Referrals";
import { Alert } from "@/app/components/account/ui";
import type { WsApi } from "@/app/components/hc/ws-api";
import { dayTime, wsBtn } from "../format";
import type { Detail, Record_, SheetKey } from "../tasks";
import { InterviewSheet, interviewSheetTitle } from "./Interview";
import { Messages } from "./Messages";
import { History, Orders } from "./steps";

export function PatientSheet({ sheet, d, api, isDoctor, record, reload, onClose, onPlan }: {
  sheet: SheetKey | null | undefined;
  d: Detail; api: WsApi; isDoctor: boolean;
  record: Record_; reload: () => Promise<void>;
  onClose: () => void;
  /** Leave the interview for the plan tab. */
  onPlan: () => void;
}) {
  if (!sheet) return null;
  const j = d.journey;
  const body = (children: React.ReactNode) => <div className="px-4 pb-6 sm:px-5">{children}</div>;

  switch (sheet) {
    case "interview":
      return (
        <Sheet title={interviewSheetTitle(j)} onClose={onClose} max="max-w-4xl" draggable={false}>
          {body(<InterviewSheet d={d} isDoctor={isDoctor} record={record} onPlan={onPlan} onChanged={() => void reload()} />)}
        </Sheet>
      );
    case "referral":
      return (
        <Sheet title="Læknismat og samstarfsaðilar" onClose={onClose} max="max-w-2xl">
          {body(
            <div className="space-y-4">
              <DoctorReview d={d} isDoctor={isDoctor} record={record} />
              <Referrals api={api} journeyId={j.id} referrals={d.referrals ?? []}
                suggestions={d.ai_referrals ?? []} isDoctor={isDoctor} onChanged={() => void reload()} />
            </div>,
          )}
        </Sheet>
      );
    case "messages":
      return (
        <Sheet title="SMS og tölvupóstur" onClose={onClose} max="max-w-3xl">
          {body(<Messages d={d} reload={reload} onClose={onClose} />)}
        </Sheet>
      );
    case "orders":
      return (
        <Sheet title="Greiðslur og kóðar" onClose={onClose}>
          {body(<Orders d={d} record={record} />)}
        </Sheet>
      );
    case "history":
      return (
        <Sheet title="Saga" onClose={onClose}>
          {body(<History audit={d.audit} />)}
        </Sheet>
      );
  }
}

/*
 * A nurse's "biðja um mat læknis", and the doctor's answer.
 *
 * The doctor's queue has said "Beiðni um mat læknis" since the request
 * existed, but nothing in the workstation showed the request's note or let
 * a doctor record that it had been looked at — the task could be seen and
 * never cleared. It sits at the top of the referral sheet because a review
 * usually ends in a referral or in nothing, and both are decided here.
 */
function DoctorReview({ d, isDoctor, record }: { d: Detail; isDoctor: boolean; record: Record_ }) {
  const j = d.journey;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!j.doctor_review_requested_at) return null;
  if (j.doctor_reviewed_at) {
    return (
      <Alert tone="ok" compact title="Læknir hefur metið">
        Beiðni frá {dayTime(j.doctor_review_requested_at)} var afgreidd {dayTime(j.doctor_reviewed_at)}.
      </Alert>
    );
  }
  return (
    <Alert tone="warn" title="Beiðni um mat læknis"
      actions={isDoctor ? (
        <button type="button" disabled={busy} className={wsBtn.primary}
          onClick={async () => { setBusy(true); setErr(""); const e = await record({ action: "doctor_reviewed" }); setBusy(false); if (e) setErr(e); }}>
          <Stethoscope className="h-4 w-4" aria-hidden /> Merkja metið
        </button>
      ) : undefined}>
      <p>Send {dayTime(j.doctor_review_requested_at)}.</p>
      {j.doctor_review_note && <p className="mt-1 whitespace-pre-line">„{j.doctor_review_note}“</p>}
      {!isDoctor && <p className="mt-1">Læknir fær skeyti og afgreiðir hana hér.</p>}
      {err && <p role="alert" className="mt-1 font-semibold">{err}</p>}
    </Alert>
  );
}

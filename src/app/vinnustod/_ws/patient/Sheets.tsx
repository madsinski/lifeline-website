"use client";

// What opens over a client's workspace.
//
// The four tabs are places; these are things you do and close again —
// the Áætlunarsamtal, a Vera partner, a message, a payment, the audit trail. All of
// them use the shared hc Sheet (portal, scroll lock, Escape, drag to
// dismiss, aria-modal) instead of the hand-rolled overlay this page had.

import Sheet from "@/app/components/hc/Sheet";
import Referrals from "@/app/components/hc/Referrals";
import type { WsApi } from "@/app/components/hc/ws-api";
import { dayTime } from "../format";
import type { Detail, Record_, SheetKey } from "../tasks";
import { InterviewSheet, interviewSheetTitle } from "./Interview";
import { Messages, type MessagePreset } from "./Messages";
import { History, Orders } from "./steps";

export function PatientSheet({ sheet, d, api, isDoctor, record, reload, onClose, onPlan, messagePreset }: {
  sheet: SheetKey | null | undefined;
  d: Detail; api: WsApi; isDoctor: boolean;
  record: Record_; reload: () => Promise<void>;
  onClose: () => void;
  /** Leave the interview for the plan tab. */
  onPlan: () => void;
  /** Open the message sheet on this template rather than the default. */
  messagePreset?: MessagePreset | null;
}) {
  if (!sheet) return null;
  const j = d.journey;
  const body = (children: React.ReactNode) => <div className="px-4 pb-6 sm:px-5">{children}</div>;

  switch (sheet) {
    case "interview":
      return (
        <Sheet title={interviewSheetTitle(j)} onClose={onClose} max="max-w-4xl" draggable={false}>
          {body(<InterviewSheet d={d} record={record} onPlan={onPlan} />)}
        </Sheet>
      );
    case "referral":
      return (
        <Sheet title="Samstarfsaðilar (Vera)" onClose={onClose} max="max-w-2xl">
          {body(
            <div className="space-y-4">
              <DoctorReviewHistory d={d} />
              <Referrals api={api} journeyId={j.id} referrals={d.referrals ?? []}
                suggestions={d.ai_referrals ?? []} isDoctor={isDoctor} onChanged={() => void reload()} />
            </div>,
          )}
        </Sheet>
      );
    case "messages":
      return (
        <Sheet title="SMS og tölvupóstur" onClose={onClose} max="max-w-3xl">
          {body(<Messages d={d} reload={reload} onClose={onClose} preset={messagePreset} />)}
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
 * An old "biðja um mat læknis", read-only.
 *
 * The doctor's part of the health check — the interview and anything
 * clinical — happens in Medalia since the split (2026-10-16), so nobody
 * asks for or records a doctor's review here any more. A request made
 * before then is still part of this person's history, so it is shown,
 * without a button.
 */
function DoctorReviewHistory({ d }: { d: Detail }) {
  const j = d.journey;
  if (!j.doctor_review_requested_at) return null;
  return (
    <div className="rounded-xl bg-hc-sunken p-3 text-sm text-hc-ink-2">
      <p className="font-semibold text-hc-ink">Eldri beiðni um mat læknis</p>
      <p>
        Send {dayTime(j.doctor_review_requested_at)}
        {j.doctor_reviewed_at ? `, afgreidd ${dayTime(j.doctor_reviewed_at)}.` : ". Klínísk atriði eru nú skráð í Medalia."}
      </p>
      {j.doctor_review_note && <p className="mt-1 whitespace-pre-line">„{j.doctor_review_note}“</p>}
    </div>
  );
}

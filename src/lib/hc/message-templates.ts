// Client reminder templates for the nurse workstation + an SMS size counter.
// Client-safe: the workstation composes the text, the nurse edits it, the
// server sends exactly what was approved (/api/vinnustod/journeys/[id]).

export type MessageTemplateKey =
  | "activate" | "book_tests" | "blood_reminder" | "measure_reminder"
  | "interview_reminder" | "book_interview" | "plan_ready" | "followup_reminder" | "free";

export interface TemplateContext {
  firstName: string;
  activationCode?: string | null;
  bloodAt?: string | null;
  measurementsAt?: string | null;
  interviewAt?: string | null;
  interviewMode?: string | null;
  followupAt?: string | null;
  bloodSite?: string | null;
  measurementSite?: string | null;
  interviewSite?: string | null;
  /** Video-call link, included in the reminder when the appointment is online. */
  meetingUrl?: string | null;
  nurseName?: string | null;
}

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("is-IS", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "[tími]";

const SIGN = (c: TemplateContext) => (c.nurseName ? `\n\nKveðja,\n${c.nurseName}, Lifeline` : "\n\nKveðja,\nLifeline");

export const MESSAGE_TEMPLATES: { key: MessageTemplateKey; label: string; subject: string; body: (c: TemplateContext) => string }[] = [
  {
    key: "activate", label: "Virkja heilsufarsskoðun", subject: "Áminning: virkjaðu heilsufarsskoðunina",
    body: (c) => `Hæ ${c.firstName}. Heilsufarsskoðunin þín er greidd. Næsta skref er að virkja hana í sjúklingagáttinni${c.activationCode ? ` með kóðanum ${c.activationCode}` : ""} og bóka blóðprufu og mælingar.${SIGN(c)}`,
  },
  {
    key: "book_tests", label: "Bóka blóðprufu og mælingar", subject: "Bókaðu blóðprufu og mælingar",
    body: (c) => `Hæ ${c.firstName}. Þú getur bókað blóðprufu${c.bloodSite ? ` á ${c.bloodSite}` : ""} og mælingar${c.measurementSite ? ` hjá ${c.measurementSite}` : ""} í sjúklingagáttinni. Mundu að mæta fastandi í blóðprufuna.${SIGN(c)}`,
  },
  {
    key: "blood_reminder", label: "Áminning um blóðprufu", subject: "Áminning: blóðprufa",
    body: (c) => `Hæ ${c.firstName}. Minnum á blóðprufuna ${when(c.bloodAt)}${c.bloodSite ? ` á ${c.bloodSite}` : ""}. Mættu fastandi frá miðnætti, vatn er í lagi.${SIGN(c)}`,
  },
  {
    key: "measure_reminder", label: "Áminning um mælingar", subject: "Áminning: mælingar",
    body: (c) => `Hæ ${c.firstName}. Minnum á mælingarnar ${when(c.measurementsAt)}${c.measurementSite ? ` hjá ${c.measurementSite}` : ""}. Léttur klæðnaður, ekkert málmskart eða úr.${SIGN(c)}`,
  },
  {
    key: "book_interview", label: "Bóka viðtal", subject: "Skýrslan þín er tilbúin",
    body: (c) => `Hæ ${c.firstName}. Skýrslan þín er tilbúin og næsta skref er viðtal þar sem við förum saman yfir niðurstöðurnar og gerum áætlun. Svaraðu þessum skilaboðum eða hringdu til að finna tíma.${SIGN(c)}`,
  },
  {
    key: "interview_reminder", label: "Áminning um viðtal", subject: "Áminning: viðtal",
    body: (c) => `Hæ ${c.firstName}. Minnum á viðtalið ${when(c.interviewAt)}${c.interviewMode === "video" ? " í myndsímtali" : c.interviewSite ? ` á ${c.interviewSite}` : ""}. Við förum yfir niðurstöðurnar og gerum áætlun saman.${c.meetingUrl ? `\n\nHlekkur á fjarfundinn: ${c.meetingUrl}` : ""}${SIGN(c)}`,
  },
  {
    key: "plan_ready", label: "Áætlun tilbúin", subject: "Aðgerðaáætlunin þín er tilbúin",
    body: (c) => `Hæ ${c.firstName}. Aðgerðaáætlunin þín er komin á aðganginn þinn hjá Lifeline. Gangi þér vel og ekki hika við að hafa samband.${SIGN(c)}`,
  },
  {
    key: "followup_reminder", label: "Áminning um eftirfylgd", subject: "Áminning: eftirfylgdarviðtal",
    body: (c) => `Hæ ${c.firstName}. Minnum á eftirfylgdarviðtalið ${when(c.followupAt)}. Við förum yfir hvernig hefur gengið og uppfærum áætlunina.${c.meetingUrl ? `\n\nHlekkur á fjarfundinn: ${c.meetingUrl}` : ""}${SIGN(c)}`,
  },
  { key: "free", label: "Frjáls texti", subject: "Skilaboð frá Lifeline", body: (c) => `Hæ ${c.firstName}. ${SIGN(c).trim()}` },
];

// ── SMS size (GSM-7 vs UCS-2) — same rules as src/lib/sms.ts ────────────────

const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

export function smsSize(body: string): { encoding: "GSM-7" | "UCS-2"; chars: number; segments: number } {
  const ucs = [...body].some((c) => !GSM7.includes(c) && !GSM7_EXT.includes(c));
  if (!ucs) {
    const chars = [...body].reduce((n, c) => n + (GSM7_EXT.includes(c) ? 2 : 1), 0);
    return { encoding: "GSM-7", chars, segments: chars <= 160 ? 1 : Math.ceil(chars / 153) };
  }
  const chars = [...body].reduce((n, c) => n + ((c.codePointAt(0) ?? 0) > 0xffff ? 2 : 1), 0);
  return { encoding: "UCS-2", chars, segments: chars <= 70 ? 1 : Math.ceil(chars / 67) };
}

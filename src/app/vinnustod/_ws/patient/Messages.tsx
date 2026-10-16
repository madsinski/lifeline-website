"use client";

// Skilaboð: outbound SMS and email to the client, from templates.
//
// Not the same thing as the two-way thread on Staða (hc_chat). This reaches
// someone who has not opened the app — an activation reminder, a booking
// prompt, a nudge after a quiet week, asking leave to fetch the report
// copy — over their phone or inbox. It had no
// way in after the workspace became four tabs; it opens as a sheet now, from
// "Senda SMS/tölvupóst" beside the thread and from the queue's "Senda hvatningu".

import { useMemo, useState } from "react";
import { Check, Mail, Phone } from "lucide-react";
import { accountInput, Alert, useDialog } from "@/app/components/account/ui";
import { useWsApi } from "@/app/components/hc/ws-api";
import { MESSAGE_TEMPLATES, smsSize, type MessageTemplateKey } from "@/lib/hc/message-templates";
import { cleanName, daysSince, dayTime, wsBtn } from "../format";
import { reportOnFile, type Detail, type Journey } from "../tasks";

const isFutureIso = (iso: string) => new Date(iso).getTime() > Date.now();

/*
 * Templates that belong to the workstation rather than the shared list.
 *
 * "May we fetch your report?" exists because of the Medalia split: the
 * report copy here is the client's, so staff only import it once the client
 * has said yes in the app — or the client puts it in themselves.
 */
export type MessagePreset = "import_consent";
type Tpl = MessageTemplateKey | MessagePreset;
const SIGN = (name: string | null) => (name ? `\n\nKveðja,\n${name}, Lifeline` : "\n\nKveðja,\nLifeline");
const LOCAL_TEMPLATES: { key: MessagePreset; label: string; subject: string; body: (c: { firstName: string; nurseName: string | null }) => string }[] = [
  {
    key: "import_consent", label: "Leyfi til að sækja skýrslu", subject: "Afrit af heilsufarsskýrslunni þinni",
    body: (c) => `Hæ ${c.firstName}. Til að undirbúa áætlunarsamtalið viljum við hafa afrit af heilsufarsskýrslunni þinni hjá Lifeline. Þú getur leyft okkur að sækja hana í appinu eða sett hana inn sjálf(ur). Frumritið er áfram í sjúklingagáttinni.${SIGN(c.nurseName)}`,
  },
];

/** The template that fits where the journey is. */
function defaultTemplate(j: Journey): Tpl {
  if (j.plan_published_at) {
    if (j.followup_booked_for && !j.followup_done_at) return "followup_reminder";
    // A week or more into a published plan with no follow-up booked is
    // the queue's "Senda hvatningu" — open on the nudge it promised.
    return daysSince(j.plan_published_at) >= 7 ? "plan_nudge" : "plan_ready";
  }
  if (j.interview_done_at) return "free";
  if (j.interview_booked_for) return "interview_reminder";
  const report = reportOnFile(j);
  if (j.paid_at && !j.protocol_activated_at && !report) return "activate";
  if (!report && !j.doctor_interview_done_at) {
    if (j.measurements_booked_for && !j.measurements_done_at && isFutureIso(j.measurements_booked_for)) return "measure_reminder";
    if (!j.staff_import_consent_at) return "import_consent";
    return "free";
  }
  return "book_interview";
}

export function Messages({ d, reload, onClose, preset }: {
  d: Detail; reload: () => Promise<void>; onClose: () => void;
  /** Open on this template rather than the one the journey suggests. */
  preset?: MessagePreset | null;
}) {
  const api = useWsApi();
  const dialog = useDialog();
  const j = d.journey;
  const code = d.orders.find((o) => o.activation_code && (o.kind === "health_check" || o.kind === "reevaluation"))?.activation_code ?? null;
  const ctx = useMemo(() => ({
    firstName: cleanName(d.patient.full_name).split(" ")[0] || "",
    activationCode: code,
    bloodAt: j.blood_test_booked_for, measurementsAt: j.measurements_booked_for,
    interviewAt: j.interview_booked_for, interviewMode: j.interview_mode, followupAt: j.followup_booked_for, meetingUrl: j.meeting_url, followupMeetingUrl: j.followup_meeting_url ?? null,
    bloodSite: "Heilsugæslunni", measurementSite: d.location?.name ? "Veru" : null, interviewSite: null,
    nurseName: d.actor.name,
  }), [d, j, code]);
  const templates = useMemo(
    () => [
      ...MESSAGE_TEMPLATES.filter((t) => t.key !== "free").map((t) => ({ key: t.key as Tpl, label: t.label, subject: t.subject, body: () => t.body(ctx) })),
      ...LOCAL_TEMPLATES.map((t) => ({ key: t.key as Tpl, label: t.label, subject: t.subject, body: () => t.body({ firstName: ctx.firstName, nurseName: ctx.nurseName }) })),
      ...MESSAGE_TEMPLATES.filter((t) => t.key === "free").map((t) => ({ key: t.key as Tpl, label: t.label, subject: t.subject, body: () => t.body(ctx) })),
    ],
    [ctx],
  );
  const first = templates.find((t) => t.key === (preset ?? defaultTemplate(j))) ?? templates[templates.length - 1];
  const [tpl, setTpl] = useState<Tpl>(first.key);
  const [text, setText] = useState(() => first.body());
  const [subject, setSubject] = useState(first.subject);
  const [sms, setSms] = useState(!!d.patient.phone);
  const [email, setEmail] = useState(!d.patient.phone && !!d.patient.email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = (k: Tpl) => {
    const t = templates.find((x) => x.key === k)!;
    setTpl(k); setText(t.body()); setSubject(t.subject); setMsg(null);
  };
  const size = smsSize(text);
  const send = async () => {
    const channels = [sms && "sms", email && "email"].filter(Boolean) as string[];
    const ok = await dialog.confirm({
      title: `Senda ${channels.map((c) => (c === "sms" ? "SMS" : "tölvupóst")).join(" og ")}?`,
      body: `Til ${cleanName(d.patient.full_name)}.`,
      confirmLabel: "Senda",
    });
    if (!ok) return;
    setBusy(true); setMsg(null);
    const r = await api(`/api/vinnustod/journeys/${j.id}`, { method: "POST", body: JSON.stringify({ action: "message", channels, template: tpl, subject, body: text }) }).catch(() => null);
    const res = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r) { setMsg({ ok: false, text: "Engin tenging. Ekkert var sent — reyndu aftur." }); return; }
    if (!r.ok && !res.results) {
      /* 400/409/429 carry an Icelandic sentence; 401/403/500 carry a code. */
      const said = typeof res.error === "string" && /[áéíóúýþæöð]/i.test(res.error) ? res.error : null;
      setMsg({ ok: false, text: said || (r.status === 401 ? "Lotan rann út. Skráðu þig inn aftur." : "Sending mistókst. Ekkert var sent.") });
      return;
    }
    const parts = (res.results as { channel: string; ok: boolean; status: string; error?: string }[]).map((x) =>
      `${x.channel === "sms" ? "SMS" : "Tölvupóstur"}: ${x.ok ? (x.status === "dry-run" ? "prufukeyrsla (ekki sent, lyklar vantar)" : "sent") : x.error || "mistókst"}`);
    setMsg({ ok: !!res.ok, text: parts.join(" · ") });
    await reload();
  };

  const toggle = (on: boolean) => `${wsBtn.base} ${on ? "bg-hc-brand-dark text-white" : "bg-hc-surface text-hc-ink-2 ring-1 ring-hc-control hover:bg-hc-sunken"}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-hc-ink-2" id="tpl-label">Sniðmát</p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="tpl-label">
            {templates.map((t) => (
              <button key={t.key} type="button" role="radio" aria-checked={tpl === t.key} onClick={() => pick(t.key)}
                className={`min-h-11 rounded-full px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${tpl === t.key ? "bg-hc-brand-dark text-white" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-hc-brand-surface hover:text-hc-brand-text"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rás">
          <button type="button" aria-pressed={sms} disabled={!d.patient.phone} onClick={() => setSms((v) => !v)} className={toggle(sms)}>
            <Phone className="h-4 w-4" aria-hidden /> SMS {sms && <Check className="h-4 w-4" aria-hidden />}
          </button>
          <button type="button" aria-pressed={email} disabled={!d.patient.email} onClick={() => setEmail((v) => !v)} className={toggle(email)}>
            <Mail className="h-4 w-4" aria-hidden /> Tölvupóstur {email && <Check className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <p className="text-xs text-hc-ink-2">
          {[d.patient.phone ? `SMS í ${d.patient.phone}` : "Ekkert símanúmer skráð", d.patient.email ? `póstur á ${d.patient.email}` : "ekkert netfang skráð"].join(" · ")}
        </p>
        {email && (
          <div>
            <label htmlFor="msg-subject" className="text-sm font-medium text-hc-ink-2">Efni tölvupósts</label>
            <input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={`${accountInput} mt-1 min-h-11`} />
          </div>
        )}
        <div>
          <label htmlFor="msg-body" className="text-sm font-medium text-hc-ink-2">Texti</label>
          <textarea id="msg-body" value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${accountInput} mt-1`} />
        </div>
        {sms && (
          <p className={`text-xs ${size.segments > 3 ? "text-hc-warn-ink" : "text-hc-ink-2"}`}>
            SMS: {size.chars} stafir · {size.segments} {size.segments === 1 ? "hluti" : "hlutar"}{size.encoding === "UCS-2" ? " (íslenskir stafir: 70 í hluta)" : ""}. Vefslóðir geta verið síaðar hjá símafyrirtækjum.
          </p>
        )}
        {msg && <Alert tone={msg.ok ? "ok" : "bad"} compact>{msg.text}</Alert>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || (!sms && !email) || text.trim().length < 5} onClick={() => void send()} className={wsBtn.primary}>
            {busy ? "Sendir…" : `Senda${sms && email ? " SMS og tölvupóst" : sms ? " SMS" : email ? " tölvupóst" : ""}`}
          </button>
          <button type="button" onClick={onClose} className={wsBtn.ghost}>Loka</button>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-hc-ink-2">Send skilaboð</p>
        <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
          {d.messages.length === 0 && <li className="text-sm text-hc-ink-2">Engin skilaboð enn.</li>}
          {d.messages.map((m) => (
            <li key={m.id} className="rounded-xl bg-hc-sunken p-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-hc-ink-2">
                {m.channel === "sms" ? <Phone className="h-3.5 w-3.5" aria-label="SMS" /> : <Mail className="h-3.5 w-3.5" aria-label="Tölvupóstur" />}
                {dayTime(m.sent_at)}
                <span className={`ml-auto rounded px-1.5 py-0.5 ${m.status === "sent" ? "bg-hc-ok-surface text-hc-ok-ink" : m.status === "dry-run" ? "bg-hc-warn-surface text-hc-warn-ink" : "bg-hc-bad-surface text-hc-bad-ink"}`}>
                  {m.status === "sent" ? "Sent" : m.status === "dry-run" ? "Prufa" : "Mistókst"}
                </span>
              </p>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-hc-ink-2">{m.body}</p>
              <p className="mt-1 text-hc-ink-2">{m.sent_by}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

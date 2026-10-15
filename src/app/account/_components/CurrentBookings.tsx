"use client";

// "Bókanir" on Yfirlit: every confirmed time, upcoming first, with what to
// expect, calendar export and the change/cancel actions. Past ones collapse
// into a short "Fyrri bókanir" list. Renders nothing when nothing is booked:
// "Næsta skref" above already says what to do.

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CalendarPlus, Check, ClipboardList, Clock, Droplet, MapPin, Pencil, Ruler, Stethoscope, Video, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { googleCalendarUrl, downloadIcs, type CalendarEvent } from "@/lib/calendar-export";
import { Button, SectionCard, accountInset, fmtDate, fmtTime, buttonClass, useNow } from "@/app/components/account/ui";
import { hcKicker } from "@/app/components/hc/ui";
import PortalLink from "./PortalLink";
import type { AccountState, DoctorMode } from "./types";

function BookingCard({ icon: Icon, kicker, title, lines, expect, footnote, actions }: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  lines: Array<{ icon: LucideIcon; text: ReactNode }>;
  expect?: { title: string; items: string[]; note?: string };
  footnote?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-hc-card bg-hc-surface p-4 shadow-hc-card ring-1 ring-slate-200 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-hc-element bg-hc-brand-surface text-hc-brand-text">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className={`${hcKicker} text-hc-brand-text`}>{kicker}</p>
          <h3 className="font-semibold leading-tight text-hc-ink">{title}</h3>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm text-hc-ink">
        {lines.map((l, i) => {
          const L = l.icon;
          return <li key={i} className="flex items-center gap-2"><L className="h-4 w-4 shrink-0 text-hc-ink-3" aria-hidden /><span className="min-w-0">{l.text}</span></li>;
        })}
      </ul>
      {footnote}
      {expect && (
        <div className={`${accountInset} mt-3 px-3 py-2.5 text-xs text-hc-ink-2`}>
          <p className="mb-1 font-semibold text-hc-ink">{expect.title}</p>
          <ul className="list-inside list-disc space-y-0.5">{expect.items.map((x) => <li key={x}>{x}</li>)}</ul>
          {expect.note && <p className="mt-1.5">{expect.note}</p>}
        </div>
      )}
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hc-hairline pt-4">{actions}</div>}
    </article>
  );
}

function CalendarButtons({ ev }: { ev: CalendarEvent }) {
  const { t } = useI18n();
  return (
    <>
      <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden />Google
        <span className="sr-only"> {t("acc.bk.addcal", "dagatal")}</span>
      </a>
      <button type="button" onClick={() => downloadIcs(ev, "lifeline-booking.ics")} className={buttonClass("secondary", "sm")}>
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden />.ics
        <span className="sr-only"> {t("acc.bk.icsfile", "dagatalsskrá")}</span>
      </button>
    </>
  );
}

export default function CurrentBookings({ s, cancelBusy, onChangeBcSlot, onChangeBloodDay, onChangeDoctorSlot, onCancelDoctorSlot, onCancelBcBooking, onWithdrawRefundRequest, onClearVideoPortal }: {
  s: AccountState;
  cancelBusy: boolean;
  onChangeBcSlot: () => void;
  onChangeBloodDay: () => void;
  onChangeDoctorSlot: () => void;
  onCancelDoctorSlot: () => void;
  onCancelBcBooking: () => void;
  onWithdrawRefundRequest: () => void;
  onClearVideoPortal: () => void;
}) {
  const { t, tv, locale } = useI18n();
  const now = useNow();
  const isB2C = !s.companyId;
  const { mySlotAt, companyEvent, myBloodTestBooking, myDoctorSlot, videoPortalConfirmedAt, bodyCompBookingAt, bodyCompStatus, bodyCompPackage } = s;
  const hasB2CBodyComp = isB2C && bodyCompStatus === "booked" && !!bodyCompBookingAt;
  const hasSelfCheckin = isB2C && bodyCompPackage === "self-checkin" && bodyCompStatus !== "none";
  if (!mySlotAt && !myBloodTestBooking && !myDoctorSlot && !videoPortalConfirmedAt && !hasB2CBodyComp && !hasSelfCheckin) return null;

  const day = (iso: string) => fmtDate(iso, { weekday: true }, locale);
  const modeLabel = (m: DoctorMode) => m === "video" ? t("acc.bk.video", "Myndsímtal") : m === "phone" ? t("acc.bk.phone", "Símtal") : t("acct.p.a-stadnum", "Á staðnum");
  const expectTitle = t("acct.p.vid-hverju-ma-buast", "Við hverju má búast");
  const doctorTitle = myDoctorSlot?.doctor_name
    ? tv("acc.bk.doctor-with", "Viðtal við {{name}}", { name: myDoctorSlot.doctor_name })
    : t("acc.j.doctor", "Viðtal við lækni");

  const bcCard = mySlotAt && companyEvent ? (
    <BookingCard key="bc" icon={Ruler} kicker={t("acct.q.measurements", "Mælingar")} title={t("acc.bk.at-work", "Á vinnustaðnum")}
      lines={[
        { icon: CalendarDays, text: day(mySlotAt) },
        { icon: Clock, text: fmtTime(mySlotAt) },
        ...(companyEvent.location ? [{ icon: MapPin, text: <span className="truncate">{companyEvent.location}</span> }] : []),
      ]}
      footnote={companyEvent.room_notes ? <p className="mt-1 pl-6 text-xs text-hc-ink-3">{companyEvent.room_notes}</p> : undefined}
      expect={{ title: expectTitle, items: [t("acct.q.bp", "Blóðþrýstingur"), t("acct.q.height", "Hæð"), t("acct.q.weight", "Þyngd"), t("acct.q.bodycomp", "Líkamssamsetning (vöðvamassi %, fita %)")], note: t("acct.q.takes5", "Tekur um 5 mínútur. Forðastu þungar máltíðir rétt á undan.") }}
      actions={<>
        <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" aria-hidden />} onClick={onChangeBcSlot}>{t("acc.bk.change-or-cancel", "Breyta eða afbóka")}</Button>
        <CalendarButtons ev={{
          title: "Lifeline — líkamssamsetningarmæling",
          start: new Date(mySlotAt),
          durationMinutes: 5,
          location: companyEvent.location || undefined,
          description: [
            t("acct.p.likamssamsetningarmaelingin-thin-h", "Líkamssamsetningarmælingin þín hjá Lifeline."),
            companyEvent.room_notes ? tv("acc.bk.room", "Herbergi: {{room}}", { room: companyEvent.room_notes }) : "",
            t("acct.p.vid-hverju-ma-buast-blodthrystingu", "Við hverju má búast: blóðþrýstingur, hæð, þyngd og líkamssamsetning (vöðvamassi %, fita %)."),
          ].filter(Boolean).join("\n"),
        }} />
      </>}
    />
  ) : null;

  const btCard = myBloodTestBooking ? (
    <BookingCard key="bt" icon={Droplet} kicker={t("acct.q.bloodtest", "Blóðprufa")} title={t("acct.p.maeting-hja-sameind", "Mæting hjá Sameind")}
      lines={[
        { icon: CalendarDays, text: fmtDate(myBloodTestBooking.day, { weekday: true }, locale) },
        { icon: MapPin, text: t("acct.p.maettu-a-hvada-sameind-stod", "Mættu á hvaða Sameind-stöð sem er") },
      ]}
      footnote={<>
        {myBloodTestBooking.note && <p className="mt-1 pl-6 text-xs text-hc-ink-3">{myBloodTestBooking.note}</p>}
        <p className="mt-3 rounded-hc-element bg-hc-warn-surface px-3 py-2 text-xs text-hc-warn-ink ring-1 ring-amber-200">
          <span className="font-semibold">{t("acct.p.fasta-fra-midnaetti-2", "Fasta frá miðnætti.")}</span> {t("acct.q.wateronly2", "Aðeins vatn — enginn matur, kaffi, te, safi eða áfengi.")}
        </p>
      </>}
      expect={{ title: expectTitle, items: [
        t("acct.p.maettu-a-hvada-sameind-stod-3", "Mættu á hvaða Sameind-stöð sem er á þeim degi sem þú valdir"),
        t("acct.p.maettu-sem-fyrst-helst-a", "Mættu sem fyrst — helst á milli 08:00 og 12:00"),
        t("acct.p.skradu-thig-i-mottokunni", "Skráðu þig í móttökunni"),
        t("acct.q.shortdraw", "Stutt blóðtaka (5 mínútur)"),
        t("acct.p.nidurstodurnar-birtast-i-lokaskyrs", "Niðurstöðurnar birtast í lokaskýrslunni þinni"),
      ] }}
      actions={<>
        {!isB2C && <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" aria-hidden />} onClick={onChangeBloodDay}>{t("acc.bk.change-day", "Breyta degi")}</Button>}
        <CalendarButtons ev={{
          title: "Lifeline — blóðprufa hjá Sameind",
          start: new Date(`${myBloodTestBooking.day}T08:00:00`),
          end: new Date(`${myBloodTestBooking.day}T09:00:00`),
          description: [
            t("acct.p.maettu-a-hvada-sameind-stod-4", "Mættu á hvaða Sameind-stöð sem er. Mættu sem fyrst — helst á milli 08:00 og 12:00."),
            t("acct.p.fasta-fra-midnaetti-adeins-vatn", "Fasta frá miðnætti. Aðeins vatn — enginn matur, kaffi, te, safi eða áfengi."),
            myBloodTestBooking.note ? tv("acc.bk.note", "Athugasemd: {{note}}", { note: myBloodTestBooking.note }) : "",
          ].filter(Boolean).join("\n"),
        }} />
      </>}
    />
  ) : null;

  const drCard = myDoctorSlot ? (
    <BookingCard key="dr" icon={Stethoscope} kicker={t("acct.q.doctor", "Læknir")} title={doctorTitle}
      lines={[
        { icon: CalendarDays, text: day(myDoctorSlot.slot_at) },
        { icon: Clock, text: tv("acc.bk.time-dur", "{{time}} · {{min}} mín.", { time: fmtTime(myDoctorSlot.slot_at), min: myDoctorSlot.duration_minutes }) },
        { icon: myDoctorSlot.mode === "in_person" ? MapPin : Video, text: <span className="truncate">{modeLabel(myDoctorSlot.mode)}{myDoctorSlot.location ? ` · ${myDoctorSlot.location}` : ""}</span> },
      ]}
      footnote={<>
        {myDoctorSlot.meeting_link && <a href={myDoctorSlot.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block pl-6 text-sm font-semibold text-hc-brand-text hover:underline">{t("acct.q.joinlink", "Tengjast ↗")}</a>}
        {myDoctorSlot.notes && <p className="mt-1 pl-6 text-xs text-hc-ink-3">{myDoctorSlot.notes}</p>}
        {myDoctorSlot.booking_note && <p className="mt-1 pl-6 text-xs italic text-hc-ink-3">„{myDoctorSlot.booking_note}“</p>}
      </>}
      expect={{ title: expectTitle, items: [
        t("acct.p.farid-yfir-nidurstodur-ur-likamssa", "Farið yfir niðurstöður úr líkamssamsetningu og blóðprufu"),
        t("acct.p.raett-um-svorin-ur-heilsufarsspurn", "Rætt um svörin úr heilsufarsspurningunum"),
        t("acct.p.komid-ser-saman-um-adgerdaaaetlun", "Komið sér saman um aðgerðaáætlun"),
        t("acct.p.timi-fyrir-spurningarnar-thinar", "Tími fyrir spurningarnar þínar"),
      ], note: t("acct.p.lestu-heilsufarsskyrsluna-thina-i-", "Lestu heilsufarsskýrsluna þína í sjúklingagáttinni fyrir viðtalið.") }}
      actions={<>
        <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" aria-hidden />} onClick={onChangeDoctorSlot}>{t("acc.bk.change-time", "Breyta tíma")}</Button>
        <Button size="sm" variant="dangerOutline" icon={<X className="h-3.5 w-3.5" aria-hidden />} onClick={onCancelDoctorSlot}>{t("acct.q.cancelbooking", "Afbóka")}</Button>
        <CalendarButtons ev={{
          title: `Lifeline — ${doctorTitle}`,
          start: new Date(myDoctorSlot.slot_at),
          durationMinutes: myDoctorSlot.duration_minutes,
          location: myDoctorSlot.mode === "in_person" ? (myDoctorSlot.location || undefined) : (myDoctorSlot.meeting_link || undefined),
          description: [
            `${modeLabel(myDoctorSlot.mode)} — ${t("acc.bk.withdoctor", "viðtal við lækni Lifeline")}.`,
            myDoctorSlot.meeting_link ? tv("acc.bk.join", "Tengill: {{link}}", { link: myDoctorSlot.meeting_link }) : "",
            myDoctorSlot.notes || "",
            t("acct.p.lestu-heilsufarsskyrsluna-thina-i-", "Lestu heilsufarsskýrsluna þína í sjúklingagáttinni fyrir viðtalið."),
          ].filter(Boolean).join("\n"),
        }} />
      </>}
    />
  ) : null;

  const drVideoCard = !myDoctorSlot && videoPortalConfirmedAt ? (
    <BookingCard key="dr-video" icon={Video} kicker={t("acct.q.doctorvideo", "Læknir · Myndsímtal")} title={t("acct.p.myndsimtal-bokad-i-sjuklingagattin", "Myndsímtal bókað í sjúklingagáttinni")}
      lines={[
        { icon: Check, text: tv("acc.bk.confirmed-on", "Staðfest {{date}}", { date: fmtDate(videoPortalConfirmedAt, {}, locale) }) },
      ]}
      footnote={<p className="mt-2 text-sm text-hc-ink-2">{t("acc.bk.video-desc", "Myndsímtalið er bókað í sjúklingagáttinni. Þú tengist því þaðan á bókuðum tíma.")}</p>}
      expect={{ title: expectTitle, items: [
        t("acct.p.tengstu-myndsimtalinu-i-sjuklingag", "Tengstu myndsímtalinu í sjúklingagáttinni"),
        t("acct.p.fardu-yfir-skyrsluna-med-laekninum", "Farðu yfir skýrsluna með lækninum"),
        t("acct.p.komid-ser-saman-um-adgerdaaaetlun", "Komið sér saman um aðgerðaáætlun"),
      ], note: t("acct.p.lestu-heilsufarsskyrsluna-thina-i-", "Lestu heilsufarsskýrsluna þína í sjúklingagáttinni fyrir viðtalið.") }}
      actions={<>
        <PortalLink label={t("acct.p.fara-i-sjuklingagatt", "Fara í sjúklingagátt")} />
        <Button size="sm" variant="ghost" onClick={onClearVideoPortal}>{t("acct.q.clearconf", "Hreinsa staðfestingu")}</Button>
      </>}
    />
  ) : null;

  const bcB2CCard = hasB2CBodyComp && bodyCompBookingAt ? (
    <BookingCard key="bc-b2c" icon={Ruler} kicker={t("acct.q.measurements", "Mælingar")} title={t("acct.p.a-maelingastod-lifeline", "Á mælingastöð Lifeline")}
      lines={[
        { icon: CalendarDays, text: day(bodyCompBookingAt) },
        { icon: Clock, text: fmtTime(bodyCompBookingAt) },
      ]}
      expect={{ title: expectTitle, items: [
        t("acct.q.bphwbc", "Blóðþrýstingur, hæð, þyngd og líkamssamsetning"),
        t("acct.p.markviss-blodprufa-fasta-fra-midna", "Markviss blóðprufa — fasta frá miðnætti"),
        t("acct.p.nidurstodurnar-birtast-i-skyrslunn", "Niðurstöðurnar birtast í skýrslunni þinni"),
      ] }}
      actions={s.pendingRefundRequestId ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-hc-element bg-hc-warn-surface px-3 py-1.5 text-xs font-semibold text-hc-warn-ink ring-1 ring-amber-200">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {t("acct.q.cancelsent", "Afbókunarbeiðni send — bíður svars frá Lifeline")}
          </span>
          <Button size="sm" variant="ghost" onClick={onWithdrawRefundRequest}>{t("acct.q.withdraw", "Draga til baka")}</Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="dangerOutline" busy={cancelBusy} icon={<X className="h-3.5 w-3.5" aria-hidden />} onClick={onCancelBcBooking}>{t("acct.q.cancelbooking", "Afbóka")}</Button>
          <p className="text-xs text-hc-ink-3">{t("acct.p.full-endurgreidsla-fram-ad-48", "Full endurgreiðsla fram að 48 klukkustundum fyrir — eftir það má óska eftir endurskoðun")}</p>
        </>
      )}
    />
  ) : null;

  const selfCard = hasSelfCheckin ? (
    <BookingCard key="self" icon={ClipboardList} kicker={t("acct.p.sjalfsmat", "Sjálfsmat")} title={t("acct.q.remotequest", "Spurningalisti í fjarþjónustu")}
      lines={[]}
      footnote={<p className="text-sm leading-relaxed text-hc-ink-2">{bodyCompStatus === "completed"
        ? t("acct.p.lokid-fagadili-hefur-farid-yfir", "Lokið — fagaðili hefur farið yfir svörin þín.")
        : t("acct.p.opnadu-sjuklingagattina-og-svaradu", "Opnaðu sjúklingagáttina og svaraðu spurningalistanum. Engin heimsókn nauðsynleg.")}</p>}
      actions={<PortalLink />}
    />
  ) : null;

  type Past = { label: string; sublabel: string; time: number };
  type Entry = { key: string; card: ReactNode; time: number; past?: Past };
  const entries: Entry[] = [
    { key: "self", card: selfCard, time: 0 },
    {
      key: "bc", card: bcCard, time: mySlotAt ? new Date(mySlotAt).getTime() : Infinity,
      past: mySlotAt && companyEvent && new Date(mySlotAt).getTime() + 15 * 60_000 < now
        ? { label: t("acct.p.maelingar-a-stadnum", "Mælingar á staðnum"), sublabel: companyEvent.location || t("acct.q.measurements", "Mælingar"), time: new Date(mySlotAt).getTime() } : undefined,
    },
    {
      key: "bc-b2c", card: bcB2CCard, time: bodyCompBookingAt ? new Date(bodyCompBookingAt).getTime() : Infinity,
      past: hasB2CBodyComp && bodyCompBookingAt && new Date(bodyCompBookingAt).getTime() + 30 * 60_000 < now
        ? { label: t("acc.bk.bodycomp", "Líkamssamsetningarmæling"), sublabel: t("acct.p.a-maelingastod-lifeline", "Á mælingastöð Lifeline"), time: new Date(bodyCompBookingAt).getTime() } : undefined,
    },
    {
      key: "bt", card: btCard, time: myBloodTestBooking ? new Date(`${myBloodTestBooking.day}T00:00:00`).getTime() : Infinity,
      past: myBloodTestBooking && new Date(`${myBloodTestBooking.day}T23:59:59`).getTime() < now
        ? { label: t("acc.j.blood", "Blóðprufa hjá Sameind"), sublabel: t("acc.bk.walkin", "Án tímabókunar"), time: new Date(`${myBloodTestBooking.day}T00:00:00`).getTime() } : undefined,
    },
    {
      key: "dr", card: drCard, time: myDoctorSlot ? new Date(myDoctorSlot.slot_at).getTime() : Infinity,
      past: myDoctorSlot && new Date(myDoctorSlot.slot_at).getTime() + myDoctorSlot.duration_minutes * 60_000 < now
        ? { label: doctorTitle, sublabel: modeLabel(myDoctorSlot.mode), time: new Date(myDoctorSlot.slot_at).getTime() } : undefined,
    },
    { key: "dr-video", card: drVideoCard, time: videoPortalConfirmedAt ? new Date(videoPortalConfirmedAt).getTime() : Infinity },
  ].filter((e) => e.card);

  const upcoming = entries.filter((e) => !e.past).sort((a, b) => a.time - b.time);
  const past = entries.filter((e) => e.past).sort((a, b) => b.past!.time - a.past!.time);

  return (
    <SectionCard id="bookings" title={t("acct.p.bokanir", "Bókanir")} description={t("acct.p.stadfestir-timar", "Staðfestir tímar.")} icon={CalendarDays}>
      {upcoming.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">{upcoming.map((e) => <div key={e.key} className="contents">{e.card}</div>)}</div>
      ) : (
        <p className={`${accountInset} p-5 text-center text-sm text-hc-ink-2`}>{t("acc.bk.none-upcoming", "Engar bókanir fram undan.")}</p>
      )}
      {past.length > 0 && (
        <div className="mt-6 border-t border-hc-hairline pt-5">
          <h3 className="mb-3 text-sm font-semibold text-hc-ink">{t("acct.q.pastbookings", "Fyrri bókanir")}</h3>
          <ul className="space-y-2">
            {past.map((e) => (
              <li key={e.key} className={`${accountInset} flex items-center gap-3 px-4 py-3`}>
                <span className="inline-flex items-center gap-1 rounded-full bg-hc-ok-surface px-2 py-0.5 text-[11px] font-semibold text-hc-ok-ink ring-1 ring-emerald-200">
                  <Check className="h-3 w-3" aria-hidden />{t("acct.q.completed", "Lokið")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-hc-ink">{e.past!.label}</p>
                  <p className="truncate text-xs text-hc-ink-3">{e.past!.sublabel}</p>
                </div>
                <p className="shrink-0 text-right text-xs text-hc-ink-3">{fmtDate(new Date(e.past!.time), {}, locale)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

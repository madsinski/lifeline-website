"use client";

// Service-survey report (e.g. „Þjónustukönnun – Lifeline Health“): how
// participants experienced each stage of the service. Two A4 pages:
//
//   Page 1 — headline tiles, a rating per service stage (likert5, one row
//            per chapter), and the yes/partly/no questions with the weakest
//            one flagged as the main improvement area.
//   Page 2+ — only when there are quotes: open answers, split into
//            praise („vel gert“, „hrósa“, or a „breyta“ reply that asks for
//            nothing) and suggestions, tagged with the stage; non-answers
//            („ekkert“, „allt“) are dropped. Flows over extra pages as needed.
//            Anonymous; the service survey did not ask for publication
//            consent, so the pages are marked internal.
//
// Chosen by ReportPages when the survey is not a follow-up (change) survey.

import { useEffect, useRef, useState } from "react";
import type { FeedbackSurvey, FeedbackQuestion } from "@/lib/feedback-survey-types";
import type { AssignmentRow, ResponseRow } from "./ReportPages";

export interface Quote { id: string; text: string; stage: string; kind: "praise" | "improve" }

const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const fmtMonth = (d: Date) => `${MONTHS_IS[d.getMonth()]} ${d.getFullYear()}`;
const fmtDate = (d: Date) => `${d.getDate()}. ${MONTHS_IS[d.getMonth()]} ${d.getFullYear()}`;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const num1 = (x: number) => x.toLocaleString("is-IS", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ordinal colours, most positive first (works for 3-, 4- and 5-point scales)
const SCALE: Record<number, string[]> = {
  5: ["#047857", "#34D399", "#D1D5DB", "#FB923C", "#C2410C"],
  4: ["#047857", "#34D399", "#FB923C", "#C2410C"],
  3: ["#047857", "#34D399", "#C2410C"],
};
const TEXT_ON: Record<string, string> = { "#047857": "#fff", "#C2410C": "#fff" };

// Answers that say nothing („ekkert“, „allt“, „nei“, didn't attend) are left out.
const NON_ANSWER = /^(ekkert|ekki neitt|neitt|nei|nei takk|allt|allt saman|veit ekki|á ekki við|n\/?a|-+|\.+)( (sem mér dettur í hug|sérstakt|annað|að segja|takk))?$/;
const clean = (t: string) => t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\uFFFD\uE000-\uF8FF]/gu, "").replace(/\s+/g, " ").trim();
// A reply to a „breyta / annað“ question that asks for nothing is praise.
const ASKS = /meira|meiri|betri|betra|lengri|styttri|fleiri|annan|aðra|mætti|vantaði|vantar|vildi að|hefði|mundi|myndi|ætti|skýrari|breyta (?!neinu|engu)|oftar|fyrr|seinna|eftirfylgni/i;
const PRAISE = /takk|ánægð|frábær|frábært|gott|góð|vel |vel$|skemmtileg|hress|fagleg|til fyrirmyndar|engu|neinu/i;

/** Open answer → quote kind by the question wording and the answer itself; null = not a quote. */
export function quoteKind(label: string, text = ""): Quote["kind"] | null {
  const t = clean(text);
  if (t.length < 3 || NON_ANSWER.test(t.toLowerCase().replace(/[.!:;)(]+$/g, "").trim()) || /komst ekki|mætti ekki|^ekkert\b.{0,35}$|^eins og (á|a)ðan|^sama og/i.test(t)) return null;
  if (/vel gert|hrósa/i.test(label)) return "praise";
  if (/breyta|annað sem þú vilt/i.test(label)) return PRAISE.test(t) && !ASKS.test(t) ? "praise" : "improve";
  return null;
}
export const cleanQuote = clean;

/** Is this a follow-up (change) survey rather than a service survey? */
export const isFollowUpSurvey = (questions: FeedbackQuestion[]) =>
  questions.some((q) => q.question_type === "likert5" && /breyst|breyttist/i.test(q.label_is));

interface Dist { n: number; counts: number[]; labels: string[] }   // most positive first
function dist(responses: ResponseRow[], q: FeedbackQuestion): Dist {
  const opts = [...(q.options_jsonb || [])].sort((a, b) => Number(b.value) - Number(a.value));
  const rs = responses.filter((r) => r.question_id === q.id && !r.skipped && r.value);
  return { n: rs.length, counts: opts.map((o) => rs.filter((r) => r.value === o.value).length), labels: opts.map((o) => o.label_is) };
}
const meanOf = (d: Dist) => {
  const k = d.counts.length;
  return d.n ? d.counts.reduce((s, c, i) => s + c * (k - i), 0) / d.n : 0;
};

export function ServiceReport({ survey, questions, assignments, responses, quotes, demo }: {
  survey: FeedbackSurvey; questions: FeedbackQuestion[]; assignments: AssignmentRow[]; responses: ResponseRow[]; quotes: Quote[]; demo: boolean;
}) {
  const sent = assignments.length;
  const completed = assignments.filter((a) => a.completed_at);
  const n = completed.length;
  const lastDate = completed.map((a) => new Date(a.completed_at!)).sort((a, b) => b.getTime() - a.getTime())[0] || new Date();
  const firstSent = assignments.map((a) => new Date(a.sent_at)).sort((a, b) => a.getTime() - b.getTime())[0];
  const stage = (q: FeedbackQuestion) => q.section_title_is || q.label_is;

  const likerts = questions.filter((q) => q.question_type === "likert5");
  const recommendQ = questions.find((q) => q.question_type === "singleselect" && /mæla með/i.test(q.label_is));
  const selects = questions.filter((q) => q.question_type === "singleselect" && q.id !== recommendQ?.id);
  const L = likerts.map((q) => ({ q, d: dist(responses, q) })).filter((x) => x.d.n > 0);
  const S = selects.map((q) => ({ q, d: dist(responses, q) })).filter((x) => x.d.n > 0);

  // tiles
  const tiles: { value: string; label: string }[] = [];
  if (recommendQ) { const d = dist(responses, recommendQ); if (d.n) tiles.push({ value: `${pct(d.counts[0], d.n)}%`, label: "myndu mæla með Lifeline Health við aðra" }); }
  if (L[0]) tiles.push({ value: `${pct(L[0].d.counts[0] + L[0].d.counts[1], L[0].d.n)}%`, label: "fannst heildarferlið gott eða mjög gott" });
  const best = [...L.slice(1)].sort((a, b) => pct(b.d.counts[0], b.d.n) - pct(a.d.counts[0], a.d.n))[0];
  if (best) tiles.push({ value: `${pct(best.d.counts[0], best.d.n)}%`, label: `gáfu hæstu einkunn: ${stage(best.q).toLowerCase()}` });
  if (sent) tiles.push({ value: `${pct(n, sent)}%`, label: `svarhlutfall (${n} af ${sent})` });

  // weakest yes/partly/no item = main improvement area
  const weakest = [...S].sort((a, b) => pct(a.d.counts[0], a.d.n) - pct(b.d.counts[0], b.d.n))[0];

  // the same person repeating an answer under several stages is shown once
  const seen = new Set<string>();
  const uniq = quotes.filter((q) => { const k = `${q.id.split(":")[0]}|${q.text.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const praise = uniq.filter((q) => q.kind === "praise"), improve = uniq.filter((q) => q.kind === "improve");
  // Quotes flow over as many pages as needed; the first quote page also carries the hero.
  const pc = paginate(praise), ic = paginate(improve);
  const quotePages = uniq.length ? Math.max(pc.length, ic.length) : 0;
  const total = 1 + quotePages;

  return (
    <>
      <Page demo={demo} page={1} total={total}>
        <Header subtitle={`Niðurstöður þjónustukönnunar · ${fmtMonth(lastDate)}`} />
        <div className="rounded-[4mm] px-[8mm] py-[5.5mm] text-white" style={{ background: "linear-gradient(120deg,#047857 0%,#10B981 100%)" }}>
          <p className="text-[8.5pt] uppercase tracking-[0.12em] opacity-80">{survey.title_is}</p>
          <h1 className="text-[19pt] font-bold leading-tight mt-[1mm]">Hvernig upplifðu þátttakendur þjónustuna?</h1>
          <p className="text-[9.5pt] mt-[1.5mm] opacity-90">Mat þátttakenda á hverjum þætti heilsufarsskoðunarinnar, frá fyrirlestri til læknisviðtals.</p>
        </div>

        {tiles.length > 0 && (
          <div className="grid gap-[3mm] mt-[4.5mm]" style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}>
            {tiles.map((t) => (
              <div key={t.label} className="rounded-[3mm] border border-emerald-100 bg-emerald-50/60 px-[4mm] py-[3mm]">
                <div className="text-[21pt] font-bold text-emerald-700 leading-none">{t.value}</div>
                <div className="text-[7.8pt] text-gray-600 mt-[1.5mm] leading-snug">{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {L.length > 0 && (
          <section className="mt-[6mm]">
            <h2 className="text-[11pt] font-bold mb-[1mm]">Einkunn hvers þáttar</h2>
            <p className="text-[7.8pt] text-gray-500 mb-[2.5mm]">Dökkgrænt er jákvæðasta svarið (t.d. „Mjög gott“), rautt það neikvæðasta. Hægra megin: meðaleinkunn af 5.</p>
            <div className="space-y-[2.2mm]">
              {L.map(({ q, d }) => <ScaleRow key={q.id} label={stage(q)} d={d} right={<><b className="text-[10.5pt] text-emerald-700">{num1(meanOf(d))}</b><span className="text-gray-500"> / 5</span></>} />)}
            </div>
          </section>
        )}

        {S.length > 0 && (
          <section className="mt-[6mm]">
            <h2 className="text-[11pt] font-bold mb-[1mm]">Skilningur og upplifun</h2>
            <p className="text-[7.8pt] text-gray-500 mb-[2.5mm]">Hægra megin: hlutfall sem svaraði jákvæðasta svarinu (t.d. „Já“ eða „Já, mjög vel“).</p>
            <div className="space-y-[2.2mm]">
              {S.map(({ q, d }) => (
                <ScaleRow key={q.id} label={q.label_is} small d={d} flag={weakest?.q.id === q.id}
                  right={<><b className="text-[10.5pt] text-emerald-700">{pct(d.counts[0], d.n)}%</b><span className="text-gray-500"> {d.labels[0].toLowerCase()}</span></>} />
              ))}
            </div>
            {weakest && pct(weakest.d.counts[0], weakest.d.n) < 80 && (
              <div className="mt-[3.5mm] rounded-[3mm] border border-amber-200 bg-amber-50 px-[5mm] py-[3mm] text-[8.5pt] text-amber-900 leading-snug">
                <b>Mest svigrúm til úrbóta:</b> „{weakest.q.label_is}“ — {pct(weakest.d.counts[0], weakest.d.n)}% svöruðu „{weakest.d.labels[0]}“.
              </div>
            )}
          </section>
        )}

        <Footer page={1} total={total}>
          {firstSent ? `Könnunin var send ${fmtDate(firstSent)}. ` : ""}Svör: {n} af {sent}. Niðurstöður endurspegla þá sem svöruðu; lágt svarhlutfall getur skekkt myndina. Hlutföll eru reiknuð af þeim sem svöruðu hverri spurningu.
        </Footer>
      </Page>

      {Array.from({ length: quotePages }, (_, i) => (
        <Page key={i} demo={demo} page={2 + i} total={total}>
          <Header subtitle="Í orðum þátttakenda" />
          {i === 0 && (
            <div className="rounded-[4mm] px-[8mm] py-[5mm] text-white" style={{ background: "linear-gradient(120deg,#047857 0%,#10B981 100%)" }}>
              <p className="text-[8.5pt] uppercase tracking-[0.12em] opacity-80">{survey.title_is}</p>
              <h1 className="text-[18pt] font-bold leading-tight mt-[1mm]">Hvað fannst þátttakendum?</h1>
              <p className="text-[9.5pt] mt-[1.5mm] opacity-90">Nafnlaus svör við opnum spurningum, flokkuð eftir þáttum þjónustunnar.</p>
            </div>
          )}
          <QuoteColumns praise={pc[i] ?? []} improve={ic[i] ?? []} first={i === 0} more={i > 0} />
          <Footer page={2 + i} total={total}>
            Innri skýrsla: svörin eru nafnlaus og birt óbreytt. Þátttakendur voru ekki beðnir um leyfi til birtingar utan Lifeline Health.
          </Footer>
        </Page>
      ))}
    </>
  );
}

function ScaleRow({ label, d, right, small, flag }: { label: string; d: Dist; right: React.ReactNode; small?: boolean; flag?: boolean }) {
  const cols = SCALE[d.counts.length] ?? SCALE[5];
  return (
    <div className="grid items-center gap-[3mm]" style={{ gridTemplateColumns: small ? "74mm 1fr 30mm" : "46mm 1fr 22mm" }}>
      <div className={`${small ? "text-[8.3pt]" : "text-[9pt] font-medium"} leading-snug ${flag ? "text-amber-800 font-semibold" : ""}`}>{label}</div>
      <div className="flex h-[6mm] gap-[0.5mm] rounded-[1mm] overflow-hidden bg-gray-100">
        {d.counts.map((c, i) => {
          const p = (c / d.n) * 100;
          if (!c) return null;
          return (
            <div key={i} className="h-full flex items-center justify-center text-[7pt] font-semibold"
              style={{ width: `${p}%`, background: cols[i], color: TEXT_ON[cols[i]] ?? "#1F2937" }} title={`${d.labels[i]}: ${c} (${Math.round(p)}%)`}>
              {p >= 12 ? `${Math.round(p)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="text-[8pt] text-right whitespace-nowrap">{right}</div>
    </div>
  );
}

// Height estimate (mm) of one quote card in a ~85 mm column at 8.3 pt.
const cardMm = (q: Quote) => 2 * 1.5 + Math.ceil(q.text.length / 52) * 3.9 + 3.2 + 1.5;
const CAP_FIRST = 200, CAP_REST = 238;
function paginate(qs: Quote[]): Quote[][] {
  const pages: Quote[][] = [[]];
  let used = 0;
  for (const q of qs) {
    const cap = pages.length === 1 ? CAP_FIRST : CAP_REST, h = cardMm(q);
    if (used + h > cap && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(q); used += h;
  }
  return pages;
}

function QuoteColumns({ praise, improve, first, more }: { praise: Quote[]; improve: Quote[]; first: boolean; more: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [praise, improve]);
  const col = (title: string, qs: Quote[], tone: "good" | "warn") => (
    <div>
      <div className={`text-[10pt] font-bold mb-[2mm] ${tone === "good" ? "text-emerald-800" : "text-amber-800"}`}>{title}{more ? " (frh.)" : ""}</div>
      <div className="space-y-[1.5mm]">
        {qs.length === 0 && first && <p className="text-[8.5pt] text-gray-400">Engin svör.</p>}
        {qs.map((q) => (
          <figure key={q.id} className={`rounded-[2mm] px-[3.5mm] py-[1.5mm] border-l-[1mm] ${tone === "good" ? "bg-emerald-50/70 border-emerald-500" : "bg-amber-50/70 border-amber-400"}`} style={{ breakInside: "avoid" }}>
            <blockquote className="text-[8.3pt] leading-snug text-gray-800">„{q.text}“</blockquote>
            <figcaption className="mt-[0.6mm] text-[6.5pt] font-semibold text-gray-500 uppercase tracking-wide">{q.stage}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
  return (
    <div className={`relative flex-1 min-h-0 ${first ? "mt-[5mm]" : ""}`}>
      <div ref={ref} className="h-full overflow-hidden grid grid-cols-2 gap-[6mm] content-start">
        {col("Það sem vel var gert", praise, "good")}
        {col("Tillögur að úrbótum", improve, "warn")}
      </div>
      {overflow && (
        <p className="print:hidden absolute bottom-0 inset-x-0 bg-amber-100 text-amber-900 text-[8pt] px-[3mm] py-[1.5mm] rounded">
          Svörin komast ekki öll fyrir á síðunni — taktu hakið af einhverjum þeirra í listanum fyrir ofan.
        </p>
      )}
    </div>
  );
}

function Page({ children, demo, page, total }: { children: React.ReactNode; demo: boolean; page: number; total: number }) {
  return (
    <div className="a4 relative bg-white shadow-lg overflow-hidden flex flex-col text-[#1F2937]"
      style={{ width: "210mm", height: "297mm", padding: "12mm 14mm 10mm", fontFamily: "var(--font-inter), system-ui, sans-serif" }} data-page={page} data-total={total}>
      {children}
      {demo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[54pt] font-black tracking-widest text-amber-500/25 -rotate-[30deg] whitespace-nowrap">SÝNISHORN</span>
        </div>
      )}
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-end justify-between pb-[4mm] mb-[5mm] border-b-[0.6mm] border-emerald-600">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lifeline-logo-rebrand.svg" alt="Lifeline Health" style={{ height: "8mm", width: "auto" }} />
      <div className="text-right">
        <div className="text-[9pt] font-semibold text-emerald-700">Lifeline Health</div>
        <div className="text-[8pt] text-gray-500">{subtitle}</div>
      </div>
    </div>
  );
}

function Footer({ children, page, total }: { children: React.ReactNode; page: number; total: number }) {
  return (
    <div className="mt-auto pt-[3mm] border-t border-gray-200 flex items-end justify-between gap-[6mm] text-[7pt] text-gray-500 leading-snug">
      <p className="max-w-[150mm]">{children}</p>
      <p className="whitespace-nowrap">lifelinehealth.is · {page}/{total}</p>
    </div>
  );
}

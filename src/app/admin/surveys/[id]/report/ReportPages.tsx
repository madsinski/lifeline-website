"use client";

// Two-page A4 survey report (results + stories). Rendered by
// ./page.tsx on screen and, portalled to <body>, for print.

import { useEffect, useRef, useState } from "react";
import type { FeedbackSurvey, FeedbackQuestion } from "@/lib/feedback-survey-types";

export interface AssignmentRow {
  id: string;
  sent_at: string;
  completed_at: string | null;
  client_name: string | null;
}
export interface ResponseRow {
  assignment_id: string;
  question_id: string;
  value: string | null;
  values_array: string[] | null;
  text_value: string | null;
  skipped: boolean;
}
export interface Story {
  id: string;
  text: string;
  firstName: string | null;
}

// Diverging scale: emerald (brand) for positive, neutral grey midpoint,
// orange for negative. Indexed by likert value 5..1.
const LIKERT_COLOR: Record<number, string> = {
  5: "#047857",
  4: "#34D399",
  3: "#D1D5DB",
  2: "#FB923C",
  1: "#C2410C",
};
const LIKERT_TEXT: Record<number, string> = { 5: "#fff", 4: "#1F2937", 3: "#1F2937", 2: "#1F2937", 1: "#fff" };

const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const fmtMonth = (d: Date) => `${MONTHS_IS[d.getMonth()]} ${d.getFullYear()}`;
const fmtDate = (d: Date) => `${d.getDate()}. ${MONTHS_IS[d.getMonth()]} ${d.getFullYear()}`;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Short row labels for the self-rated-change chart.
function shortLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("heilsu þína")) return "Heilsa almennt";
  if (l.includes("hreyfi")) return "Hreyfing";
  if (l.includes("matar") || l.includes("næring")) return "Mataræði";
  if (l.includes("svefn")) return "Svefn";
  if (l.includes("andleg")) return "Andleg líðan";
  if (l.includes("orka") || l.includes("orkan")) return "Orka í daglegu lífi";
  return label.length > 28 ? `${label.slice(0, 26)}…` : label;
}

// ─── Aggregation ──────────────────────────────────────────────────
function answered(responses: ResponseRow[], qid: string) {
  return responses.filter((r) => r.question_id === qid && !r.skipped && (r.value || r.values_array?.length || r.text_value));
}

function likertDist(responses: ResponseRow[], q: FeedbackQuestion) {
  const rs = answered(responses, q.id);
  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of rs) {
    const v = Number(r.value);
    if (v >= 1 && v <= 5) counts[v]++;
  }
  const n = rs.length;
  return { n, counts, top2: pct(counts[5] + counts[4], n) };
}

function multiTop(responses: ResponseRow[], q: FeedbackQuestion, limit: number) {
  const rs = answered(responses, q.id);
  const counts = new Map<string, number>();
  for (const r of rs) for (const v of r.values_array || []) counts.set(v, (counts.get(v) || 0) + 1);
  const opts = q.options_jsonb || [];
  const rows = opts
    .map((o) => ({ label: o.label_is, n: counts.get(o.value) || 0 }))
    // "nothing in particular" style answers don't belong in a top list
    .filter((r) => r.n > 0 && !/^(ekkert sérstakt|ég hef ekki gert breytingar)/i.test(r.label))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
  return { respondents: rs.length, rows };
}

function npsScore(responses: ResponseRow[], q: FeedbackQuestion | undefined) {
  if (!q) return null;
  const vals = answered(responses, q.id).map((r) => Number(r.value)).filter((v) => !Number.isNaN(v));
  if (vals.length === 0) return null;
  const p = vals.filter((v) => v >= 9).length;
  const d = vals.filter((v) => v <= 6).length;
  return Math.round(((p - d) / vals.length) * 100);
}

// ─── Demo data (watermarked) ──────────────────────────────────────
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const DEMO_STORIES = [
  "Heilsufarsskoðunin var vakning fyrir mig. Ég sá tölurnar svart á hvítu og ákvað að breyta til. Í dag geng ég í vinnuna á hverjum degi og sef mun betur.",
  "Ég hélt að ég væri í ágætis formi en blóðprufan sýndi annað. Læknirinn gaf sér góðan tíma og planið var raunhæft. Ég hef minnkað sykurinn verulega.",
  "Fyrirlesturinn um svefn breytti miklu. Ég legg símann frá mér klukkutíma fyrir svefn og vakna úthvíldari.",
  "Við nokkur í vinnunni byrjuðum að ganga saman í hádeginu eftir skoðunina. Það hefur gert mikið fyrir starfsandann.",
  "Frábær þjónusta og fagleg. Mér fannst gott að fá skýr markmið til að vinna að.",
];
export function buildDemo(questions: FeedbackQuestion[]) {
  const rand = seeded(7);
  const N = 38;
  const assignments: AssignmentRow[] = [];
  const responses: ResponseRow[] = [];
  const firstNames = ["Guðrún", "Sigríður", "Anna", "Jón", "Kristín"];
  const nameQ = questions.find((q) => (q.options_jsonb || []).some((o) => o.value === "ja-fornafn"));
  for (let i = 0; i < N; i++) {
    const aid = `demo-${i}`;
    assignments.push({ id: aid, sent_at: new Date(2026, 8, 25).toISOString(), completed_at: new Date(2026, 9, 2).toISOString(), client_name: `${firstNames[i % 5]} Dæmisdóttir` });
    for (const q of questions) {
      const r = rand();
      const base: ResponseRow = { assignment_id: aid, question_id: q.id, value: null, values_array: null, text_value: null, skipped: false };
      if (q.question_type === "likert5") {
        base.value = String(r < 0.3 ? 5 : r < 0.72 ? 4 : r < 0.93 ? 3 : r < 0.98 ? 2 : 1);
      } else if (q.question_type === "multiselect") {
        base.values_array = (q.options_jsonb || []).filter(() => rand() < 0.38).map((o) => o.value);
      } else if (q.question_type === "singleselect") {
        const opts = q.options_jsonb || [];
        if (q.id === nameQ?.id) base.value = i < DEMO_STORIES.length && i % 2 === 0 ? "ja-fornafn" : "nei-nafnlaust";
        else base.value = opts[Math.min(opts.length - 1, Math.floor(r * r * opts.length))]?.value ?? null;
      } else if (q.question_type === "nps10") {
        base.value = String(r < 0.55 ? 10 - Math.floor(rand() * 2) : r < 0.85 ? 8 - Math.floor(rand() * 2) : 5 + Math.floor(rand() * 2));
      } else if (q.question_type === "consent_optional") {
        base.value = i < DEMO_STORIES.length ? "yes" : "no";
        base.text_value = i < DEMO_STORIES.length ? DEMO_STORIES[i] : null;
      } else {
        base.skipped = true;
      }
      responses.push(base);
    }
  }
  return { assignments, responses };
}

// Print: only the portalled .survey-report-print copy is shown.
export const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #fff !important; }
  body > *:not(.survey-report-print) { display: none !important; }
  .survey-report-print { display: block !important; }
  .survey-report-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .survey-report-print .a4 { box-shadow: none !important; margin: 0 !important; break-after: page; }
  .survey-report-print .a4:last-child { break-after: auto; }
}
`;

// ─── Report (two A4 pages) ────────────────────────────────────────
export function ReportPages({
  survey, questions, assignments, responses, stories, demo,
}: {
  survey: FeedbackSurvey;
  questions: FeedbackQuestion[];
  assignments: AssignmentRow[];
  responses: ResponseRow[];
  stories: Story[];
  demo: boolean;
}) {
  const org = survey.title_is.split(/\s[–-]\s/)[1]?.trim() || "Lifeline Health";
  const sent = assignments.length;
  const completed = assignments.filter((a) => a.completed_at);
  const n = completed.length;
  const lastDate = completed.map((a) => new Date(a.completed_at!)).sort((a, b) => b.getTime() - a.getTime())[0] || new Date();
  const firstSent = assignments.map((a) => new Date(a.sent_at)).sort((a, b) => a.getTime() - b.getTime())[0];

  const firstSection = Math.min(...questions.map((q) => q.section_index ?? 1));
  const changeQs = questions.filter((q) => q.question_type === "likert5" && (q.section_index ?? 1) === firstSection);
  const overallQ = changeQs[0];
  const lifelineQ = questions.find((q) => q.question_type === "likert5" && /lifeline/i.test(q.label_is));
  const planQ = questions.find((q) => q.question_type === "singleselect" && /planinu/i.test(q.label_is));
  const npsQ = questions.find((q) => q.question_type === "nps10");
  const multis = questions.filter((q) => q.question_type === "multiselect");

  const tiles: { value: string; label: string }[] = [];
  if (overallQ) tiles.push({ value: `${likertDist(responses, overallQ).top2}%`, label: "meta heilsu sína betri en fyrir heilsufarsskoðunina" });
  if (lifelineQ) tiles.push({ value: `${likertDist(responses, lifelineQ).top2}%`, label: "segja Lifeline hafa átt mikinn eða mjög mikinn þátt í breytingunum" });
  if (planQ) {
    const rs = answered(responses, planQ.id);
    const good = (planQ.options_jsonb || []).slice(0, 2).map((o) => o.value);
    tiles.push({ value: `${pct(rs.filter((r) => good.includes(r.value || "")).length, rs.length)}%`, label: "hafa fylgt planinu sínu að mestu eða að hluta" });
  }
  const nps = npsScore(responses, npsQ);
  if (nps !== null) tiles.push({ value: `${nps > 0 ? "+" : ""}${nps}`, label: "meðmælaskor (NPS, á kvarðanum −100 til +100)" });

  const changesQ = multis.find((q) => (q.section_index ?? 1) === firstSection);
  const helpedQ = multis.find((q) => /hjálpað/i.test(q.label_is));
  const supportQ = multis.find((q) => /stuðning/i.test(q.label_is));

  return (
    <>
      {/* ── Page 1: results ── */}
      <A4 demo={demo} page={1}>
        <Header org={org} subtitle={`Niðurstöður könnunar · ${fmtMonth(lastDate)}`} />
        <div className="rounded-[4mm] px-[8mm] py-[6mm] text-white" style={{ background: "linear-gradient(120deg,#047857 0%,#10B981 100%)" }}>
          <p className="text-[8.5pt] uppercase tracking-[0.12em] opacity-80">{survey.title_is}</p>
          <h1 className="text-[20pt] font-bold leading-tight mt-[1mm]">Hvernig hefur þátttakendum gengið?</h1>
          <p className="text-[10pt] mt-[1.5mm] opacity-90">
            Sjálfsmat þátttakenda um sex mánuðum eftir heilsufarsskoðun Lifeline Health · {n} {n === 1 ? "svar" : "svör"}
            {sent > 0 ? ` · svarhlutfall ${pct(n, sent)}%` : ""}
          </p>
        </div>

        {tiles.length > 0 && (
          <div className="grid gap-[3mm] mt-[5mm]" style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}>
            {tiles.map((t) => (
              <div key={t.label} className="rounded-[3mm] border border-emerald-100 bg-emerald-50/60 px-[4mm] py-[3.5mm]">
                <div className="text-[22pt] font-bold text-emerald-700 leading-none">{t.value}</div>
                <div className="text-[8pt] text-gray-600 mt-[1.5mm] leading-snug">{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {changeQs.length > 0 && (
          <section className="mt-[8mm]">
            <SectionTitle>Breytingar síðan í mars — sjálfsmat þátttakenda</SectionTitle>
            <DivergingLegend labels={(changeQs[0].options_jsonb || []).map((o) => o.label_is)} />
            <div className="space-y-[2.6mm] mt-[3mm]">
              {changeQs.map((q) => <DivergingRow key={q.id} label={shortLabel(q.label_is)} q={q} responses={responses} />)}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-[8mm] mt-[9mm]">
          {changesQ && <TopList title="Breytingar sem þátttakendur hafa gert" q={changesQ} responses={responses} limit={6} />}
          <div className="space-y-[5mm]">
            {helpedQ && <TopList title="Það sem hjálpaði mest" q={helpedQ} responses={responses} limit={3} />}
            {supportQ && <TopList title="Óskir um áframhaldandi stuðning" q={supportQ} responses={responses} limit={3} />}
          </div>
        </div>

        <Footer page={1}>
          {firstSent ? `Könnunin var send ${fmtDate(firstSent)}. ` : ""}Svör: {n} af {sent}. Niðurstöður byggja á sjálfsmati
          þátttakenda en ekki á klínískum mælingum. Hlutföll eru reiknuð af þeim sem svöruðu hverri spurningu.
        </Footer>
      </A4>

      {/* ── Page 2: stories ── */}
      <A4 demo={demo} page={2}>
        <Header org={org} subtitle="Frásagnir þátttakenda" />
        <div className="rounded-[4mm] px-[8mm] py-[6mm] text-white" style={{ background: "linear-gradient(120deg,#047857 0%,#10B981 100%)" }}>
          <p className="text-[8.5pt] uppercase tracking-[0.12em] opacity-80">{survey.title_is}</p>
          <h1 className="text-[20pt] font-bold leading-tight mt-[1mm]">Í þeirra eigin orðum</h1>
          <p className="text-[10pt] mt-[1.5mm] opacity-90">Frásagnir þátttakenda sem gáfu leyfi til birtingar</p>
        </div>
        <StoryGrid stories={stories} />
        <div className="mt-[5mm] rounded-[3mm] bg-emerald-50 border border-emerald-100 px-[6mm] py-[4mm] flex items-center justify-between gap-[6mm]">
          <p className="text-[9.5pt] text-emerald-900 leading-snug">
            <span className="font-semibold">Takk fyrir samstarfið.</span> Lifeline Health þakkar þátttakendum kærlega fyrir
            þátttökuna og gott samstarf.
          </p>
          <p className="text-[8.5pt] text-emerald-800 whitespace-nowrap text-right">contact@lifelinehealth.is<br />lifelinehealth.is</p>
        </div>
        <Footer page={2}>
          Frásagnir eru birtar með samþykki þátttakenda og óbreyttar. Fornafn er aðeins birt þar sem sérstakt leyfi var veitt.
        </Footer>
      </A4>
    </>
  );
}

function A4({ children, demo, page }: { children: React.ReactNode; demo: boolean; page: number }) {
  return (
    <div
      className="a4 relative bg-white shadow-lg overflow-hidden flex flex-col text-[#1F2937]"
      style={{ width: "210mm", height: "297mm", padding: "12mm 14mm 10mm", fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      data-page={page}
    >
      {children}
      {demo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[54pt] font-black tracking-widest text-amber-500/25 -rotate-[30deg] whitespace-nowrap">SÝNISHORN</span>
        </div>
      )}
    </div>
  );
}

function Header({ subtitle, org }: { subtitle: string; org: string }) {
  return (
    <div className="flex items-end justify-between pb-[4mm] mb-[5mm] border-b-[0.6mm] border-emerald-600">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lifeline-logo-rebrand.svg" alt="Lifeline Health" style={{ height: "8mm", width: "auto" }} />
      <div className="text-right">
        <div className="text-[9pt] font-semibold text-emerald-700">{org}</div>
        <div className="text-[8pt] text-gray-500">{subtitle}</div>
      </div>
    </div>
  );
}

function Footer({ children, page }: { children: React.ReactNode; page: number }) {
  return (
    <div className="mt-auto pt-[3mm] border-t border-gray-200 flex items-end justify-between gap-[6mm] text-[7pt] text-gray-500 leading-snug">
      <p className="max-w-[150mm]">{children}</p>
      <p className="whitespace-nowrap">lifelinehealth.is · {page}/2</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11pt] font-bold text-[#1F2937] mb-[2mm]">{children}</h2>;
}

function DivergingLegend({ labels }: { labels: string[] }) {
  // Legend uses the neutral wording of the scale (first question's labels).
  return (
    <div className="flex flex-wrap gap-x-[4mm] gap-y-[1mm] text-[7.5pt] text-gray-600">
      {[5, 4, 3, 2, 1].map((v, i) => (
        <span key={v} className="inline-flex items-center gap-[1.5mm]">
          <span className="inline-block rounded-[0.8mm]" style={{ width: "3mm", height: "3mm", background: LIKERT_COLOR[v] }} />
          {labels[i] ?? v}
        </span>
      ))}
    </div>
  );
}

function DivergingRow({ label, q, responses }: { label: string; q: FeedbackQuestion; responses: ResponseRow[] }) {
  const { n, counts, top2 } = likertDist(responses, q);
  return (
    <div className="grid items-center gap-[3mm]" style={{ gridTemplateColumns: "38mm 1fr 24mm" }}>
      <div className="text-[9pt] font-medium">{label}</div>
      <div className="flex h-[7mm] gap-[0.5mm] rounded-[1mm] overflow-hidden bg-gray-100">
        {n > 0 && [5, 4, 3, 2, 1].map((v) => {
          const p = (counts[v] / n) * 100;
          if (p === 0) return null;
          return (
            <div
              key={v}
              className="h-full flex items-center justify-center text-[7pt] font-semibold"
              style={{ width: `${p}%`, background: LIKERT_COLOR[v], color: LIKERT_TEXT[v] }}
              title={`${(q.options_jsonb || []).find((o) => o.value === String(v))?.label_is ?? v}: ${counts[v]} (${Math.round(p)}%)`}
            >
              {p >= 8 ? `${Math.round(p)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="text-[8pt] text-gray-600 text-right">
        <span className="text-[10pt] font-bold text-emerald-700">{top2}%</span> jákvætt
      </div>
    </div>
  );
}

function TopList({ title, q, responses, limit }: { title: string; q: FeedbackQuestion; responses: ResponseRow[]; limit: number }) {
  const { respondents, rows } = multiTop(responses, q, limit);
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-[8.5pt] text-gray-400">Engin svör enn.</p>
      ) : (
        <div className="space-y-[2.8mm]">
          {rows.map((r) => {
            const p = pct(r.n, respondents);
            return (
              <div key={r.label} title={`${r.label}: ${r.n} af ${respondents}`}>
                <div className="flex justify-between text-[8.5pt] leading-tight">
                  <span>{r.label}</span>
                  <span className="font-semibold text-gray-700 ml-[2mm]">{p}%</span>
                </div>
                <div className="h-[2.4mm] mt-[0.8mm] rounded-[1mm] bg-gray-100">
                  <div className="h-full rounded-[1mm] bg-emerald-500" style={{ width: `${Math.max(p, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StoryGrid({ stories }: { stories: Story[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [stories]);

  if (stories.length === 0) {
    return <p className="mt-[8mm] text-[10pt] text-gray-400">Engar frásagnir hafa borist enn.</p>;
  }
  return (
    <div className="relative flex-1 min-h-0 mt-[6mm]">
      <div ref={ref} className="h-full overflow-hidden" style={{ columnCount: 2, columnGap: "6mm" }}>
        {stories.map((s) => (
          <figure key={s.id} className="mb-[5mm] rounded-[3mm] bg-emerald-50/70 border-l-[1mm] border-emerald-500 px-[5mm] py-[4mm]" style={{ breakInside: "avoid" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="mb-[2mm]" style={{ width: "6mm", height: "6mm" }}>
              <path fill="#34D399" d="M9.6 5C6 6.6 3.5 9.8 3.5 14.2c0 3 1.8 4.8 4 4.8 2 0 3.5-1.5 3.5-3.5S9.6 12 7.7 12c-.4 0-.8.1-1 .2.4-2.2 2-4.2 4-5.3L9.6 5zm10 0c-3.6 1.6-6.1 4.8-6.1 9.2 0 3 1.8 4.8 4 4.8 2 0 3.5-1.5 3.5-3.5s-1.4-3.5-3.3-3.5c-.4 0-.8.1-1 .2.4-2.2 2-4.2 4-5.3L19.6 5z" />
            </svg>
            <blockquote className="text-[9.5pt] leading-relaxed text-gray-800">{s.text}</blockquote>
            <figcaption className="mt-[2mm] text-[8pt] font-semibold text-emerald-700">— {s.firstName ?? "Þátttakandi"}</figcaption>
          </figure>
        ))}
      </div>
      {overflow && (
        <p className="print:hidden absolute bottom-0 inset-x-0 bg-amber-100 text-amber-900 text-[8pt] px-[3mm] py-[1.5mm] rounded">
          Frásagnirnar komast ekki allar fyrir á síðunni — taktu hakið af einhverjum þeirra í listanum fyrir ofan.
        </p>
      )}
    </div>
  );
}

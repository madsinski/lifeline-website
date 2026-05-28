"use client";

// Internal recruiting document: job description + compensation proposal
// for the Framkvæmdastjóri (Managing Director) role. Presentation-ready
// layout with the Lifeline wordmark, inline-editable fields, and a
// "Print / Save as PDF" action.
//
// Edits persist to localStorage (per browser) — this is a single shared
// draft used internally, not a multi-user record, so no Supabase table /
// API route is needed. Print isolation (@media print) hides the admin
// chrome so only the document prints.

import { useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "lifeline-job-description-framkvaemdastjori-v1";

interface DocFields {
  starfsheiti: string;
  yfirmadur: string;
  stadsetning: string;
  starfshlutfall: string;
  applicantName: string;
  draftDate: string;
  // Compensation — proposal column (also drives the headline cards)
  salary: string;
  bonus: string;
  equity: string;
  vesting: string;
  startDate: string;
  // Compensation — agreed column
  salaryAgreed: string;
  bonusAgreed: string;
  equityAgreed: string;
  vestingAgreed: string;
  startAgreed: string;
}

const DEFAULTS: DocFields = {
  starfsheiti: "Framkvæmdastjóri",
  yfirmadur: "Stofnendur / stjórn",
  stadsetning: "Reykjavík / fjarvinna",
  starfshlutfall: "100%",
  applicantName: "Elvar Páll Sigursson",
  draftDate: "28. maí 2026",
  salary: "1.300.000 – 1.700.000 kr.",
  bonus: "10–20% af árslaunum",
  equity: "1,5% – 3%",
  vesting: "2 ár, enginn cliff",
  startDate: "",
  salaryAgreed: "",
  bonusAgreed: "",
  equityAgreed: "",
  vestingAgreed: "",
  startAgreed: "",
};

const TASKS: [string, string][] = [
  ["Daglegur rekstur", "skipulag, ferlar og samhæfing teymisins frá degi til dags."],
  ["Sala til fyrirtækja (B2B)", "byggja upp sölupípu, ná samningum við vinnuveitendur, tryggingafélög og samstarfsaðila í heilbrigðisgeira, fylgja sölumarkmiðum eftir."],
  ["Launatengd mál", "útreikningur og afgreiðsla launa, samskipti við launakerfi (Payday), staðgreiðslu, lífeyrissjóði og stéttarfélög."],
  ["Reikningar og bókhald", "útgáfa reikninga, eftirfylgni krafna, samskipti við bókara/endurskoðanda, innsýn í sjóðstreymi."],
  ["Stuðningur við vöruþróun", "aðstoða stofnenda og þróunarteymi við forgangsröðun og prófanir á vef og appi; miðla ábendingum skjólstæðinga inn í þróunarferlið."],
  ["Þýðingar og efnisframleiðsla", "yfirferð og þýðing texta á íslensku/ensku þegar við á (markaðsefni, vörutextar, samningar, samskipti)."],
  ["Tengiliður skjólstæðinga", "fyrsta línan fyrir lykilskjólstæðinga og samstarfsaðila; tryggja framúrskarandi upplifun og endurgjöf til teymisins."],
  ["Markaðsmál", "halda utan um markaðsáætlun, samfélagsmiðla, herferðir og samstarf, í samvinnu við stofnendur."],
];

const REQUIREMENTS: string[] = [
  "Reynsla af rekstri og/eða sölu — helst í heilbrigðisþjónustu eða tæknifyrirtækjum.",
  "Sterkur skilningur á fjármálum (P&L, sjóðstreymi, reikningagerð).",
  "Frumkvæði og sjálfstæð vinnubrögð; þrífst í minna teymi þar sem hver ber margvíslega ábyrgð.",
  "Mjög góð íslenska og enska, bæði í tali og rituðu máli.",
  "Þægileg framkoma og hæfni í samskiptum við skjólstæðinga, lækna og samstarfsaðila.",
  "Tæknilæsi — getur lesið mockup, gefið innsendingar á þróunaratriði og skilið grunnatriði í vef/app vinnu.",
];

// ─── Business-plan projections (reference figures the proposal is based
// on). Static — these come from the plan, not the recruiter. Enterprise
// value = Total EBITDA × 10. Equity values are derived from EV so they
// always reconcile with the table above.
const BP_YEARS = ["2027", "2028", "2029", "2030", "2031"] as const;

const BP_EBITDA: { label: string; vals: number[]; total?: boolean }[] = [
  { label: "Health Check EBITDA", vals: [20977400, 56888155, 78370541, 101572416, 125712759] },
  { label: "Coaching EBITDA", vals: [-2168573, 3594217, 53630949, 107740925, 197039067] },
  { label: "Heildar-EBITDA", vals: [18808827, 60482372, 132001490, 209313341, 322751826], total: true },
];

const BP_EV = [188088274, 604823716, 1320014903, 2093133409, 3227518257];

const BP_PCTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Icelandic thousands grouping with "." separator, e.g. 1880883 -> "1.880.883".
function fmtISK(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + s;
}

export default function JobDescriptionPage() {
  const [fields, setFields] = useState<DocFields>(DEFAULTS);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load the saved draft after mount — kept out of the initial render so the
  // server-rendered DEFAULTS match the client's first paint (no hydration
  // mismatch). The setState runs in an async callback, not synchronously in
  // the effect body.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const saved = JSON.parse(raw) as Partial<DocFields>;
          setFields((p) => ({ ...p, ...saved }));
        }
      } catch {
        /* ignore corrupt storage */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist from the change handler (not an effect) so we never overwrite
  // storage with defaults before the saved draft has loaded.
  const persist = (next: DocFields) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
    setSavedFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(false), 1200);
  };

  const set = (k: keyof DocFields) => (v: string) => {
    const next = { ...fields, [k]: v };
    setFields(next);
    persist(next);
  };

  const resetDraft = () => {
    if (confirm("Endurstilla skjalið í sjálfgefin gildi? Breytingar tapast.")) {
      setFields(DEFAULTS);
      persist(DEFAULTS);
    }
  };

  return (
    <div className="px-8 py-6">
      {/* Print isolation + field styling. In print mode we hide the admin
          chrome and strip input borders so the document reads as a clean
          page rather than a form. */}
      <style>{`
        .jd-input { background: transparent; border: 0; border-bottom: 1px dashed #cbd5e1; padding: 1px 2px; font: inherit; color: inherit; width: 100%; outline: none; }
        .jd-input:focus { border-bottom-color: #10b981; background: #ecfdf5; }
        .jd-input::placeholder { color: #9ca3af; }
        @media print {
          body * { visibility: hidden !important; }
          #jobdoc, #jobdoc * { visibility: visible !important; }
          #jobdoc { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; margin: 0 !important; }
          .jd-noprint { display: none !important; }
          .jd-input { border: 0 !important; background: transparent !important; }
          @page { margin: 16mm; }
        }
      `}</style>

      {/* Toolbar — not part of the printed document */}
      <div className="jd-noprint max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Verkefnalýsing — Framkvæmdastjóri</h1>
          <p className="text-sm text-gray-500">
            Reitir með brotalínu eru ritstýranlegir. Breytingar vistast sjálfkrafa í þennan vafra.
            {savedFlash && <span className="text-emerald-600 font-medium"> · Vistað</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={resetDraft}
            className="text-xs font-medium px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Endurstilla
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Prenta / Vista sem PDF
          </button>
        </div>
      </div>

      {/* ─── The document ─────────────────────────────────────────────── */}
      <div
        id="jobdoc"
        className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 px-12 py-10 text-[15px] leading-relaxed text-gray-800"
      >
        {/* Header */}
        <div className="border-b-[3px] border-emerald-600 pb-5 mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lifeline-logo-rebrand.svg" alt="Lifeline" className="h-7 w-auto mb-5" />
          <h2 className="text-3xl font-bold text-gray-900 leading-tight">
            Verkefnalýsing — <EditInline value={fields.starfsheiti} onChange={set("starfsheiti")} className="inline-block min-w-[180px] align-baseline" />
          </h2>
          <p className="text-gray-500 mt-1">Starfslýsing og kjör</p>
          <span className="inline-block mt-4 text-[12.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            Drög til yfirferðar · <EditInline value={fields.draftDate} onChange={set("draftDate")} className="inline-block min-w-[90px]" />
          </span>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 border border-gray-200 rounded-lg overflow-hidden mb-9">
          <MetaCell label="Starfsheiti" value={fields.starfsheiti} onChange={set("starfsheiti")} br />
          <MetaCell label="Fyrirtæki" value="Lifeline" readOnly br />
          <MetaCell label="Yfirmaður" value={fields.yfirmadur} onChange={set("yfirmadur")} br />
          <MetaCell label="Staðsetning" value={fields.stadsetning} onChange={set("stadsetning")} br />
          <MetaCell label="Starfshlutfall" value={fields.starfshlutfall} onChange={set("starfshlutfall")} />
          <MetaCell label="Nafn umsækjanda" value={fields.applicantName} onChange={set("applicantName")} />
        </div>

        {/* Um starfið */}
        <Section title="Um starfið">
          <p>
            Lifeline leitar að framkvæmdastjóra til að leiða daglegan rekstur og halda utan um vöxt
            fyrirtækisins. Þú vinnur náið með stofnendum og teyminu, ert tengiliður við skjólstæðinga
            og samstarfsaðila, og berð ábyrgð á því að reksturinn gangi snurðulaust á meðan þjónustan stækkar.
          </p>
        </Section>

        {/* Helstu verkefni */}
        <Section title="Helstu verkefni">
          <ul className="space-y-0">
            {TASKS.map(([t, d]) => (
              <li key={t} className="relative pl-6 py-2.5 border-b border-gray-100 last:border-0">
                <span className="absolute left-1 top-[18px] w-2 h-2 rounded-full bg-emerald-600" />
                <strong className="text-gray-900">{t}</strong> — {d}
              </li>
            ))}
          </ul>
        </Section>

        {/* Hæfniskröfur */}
        <Section title="Hæfniskröfur">
          <ul className="list-disc pl-5 space-y-1.5">
            {REQUIREMENTS.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>

        {/* Kjör */}
        <Section title="Kjör — tillaga">
          <div className="bg-emerald-50 border-l-4 border-emerald-600 rounded-r-lg px-5 py-4 mb-5">
            <strong className="text-emerald-700">Forsenda:</strong> ~3,2 ma. ISK er <em>framtíðarmarkmið</em>{" "}
            (heildar-EBITDA × 10 árið 2031, sjá rekstraráætlun hér að neðan), <strong>ekki verðmat í dag</strong>.
            Verðmat félagsins núna er mun lægra. Því á prósentan að vera hærri (starfsmaðurinn tekur áhættu snemma)
            og krónutalan er „upside“-sagan — næst aðeins ef áætlanir ganga eftir.
          </div>

          {/* Headline cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card label="Grunnlaun / mán." value={fields.salary} onChange={set("salary")} note="+ lífeyrir & hlunnindi" />
            <Card label="Bónus" value={fields.bonus} onChange={set("bonus")} note="árangurstengt" />
            <Card label="Eignarhlutur" value={fields.equity} onChange={set("equity")} note="vesting 2 ár, enginn cliff" />
          </div>

          <p className="mb-2"><strong>Eignarhlutur við undirritun:</strong></p>
          <ul className="list-disc pl-5 space-y-1.5 mb-2">
            <li><strong>Framtíðarupphæð (rekstraráætlun 2031):</strong> 1% ≈ 32 m.kr., 2% ≈ 65 m.kr., 3% ≈ 97 m.kr. — aðeins ef áætlanir ganga eftir (sjá töflu hér að neðan).</li>
            <li><strong>Virði í dag er mun lægra</strong> (núverandi verðmat), sem er einmitt ástæðan fyrir hærri prósentu.</li>
            <li>„Við undirritun“ þýðir <strong>úthlutun (grant) með vesting</strong>, ekki að hluturinn skipti um hendur samdægurs: <strong>2 ára vesting, enginn cliff</strong> (1/24 á mánuði), good/bad-leaver ákvæði, og skoða má kaupréttarsamning (options) í stað beinnar úthlutunar.</li>
          </ul>
        </Section>

        {/* Forsendur úr rekstraráætlun */}
        <Section title="Forsendur — rekstraráætlun">
          <p className="mb-3 text-gray-600">
            Tillagan byggir á eftirfarandi tölum úr rekstraráætlun (allar fjárhæðir í ISK). Verðmat miðast við
            heildar-EBITDA margfaldað með 10.
          </p>

          {/* EBITDA + enterprise value */}
          <table className="w-full border-collapse text-[12px] tabular-nums mb-6">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="px-2.5 py-2 text-left font-semibold uppercase text-[11px] tracking-wide rounded-tl-md">ISK</th>
                {BP_YEARS.map((y, i) => (
                  <th key={y} className={`px-2.5 py-2 text-right font-semibold ${i === BP_YEARS.length - 1 ? "rounded-tr-md" : ""}`}>{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BP_EBITDA.map((row) => (
                <tr key={row.label} className={row.total ? "bg-emerald-50 font-semibold" : "even:bg-gray-50/70"}>
                  <td className="px-2.5 py-2 border-b border-gray-200 text-left text-gray-700">{row.label}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} className={`px-2.5 py-2 border-b border-gray-200 text-right ${v < 0 ? "text-red-600" : ""}`}>{fmtISK(v)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-2.5 py-2 border-b border-gray-200 text-left text-gray-500">EBITDA-margfaldari</td>
                {BP_YEARS.map((y) => (
                  <td key={y} className="px-2.5 py-2 border-b border-gray-200 text-right text-gray-500">10×</td>
                ))}
              </tr>
              <tr className="bg-gray-100 font-bold text-gray-900">
                <td className="px-2.5 py-2 text-left">Verðmat (EV)</td>
                {BP_EV.map((v, i) => (
                  <td key={i} className="px-2.5 py-2 text-right">{fmtISK(v)}</td>
                ))}
              </tr>
            </tbody>
          </table>

          <p className="mb-3 text-gray-600">
            Virði eignarhlutar eftir hlutfalli og ári (= verðmat × hlutfall). Tillagða bilið
            <strong> 1,5%–3%</strong> er auðkennt.
          </p>

          {/* Equity value by percentage */}
          <table className="w-full border-collapse text-[11px] tabular-nums">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide rounded-tl-md">Hlutur</th>
                {BP_YEARS.map((y, i) => (
                  <th key={y} className={`px-2 py-2 text-right font-semibold ${i === BP_YEARS.length - 1 ? "rounded-tr-md" : ""}`}>{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BP_PCTS.map((pct) => {
                const inRange = pct >= 1 && pct <= 3;
                return (
                  <tr key={pct} className={inRange ? "bg-emerald-50" : "even:bg-gray-50/70"}>
                    <td className={`px-2 py-1.5 border-b border-gray-200 text-left ${inRange ? "font-semibold text-emerald-800" : "text-gray-700"}`}>{pct}%</td>
                    {BP_EV.map((ev, i) => (
                      <td key={i} className={`px-2 py-1.5 border-b border-gray-200 text-right ${inRange ? "font-semibold text-emerald-800" : ""}`}>{fmtISK(ev * pct / 100)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-gray-400">
            Tölur eru áætlanir, ekki loforð. Raunvirði ræðst af rekstri og markaðsaðstæðum og getur orðið hærra eða lægra.
          </p>
        </Section>

        {/* Samantekt kjara */}
        <Section title="Samantekt kjara">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="bg-gray-900 text-white text-left">
                <th className="px-3 py-2.5 font-semibold uppercase text-[12px] tracking-wide rounded-tl-md">Liður</th>
                <th className="px-3 py-2.5 font-semibold uppercase text-[12px] tracking-wide">Tillaga</th>
                <th className="px-3 py-2.5 font-semibold uppercase text-[12px] tracking-wide rounded-tr-md">Samið</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="Grunnlaun (mán.)" proposal={fields.salary} onProposal={set("salary")} agreed={fields.salaryAgreed} onAgreed={set("salaryAgreed")} />
              <SummaryRow label="Bónus" proposal={fields.bonus} onProposal={set("bonus")} agreed={fields.bonusAgreed} onAgreed={set("bonusAgreed")} />
              <SummaryRow label="Eignarhlutur" proposal={fields.equity} onProposal={set("equity")} agreed={fields.equityAgreed} onAgreed={set("equityAgreed")} />
              <SummaryRow label="Vesting" proposal={fields.vesting} onProposal={set("vesting")} agreed={fields.vestingAgreed} onAgreed={set("vestingAgreed")} />
              <SummaryRow label="Upphafsdagur" proposal={fields.startDate} onProposal={set("startDate")} agreed={fields.startAgreed} onAgreed={set("startAgreed")} proposalPlaceholder="—" />
            </tbody>
          </table>
        </Section>

        {/* Athugasemd */}
        <div className="mt-8 bg-[#fbf7f0] border border-[#efe3cf] rounded-lg px-6 py-5 text-[14px] text-[#5b4f3a]">
          <strong className="text-[#7a5c1e]">Athugasemd.</strong> Þetta eru viðmið — endanleg laun og hlutur
          ráðast af reynslu viðkomandi og samkomulagi við aðra hluthafa. Mælt er sterklega með að bera
          vesting-fyrirkomulag og skattalega meðferð undir endurskoðanda og lögmann áður en samningur er
          undirritaður — sérstaklega muninn á beinni hlutaúthlutun, kaupréttarsamningi og phantom shares,
          sem getur skipt tugum milljóna í skatti fyrir starfsmanninn.
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-[12.5px] text-gray-400">
          <span>Lifeline — Verkefnalýsing framkvæmdastjóra</span>
          <span>Trúnaðarmál · Drög</span>
        </div>
      </div>
    </div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="text-[13px] font-bold uppercase tracking-wider text-emerald-700 border-b border-gray-200 pb-2 mb-4">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetaCell({
  label, value, onChange, readOnly, br,
}: {
  label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean; br?: boolean;
}) {
  return (
    <div className={`px-4 py-3 border-b border-gray-200 ${br ? "border-r" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</div>
      {readOnly || !onChange ? (
        <div className="font-semibold text-gray-900">{value}</div>
      ) : (
        <input className="jd-input font-semibold text-gray-900" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Card({
  label, value, onChange, note,
}: {
  label: string; value: string; onChange: (v: string) => void; note: string;
}) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <input
        className="jd-input text-center text-[18px] font-bold text-emerald-700 mt-1.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="text-[12px] text-gray-500 mt-1">{note}</div>
    </div>
  );
}

function SummaryRow({
  label, proposal, onProposal, agreed, onAgreed, proposalPlaceholder,
}: {
  label: string;
  proposal: string; onProposal: (v: string) => void;
  agreed: string; onAgreed: (v: string) => void;
  proposalPlaceholder?: string;
}) {
  return (
    <tr className="even:bg-gray-50/70">
      <td className="px-3 py-2.5 border-b border-gray-200 text-gray-700">{label}</td>
      <td className="px-3 py-2.5 border-b border-gray-200">
        <input className="jd-input" value={proposal} onChange={(e) => onProposal(e.target.value)} placeholder={proposalPlaceholder} />
      </td>
      <td className="px-3 py-2.5 border-b border-gray-200">
        <input className="jd-input" value={agreed} onChange={(e) => onAgreed(e.target.value)} placeholder="—" />
      </td>
    </tr>
  );
}

function EditInline({
  value, onChange, className = "",
}: {
  value: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <input
      className={`jd-input ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: `${Math.max(value.length + 1, 6)}ch` }}
    />
  );
}

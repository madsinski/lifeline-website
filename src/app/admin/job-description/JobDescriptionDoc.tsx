// Shared recruiting document for the Framkvæmdastjóri role. Rendered by both
// the admin editor (/admin/job-description, editable) and the public
// password-gated mirror (/verkefnalysing, read-only). Keeping the body in one
// component means the two views never drift apart.
//
// Every text field is editable: in editable mode the parent passes `set`; in
// read-only mode it omits it and each field renders as plain text. The numeric
// business-plan tables are reference data and stay code-defined.

import type { ReactNode } from "react";
import PrintPortal from "./PrintPortal";

export interface DocFields {
  // Header + meta
  starfsheiti: string;
  subtitle: string;
  draftDate: string;
  fyrirtaeki: string;
  yfirmadur: string;
  stadsetning: string;
  starfshlutfall: string;
  applicantName: string;
  // Section titles
  aboutTitle: string;
  tasksTitle: string;
  kjorTitle: string;
  bpTitle: string;
  samantektTitle: string;
  // Prose
  about: string;
  tasks: string;           // one task per line, "Title — description"
  compStructure: string;   // amber callout
  forsenda: string;        // emerald callout
  equityBulletsTitle: string;
  equityBullets: string;   // one bullet per line
  bpIntro: string;
  bpEquityIntro: string;
  bpFootnote: string;
  athugasemd: string;
  footerLeft: string;
  footerRight: string;
  // Compensation — headline cards (value + note)
  salary: string;
  salaryNote: string;
  equity: string;
  equityNote: string;
  // Configurable labels for the comp cards + summary rows, so a doc whose
  // pay model isn't "monthly salary" (e.g. a per-client / equity role) can
  // relabel them. Default to the framkvæmdastjóri wording.
  salaryCardLabel: string;
  equityCardLabel: string;
  // Optional third headline card + how many cards to show (1–3).
  cardCount: string;
  card3Label: string;
  card3: string;
  card3Note: string;
  salaryRowLabel: string;
  salaryStartRowLabel: string;
  equityRowLabel: string;
  vestingRowLabel: string;
  startRowLabel: string;
  // Compensation — summary table (proposal + agreed)
  vesting: string;
  salaryStart: string;
  startDate: string;
  salaryAgreed: string;
  equityAgreed: string;
  vestingAgreed: string;
  salaryStartAgreed: string;
  startAgreed: string;
}

export const DEFAULTS: DocFields = {
  starfsheiti: "Framkvæmdastjóri",
  subtitle: "Starfslýsing og kjör",
  draftDate: "28. maí 2026",
  fyrirtaeki: "Lifeline",
  yfirmadur: "Stofnendur / stjórn",
  stadsetning: "Reykjavík / fjarvinna",
  starfshlutfall: "30–50% (í fyrstu)",
  applicantName: "Elvar Páll Sigursson",

  aboutTitle: "Um starfið",
  tasksTitle: "Helstu verkefni",
  kjorTitle: "Kjör — tillaga",
  bpTitle: "Forsendur — rekstraráætlun",
  samantektTitle: "Samantekt kjara",

  about:
    "Lifeline leitar að framkvæmdastjóra til að leiða daglegan rekstur og halda utan um vöxt fyrirtækisins. Þú vinnur náið með stofnendum og teyminu, ert tengiliður við skjólstæðinga og samstarfsaðila, og berð ábyrgð á því að reksturinn gangi snurðulaust á meðan þjónustan stækkar.",

  tasks: [
    "Daglegur rekstur — skipulag, ferlar og samhæfing teymisins frá degi til dags.",
    "Sala til fyrirtækja (B2B) — byggja upp sölupípu, ná samningum við vinnuveitendur, tryggingafélög og samstarfsaðila í heilbrigðisgeira, fylgja sölumarkmiðum eftir.",
    "Launatengd mál — útreikningur og afgreiðsla launa, samskipti við launakerfi (Payday), staðgreiðslu, lífeyrissjóði og stéttarfélög.",
    "Reikningar og bókhald — útgáfa reikninga, eftirfylgni krafna, samskipti við bókara/endurskoðanda, innsýn í sjóðstreymi.",
    "Stuðningur við vöruþróun — aðstoða stofnenda og þróunarteymi við forgangsröðun og prófanir á vef og appi; miðla ábendingum skjólstæðinga inn í þróunarferlið.",
    "Þýðingar og efnisframleiðsla — yfirferð og þýðing texta á íslensku/ensku þegar við á (markaðsefni, vörutextar, samningar, samskipti).",
    "Tengiliður skjólstæðinga — fyrsta línan fyrir lykilskjólstæðinga og samstarfsaðila; tryggja framúrskarandi upplifun og endurgjöf til teymisins.",
    "Markaðsmál — halda utan um markaðsáætlun, samfélagsmiðla, herferðir og samstarf, í samvinnu við stofnendur.",
  ].join("\n"),

  compStructure:
    "Uppbygging launakjara. Fyrstu 6–12 mánuði fær framkvæmdastjóri hlutafé í stað launa á meðan fyrstu heilsutékkar (Health Check) eru seldir og fyrirtækið byggir upp tekjur. Þegar nægt fjármagn hefur skilað sér samþykkir stjórn að hefja launagreiðslur. Starfshlutfall er 30–50% til að byrja með og getur aukist eftir umfangi og tekjum.",

  forsenda:
    "Forsenda: ~3,2 ma. ISK er framtíðarmarkmið (heildar-EBITDA × 10 árið 2031, sjá rekstraráætlun hér að neðan), ekki verðmat í dag. Verðmat félagsins núna er mun lægra. Því á prósentan að vera hærri (starfsmaðurinn tekur áhættu snemma) og krónutalan er „upside“-sagan — næst aðeins ef áætlanir ganga eftir.",

  equityBulletsTitle: "Eignarhlutur við undirritun:",
  equityBullets: [
    "Hlutafé í stað launa fyrstu 6–12 mánuði — endurgjald fyrir vinnu á meðan tekjur byggjast upp. Laun bætast við þegar stjórn samþykkir.",
    "Framtíðarupphæð (rekstraráætlun 2031): 1% ≈ 32 m.kr., 2% ≈ 65 m.kr., 3% ≈ 97 m.kr. — aðeins ef áætlanir ganga eftir (sjá töflu hér að neðan).",
    "Virði í dag er mun lægra (núverandi verðmat), sem er einmitt ástæðan fyrir hærri prósentu.",
    "„Við undirritun“ þýðir úthlutun (grant) með vesting, ekki að hluturinn skipti um hendur samdægurs: 2 ára vesting, enginn cliff (1/24 á mánuði), good/bad-leaver ákvæði, og skoða má kaupréttarsamning (options) í stað beinnar úthlutunar.",
  ].join("\n"),

  bpIntro:
    "Tillagan byggir á eftirfarandi tölum úr rekstraráætlun (allar fjárhæðir í ISK). Verðmat miðast við heildar-EBITDA margfaldað með 10.",
  bpEquityIntro:
    "Virði eignarhlutar eftir hlutfalli og ári (= verðmat × hlutfall). Tillagða bilið 1,5%–3% er auðkennt.",
  bpFootnote:
    "Tölur eru áætlanir, ekki loforð. Raunvirði ræðst af rekstri og markaðsaðstæðum og getur orðið hærra eða lægra.",

  athugasemd:
    "Þetta eru viðmið — endanleg laun og hlutur ráðast af reynslu viðkomandi og samkomulagi við aðra hluthafa. Mælt er sterklega með að bera vesting-fyrirkomulag og skattalega meðferð undir endurskoðanda og lögmann áður en samningur er undirritaður — sérstaklega muninn á beinni hlutaúthlutun, kaupréttarsamningi og phantom shares, sem getur skipt tugum milljóna í skatti fyrir starfsmanninn.",

  footerLeft: "Lifeline — Verkefnalýsing framkvæmdastjóra",
  footerRight: "Trúnaðarmál · Drög",

  salary: "1.300.000 – 1.700.000 kr.",
  salaryNote: "hefst v. samþykki stjórnar",
  equity: "1,5% – 3%",
  equityNote: "vesting 2 ár, enginn cliff",

  salaryCardLabel: "Grunnlaun / mán.",
  equityCardLabel: "Eignarhlutur",
  cardCount: "2",
  card3Label: "",
  card3: "",
  card3Note: "",
  salaryRowLabel: "Grunnlaun (mán.)",
  salaryStartRowLabel: "Launakjör hefjast",
  equityRowLabel: "Eignarhlutur",
  vestingRowLabel: "Vesting",
  startRowLabel: "Upphafsdagur",

  vesting: "2 ár, enginn cliff",
  salaryStart: "Við samþykki stjórnar (eftir 6–12 mán.)",
  startDate: "",
  salaryAgreed: "",
  equityAgreed: "",
  vestingAgreed: "",
  salaryStartAgreed: "",
  startAgreed: "",
};

// ─── Business-plan projections (reference figures). Static — Enterprise
// value = Total EBITDA × 10; equity values derived from EV so they reconcile.
const BP_YEARS = ["2027", "2028", "2029", "2030", "2031"] as const;

const BP_EBITDA: { label: string; vals: number[]; total?: boolean }[] = [
  { label: "Health Check EBITDA", vals: [20977400, 56888155, 78370541, 101572416, 125712759] },
  { label: "Coaching EBITDA", vals: [-2168573, 3594217, 53630949, 107740925, 197039067] },
  { label: "Heildar-EBITDA", vals: [18808827, 60482372, 132001490, 209313341, 322751826], total: true },
];

const BP_EV = [188088274, 604823716, 1320014903, 2093133409, 3227518257];

const BP_PCTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function fmtISK(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + s;
}

// Bold the lead phrase of a list line up to the first " — " separator.
function leadBold(line: string): ReactNode {
  const idx = line.indexOf(" — ");
  if (idx === -1) return line;
  return (
    <>
      <strong className="text-gray-900">{line.slice(0, idx)}</strong>
      {line.slice(idx)}
    </>
  );
}

// Like leadBold, but for a top-level heading: when there is no " — "
// separator the whole line is bolded, so a main bullet always reads as a
// heading even when it carries no inline description.
function headingBold(line: string): ReactNode {
  if (line.indexOf(" — ") === -1) {
    return <strong className="text-gray-900">{line}</strong>;
  }
  return leadBold(line);
}

const splitLines = (s: string) => s.split("\n").filter((l) => l.trim().length > 0);

// Group task lines into top-level items with optional sub-bullets. A line
// that begins with whitespace (indentation) or a "- " / "• " / "– " marker
// becomes a sub-bullet of the item above it; everything else starts a new
// top-level item.
function parseTaskGroups(s: string): { main: string; subs: string[] }[] {
  const groups: { main: string; subs: string[] }[] = [];
  for (const raw of s.split("\n")) {
    if (raw.trim().length === 0) continue;
    const isSub = /^\s+/.test(raw) || /^\s*[-•–]\s+/.test(raw);
    const text = raw.replace(/^\s*[-•–]\s+/, "").trim();
    if (isSub && groups.length > 0) {
      groups[groups.length - 1].subs.push(text);
    } else {
      groups.push({ main: text, subs: [] });
    }
  }
  return groups;
}

export function JobDescriptionDoc({
  fields,
  set,
  readOnly = false,
  embedded = false,
  title,
  onTitleChange,
}: {
  fields: DocFields;
  set?: (k: keyof DocFields) => (v: string) => void;
  readOnly?: boolean;
  // Rendered inside another container (the print portal or an on-screen
  // preview modal): don't emit the global <style> or a nested print portal.
  embedded?: boolean;
  // The document title — shown as the heading and on the password page.
  // The same value as the admin "Titill skjals" field, so they always match.
  title?: string;
  onTitleChange?: (v: string) => void;
}) {
  const on = (k: keyof DocFields): ((v: string) => void) | undefined =>
    readOnly || !set ? undefined : set(k);
  const editing = !readOnly && !!set;

  // How many headline cards to show under "Kjör" (1–3, default 2).
  const cardCount = Math.min(3, Math.max(1, parseInt(fields.cardCount || "2", 10) || 2));
  const cardGridCols = cardCount === 1 ? "grid-cols-1" : cardCount === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <>
      {!embedded && <style>{`
        .jd-input { background: transparent; border: 0; border-bottom: 1px dashed #cbd5e1; padding: 1px 2px; font: inherit; color: inherit; width: 100%; outline: none; }
        .jd-input:focus { border-bottom-color: #10b981; background: #ecfdf5; }
        .jd-input::placeholder { color: #9ca3af; }
        .jd-area { display: block; width: 100%; background: transparent; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 6px 8px; font: inherit; color: inherit; outline: none; resize: vertical; field-sizing: content; }
        .jd-area:focus { border-color: #10b981; background: #ecfdf5; }
        /* A borderless textarea that wraps and auto-grows, so a long value
           (title, starfsheiti, etc.) shows in full instead of scrolling off
           a single line. */
        .jd-wrap-input { display: block; width: 100%; background: transparent; border: 0; border-bottom: 1px dashed #cbd5e1; padding: 1px 2px; margin: 0; font: inherit; color: inherit; outline: none; resize: none; overflow: hidden; field-sizing: content; }
        .jd-wrap-input:focus { border-bottom-color: #10b981; background: #ecfdf5; }
        .jd-wrap-input::placeholder { color: #9ca3af; }
        .jd-hint { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
        /* The clean read-only copy used for printing is hidden on screen. */
        .jd-print-portal { display: none; }
        @media print {
          /* Print only the portal copy. It is a direct <body> child in
             normal flow, so it paginates naturally — unlike an absolutely
             positioned block, which Chrome clips after the first page. We
             also print plain text/lists/tables (not the editable form,
             whose textareas get clipped at page breaks). */
          body > *:not(.jd-print-portal) { display: none !important; }
          .jd-print-portal { display: block !important; }
          .jd-print-portal .jd-doc { box-shadow: none !important; border: 0 !important; margin: 0 auto !important; }
          @page { margin: 16mm; }

          /* Keep discrete blocks from being sliced across a page break.
             (We deliberately do NOT avoid breaks on whole <section>
             chapters — that left half-page gaps. Sharing the online link
             is the recommended way to send this; print is a fallback.) */
          .jd-print-portal .jd-block { break-inside: avoid; }
          /* A heading must stay with the content that follows it. */
          .jd-print-portal h2, .jd-print-portal h3 { break-after: avoid; }
          /* Tables may span pages, but never split a row, and repeat the
             header row at the top of each continuation page. */
          .jd-print-portal table { break-inside: auto; }
          .jd-print-portal thead { display: table-header-group; }
          .jd-print-portal tr, .jd-print-portal li { break-inside: avoid; }
        }
      `}</style>}

      <div
        className="jd-doc max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 px-12 py-10 text-[15px] leading-relaxed text-gray-800"
      >
        {/* Header */}
        <div className="jd-block border-b-[3px] border-emerald-600 pb-5 mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lifeline-logo-rebrand.svg" alt="Lifeline" className="h-7 w-auto mb-5" />
          <h2 className="text-3xl font-bold text-gray-900 leading-tight">
            {onTitleChange ? (
              <textarea
                className="jd-wrap-input"
                rows={1}
                value={title ?? ""}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Titill skjals"
              />
            ) : (
              (title && title.trim()) || fields.starfsheiti
            )}
          </h2>
          <p className="text-gray-500 mt-1"><EditInline value={fields.subtitle} onChange={on("subtitle")} className="inline-block min-w-[160px]" /></p>
          <span className="inline-block mt-4 text-[12.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            Drög til yfirferðar · <EditInline value={fields.draftDate} onChange={on("draftDate")} className="inline-block min-w-[90px]" />
          </span>
        </div>

        {/* Meta grid */}
        <div className="jd-block grid grid-cols-2 border border-gray-200 rounded-lg overflow-hidden mb-9">
          <MetaCell label="Starfsheiti" value={fields.starfsheiti} onChange={on("starfsheiti")} br />
          <MetaCell label="Fyrirtæki" value={fields.fyrirtaeki} onChange={on("fyrirtaeki")} br />
          <MetaCell label="Yfirmaður" value={fields.yfirmadur} onChange={on("yfirmadur")} br />
          <MetaCell label="Staðsetning" value={fields.stadsetning} onChange={on("stadsetning")} br />
          <MetaCell label="Starfshlutfall" value={fields.starfshlutfall} onChange={on("starfshlutfall")} />
          <MetaCell label="Nafn umsækjanda" value={fields.applicantName} onChange={on("applicantName")} />
        </div>

        {/* Um starfið */}
        <Section title={fields.aboutTitle} onTitleChange={on("aboutTitle")}>
          <EditBlock value={fields.about} onChange={on("about")} rows={3} />
        </Section>

        {/* Helstu verkefni */}
        <Section title={fields.tasksTitle} onTitleChange={on("tasksTitle")}>
          {editing ? (
            <>
              <p className="jd-hint">Ein lína = eitt atriði. Byrjaðu línu á bili (eða „- “) til að gera hana að undirpunkti. Texti á undan „ — “ verður feitletraður.</p>
              <EditBlock value={fields.tasks} onChange={on("tasks")} rows={11} />
            </>
          ) : (
            <ul className="space-y-0">
              {parseTaskGroups(fields.tasks).map((g, i) => {
                const hasSubs = g.subs.length > 0;
                return (
                  <li
                    key={i}
                    className={`relative pl-6 py-2.5 last:border-0 ${hasSubs ? "" : "border-b border-gray-100"}`}
                  >
                    <span className="absolute left-1 top-[18px] w-2 h-2 rounded-full bg-emerald-600" />
                    {headingBold(g.main)}
                    {hasSubs && (
                      <ul className="mt-2 space-y-1.5">
                        {g.subs.map((s, j) => (
                          <li key={j} className="relative pl-6 text-[14px] text-gray-600">
                            <span className="absolute left-[7px] top-[8px] w-1.5 h-1.5 rounded-full border border-emerald-500 bg-transparent" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Kjör */}
        <Section title={fields.kjorTitle} onTitleChange={on("kjorTitle")}>
          <div className="jd-block bg-amber-50 border-l-4 border-amber-500 rounded-r-lg px-5 py-4 mb-5 text-amber-900">
            <EditBlock value={fields.compStructure} onChange={on("compStructure")} rows={4} />
          </div>

          <div className="jd-block bg-emerald-50 border-l-4 border-emerald-600 rounded-r-lg px-5 py-4 mb-5">
            <EditBlock value={fields.forsenda} onChange={on("forsenda")} rows={4} />
          </div>

          {/* Headline cards — 1 to 3, configurable. Each card's header is
              editable. */}
          {editing && (
            <div className="jd-hint flex items-center gap-2 mb-2">
              <span>Fjöldi korta:</span>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => on("cardCount")?.(String(n))}
                  className={`px-2 py-0.5 rounded border text-[12px] ${
                    cardCount === n
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <div className={`jd-block grid ${cardGridCols} gap-3 mb-6`}>
            <Card label={fields.salaryCardLabel || "Grunnlaun / mán."} onLabelChange={on("salaryCardLabel")} value={fields.salary} onChange={on("salary")} note={fields.salaryNote} onNoteChange={on("salaryNote")} />
            {cardCount >= 2 && (
              <Card label={fields.equityCardLabel || "Eignarhlutur"} onLabelChange={on("equityCardLabel")} value={fields.equity} onChange={on("equity")} note={fields.equityNote} onNoteChange={on("equityNote")} />
            )}
            {cardCount >= 3 && (
              <Card label={fields.card3Label || "Liður"} onLabelChange={on("card3Label")} value={fields.card3} onChange={on("card3")} note={fields.card3Note} onNoteChange={on("card3Note")} />
            )}
          </div>

          <p className="mb-2 font-semibold">
            <EditInline value={fields.equityBulletsTitle} onChange={on("equityBulletsTitle")} className="inline-block min-w-[200px]" />
          </p>
          {editing ? (
            <>
              <p className="jd-hint">Ein lína = einn punktur. Texti á undan „ — “ verður feitletraður.</p>
              <EditBlock value={fields.equityBullets} onChange={on("equityBullets")} rows={7} />
            </>
          ) : (
            <ul className="list-disc pl-5 space-y-1.5 mb-2">
              {splitLines(fields.equityBullets).map((line, i) => (
                <li key={i}>{leadBold(line)}</li>
              ))}
            </ul>
          )}
        </Section>

        {/* Forsendur úr rekstraráætlun */}
        <Section title={fields.bpTitle} onTitleChange={on("bpTitle")}>
          <div className="mb-3 text-gray-600">
            <EditBlock value={fields.bpIntro} onChange={on("bpIntro")} rows={2} />
          </div>

          {/* EBITDA + enterprise value (reference numbers, not editable) */}
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

          <div className="mb-3 text-gray-600">
            <EditBlock value={fields.bpEquityIntro} onChange={on("bpEquityIntro")} rows={2} />
          </div>

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
          <div className="mt-2 text-[12px] text-gray-400">
            <EditBlock value={fields.bpFootnote} onChange={on("bpFootnote")} rows={2} />
          </div>
        </Section>

        {/* Samantekt kjara */}
        <Section title={fields.samantektTitle} onTitleChange={on("samantektTitle")}>
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="bg-gray-900 text-white text-left">
                <th className="px-3 py-2.5 font-semibold uppercase text-[12px] tracking-wide rounded-tl-md">Liður</th>
                <th className="px-3 py-2.5 font-semibold uppercase text-[12px] tracking-wide">Tillaga</th>
                <th className="px-3 py-2.5 font-semibold uppercase text-[12px] tracking-wide rounded-tr-md">Samið</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label={fields.salaryRowLabel || "Grunnlaun (mán.)"} proposal={fields.salary} onProposal={on("salary")} agreed={fields.salaryAgreed} onAgreed={on("salaryAgreed")} />
              <SummaryRow label={fields.salaryStartRowLabel || "Launakjör hefjast"} proposal={fields.salaryStart} onProposal={on("salaryStart")} agreed={fields.salaryStartAgreed} onAgreed={on("salaryStartAgreed")} />
              <SummaryRow label={fields.equityRowLabel || "Eignarhlutur"} proposal={fields.equity} onProposal={on("equity")} agreed={fields.equityAgreed} onAgreed={on("equityAgreed")} />
              <SummaryRow label={fields.vestingRowLabel || "Vesting"} proposal={fields.vesting} onProposal={on("vesting")} agreed={fields.vestingAgreed} onAgreed={on("vestingAgreed")} />
              <SummaryRow label={fields.startRowLabel || "Upphafsdagur"} proposal={fields.startDate} onProposal={on("startDate")} agreed={fields.startAgreed} onAgreed={on("startAgreed")} proposalPlaceholder="—" />
            </tbody>
          </table>
        </Section>

        {/* Athugasemd */}
        <div className="jd-block mt-8 bg-[#fbf7f0] border border-[#efe3cf] rounded-lg px-6 py-5 text-[14px] text-[#5b4f3a]">
          <strong className="text-[#7a5c1e]">Athugasemd.</strong>{" "}
          <EditBlock value={fields.athugasemd} onChange={on("athugasemd")} rows={4} className="inline-block align-top" />
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between gap-4 text-[12.5px] text-gray-400">
          <EditInline value={fields.footerLeft} onChange={on("footerLeft")} className="min-w-[180px]" />
          <EditInline value={fields.footerRight} onChange={on("footerRight")} className="min-w-[100px] text-right" />
        </div>
      </div>

      {/* A clean read-only copy, portalled to <body>, used only for
          printing. Plain text/lists/tables paginate properly, unlike the
          editable form's textareas. Rendered for every top-level instance
          (editor and public mirror) so both print cleanly. */}
      {!embedded && (
        <PrintPortal>
          <JobDescriptionDoc fields={fields} readOnly embedded title={title} />
        </PrintPortal>
      )}
    </>
  );
}

// ─── Building blocks ────────────────────────────────────────────────

function Section({
  title, onTitleChange, children,
}: {
  title: string; onTitleChange?: (v: string) => void; children: ReactNode;
}) {
  return (
    <section className="mb-7">
      <h3 className="text-[13px] font-bold uppercase tracking-wider text-emerald-700 border-b border-gray-200 pb-2 mb-4">
        {onTitleChange ? (
          <input className="jd-input uppercase" value={title} onChange={(e) => onTitleChange(e.target.value)} />
        ) : (
          title
        )}
      </h3>
      {children}
    </section>
  );
}

function MetaCell({
  label, value, onChange, br,
}: {
  label: string; value: string; onChange?: (v: string) => void; br?: boolean;
}) {
  return (
    <div className={`px-4 py-3 border-b border-gray-200 ${br ? "border-r" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</div>
      {onChange ? (
        <textarea className="jd-wrap-input font-semibold text-gray-900" rows={1} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="font-semibold text-gray-900">{value}</div>
      )}
    </div>
  );
}

function Card({
  label, onLabelChange, value, onChange, note, onNoteChange,
}: {
  label: string; onLabelChange?: (v: string) => void;
  value: string; onChange?: (v: string) => void; note: string; onNoteChange?: (v: string) => void;
}) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
      {onLabelChange ? (
        <input
          className="jd-input text-center text-[11px] uppercase tracking-wide text-gray-500"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
        />
      ) : (
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      )}
      {onChange ? (
        <input
          className="jd-input text-center text-[18px] font-bold text-emerald-700 mt-1.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="text-[18px] font-bold text-emerald-700 mt-1.5">{value}</div>
      )}
      {onNoteChange ? (
        <input className="jd-input text-center text-[12px] text-gray-500 mt-1" value={note} onChange={(e) => onNoteChange(e.target.value)} />
      ) : (
        <div className="text-[12px] text-gray-500 mt-1">{note}</div>
      )}
    </div>
  );
}

function SummaryRow({
  label, proposal, onProposal, agreed, onAgreed, proposalPlaceholder,
}: {
  label: string;
  proposal: string; onProposal?: (v: string) => void;
  agreed: string; onAgreed?: (v: string) => void;
  proposalPlaceholder?: string;
}) {
  return (
    <tr className="even:bg-gray-50/70">
      <td className="px-3 py-2.5 border-b border-gray-200 text-gray-700">{label}</td>
      <td className="px-3 py-2.5 border-b border-gray-200">
        {onProposal ? (
          <input className="jd-input" value={proposal} onChange={(e) => onProposal(e.target.value)} placeholder={proposalPlaceholder} />
        ) : (
          <span>{proposal || proposalPlaceholder || "—"}</span>
        )}
      </td>
      <td className="px-3 py-2.5 border-b border-gray-200">
        {onAgreed ? (
          <input className="jd-input" value={agreed} onChange={(e) => onAgreed(e.target.value)} placeholder="—" />
        ) : (
          <span>{agreed || "—"}</span>
        )}
      </td>
    </tr>
  );
}

function EditInline({
  value, onChange, className = "",
}: {
  value: string; onChange?: (v: string) => void; className?: string;
}) {
  if (!onChange) return <span className={className}>{value}</span>;
  return (
    <input
      className={`jd-input ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: `${Math.max(value.length + 1, 6)}ch` }}
    />
  );
}

function EditBlock({
  value, onChange, rows = 3, className = "",
}: {
  value: string; onChange?: (v: string) => void; rows?: number; className?: string;
}) {
  if (!onChange) return <span className={`whitespace-pre-wrap ${className}`}>{value}</span>;
  return (
    <textarea
      className={`jd-area ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
    />
  );
}

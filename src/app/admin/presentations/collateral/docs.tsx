// The three Fjarlækningar print documents for the HSU pilot, each rendered as a
// single A4 portrait page (`.a4`) from an editable CollateralContent object (see
// content.ts). Icelandic, patient- / staff-facing. Framed on the HSU pilot's
// asynchronous questionnaire model. Shared brand styling lives in
// collateral-css.ts; the logo assets live in /public.

import type { CollateralContent } from "./content";

export type DocId = "poster" | "referral" | "advert";

export const DOC_META: { id: DocId; name: string; sub: string }[] = [
  { id: "poster", name: "Veggspjald", sub: "Fyrir móttöku HSU — fyrir sjúklinga" },
  { id: "referral", name: "Tilvísunarleiðbeiningar", sub: "A4 — fyrir heilbrigðisstarfsfólk" },
  { id: "advert", name: "Blaðaauglýsing", sub: "A4 — dagblaðsauglýsing" },
];

function ico(icon: string) {
  // Icons matching the live Medalia patient portal, normalised onto white tiles.
  return `/fjarlaekningar-icons/portal/${icon}.png`;
}

function FjarLogo({ onDark = false }: { onDark?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="fjar-logo"
      src={onDark ? "/fjarlaekningar-logo-white.svg" : "/fjarlaekningar-logo.svg"}
      alt="Fjarlækningar"
    />
  );
}

// ── 1. Reception poster ──────────────────────────────────────────────────
function Poster({ c }: { c: CollateralContent }) {
  const p = c.poster;
  return (
    <div className="a4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11mm 14mm 6mm" }}>
        <FjarLogo />
        <span className="pill tint dot">{p.badge}</span>
      </div>

      <div className="hero" style={{ padding: "12mm 14mm 13mm", margin: "0 14mm", borderRadius: "6mm" }}>
        <div className="eyebrow" style={{ marginBottom: "4mm" }}>{p.eyebrow}</div>
        <h1 style={{ fontSize: "40px", maxWidth: "150mm" }}>
          {p.headingA}<br />{p.headingB} <span style={{ color: "#5fe0ff" }}>{p.headingAccent}</span>
        </h1>
        <p style={{ marginTop: "5mm", fontSize: "14px", lineHeight: 1.5, maxWidth: "150mm" }}>{p.lead}</p>
      </div>

      <div style={{ padding: "10mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "5mm" }}>{p.servicesTitle}</h2>
        <div className="svc-grid">
          {c.services.map((s, i) => (
            <div className="svc" key={`${s.icon}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ico(s.icon)} alt="" />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "9mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "5mm" }}>{p.stepsTitle}</h2>
        <div className="steps row">
          {p.steps.map((st, i) => (
            <div className="step" key={i}>
              <div className="n">{i + 1}</div>
              <h3>{st.title}</h3>
              <p>{st.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "9mm 14mm 11mm" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8mm", borderTop: "1px solid var(--line)", paddingTop: "6mm" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6mm" }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fjarlaekningar-qr-medalia.svg" alt="QR — sjúklingagátt Fjarlækninga"
                style={{ width: "28mm", height: "28mm", display: "block", border: "1px solid var(--line)", borderRadius: "2mm", padding: "1.5mm", background: "#fff" }} />
              <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "1.5mm", fontWeight: 600 }}>Skannaðu til að opna</div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: "2mm" }}>{p.ctaLabel}</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--ink)" }} className="grad-text">{p.url}</div>
              <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2mm" }}>{p.footerNote}</p>
            </div>
          </div>
          <div className="safety" style={{ textAlign: "right", justifyContent: "flex-end" }}>
            <span><b>{p.safety.bold}</b>{p.safety.text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 2. Internal referral guide (for HSU staff) ───────────────────────────
function Referral({ c }: { c: CollateralContent }) {
  const r = c.referral;
  return (
    <div className="a4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11mm 14mm 5mm" }}>
        <FjarLogo />
        <span className="pill solid">{r.badge}</span>
      </div>

      <div style={{ padding: "0 14mm" }}>
        <div className="eyebrow" style={{ marginBottom: "3mm" }}>{r.eyebrow}</div>
        <h1 style={{ fontSize: "27px", maxWidth: "165mm" }}>
          {r.heading}<span className="grad-text">{r.headingAccent}</span>
        </h1>
        <p style={{ marginTop: "3.5mm", fontSize: "12px", lineHeight: 1.5, color: "var(--body)", maxWidth: "170mm" }}>{r.intro}</p>
      </div>

      <div style={{ padding: "7mm 14mm 0" }}>
        <div className="cols2">
          <div className="panel yes">
            <h3>{r.yesTitle}</h3>
            <ul className="ticklist">{r.yes.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          <div className="panel no">
            <h3>{r.noTitle}</h3>
            <ul className="ticklist">{r.no.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        </div>
      </div>

      <div style={{ padding: "7mm 14mm 0" }}>
        <h2 style={{ fontSize: "14px", marginBottom: "4mm" }}>{r.referTitle}</h2>
        <div className="steps row">
          {r.referSteps.map((st, i) => (
            <div className="step" key={i}>
              <div className="n">{i + 1}</div>
              <h3>{st.title}</h3>
              <p>{st.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "7mm 14mm 0" }}>
        <h2 style={{ fontSize: "14px", marginBottom: "4mm" }}>{r.afterTitle}</h2>
        <div className="rows">
          {r.after.map((a, i) => (
            <div className="rowitem" key={i}>
              <span className="k">{a.k}</span>
              <span className="t"><b>{a.bold}</b>{a.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "8mm 14mm 11mm" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8mm", borderTop: "1px solid var(--line)", paddingTop: "5mm" }}>
          <div className="safety"><span><b>{r.safety.bold}</b>{r.safety.text}</span></div>
          <div style={{ fontSize: "11px", color: "var(--muted)", textAlign: "right" }}>
            {r.contactLabel} <b style={{ color: "var(--ink)" }}>{r.contactEmail}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3. Newspaper advert ──────────────────────────────────────────────────
function Advert({ c }: { c: CollateralContent }) {
  const a = c.advert;
  return (
    <div className="a4">
      <div className="hero" style={{ padding: "16mm 16mm 15mm" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12mm" }}>
          <FjarLogo onDark />
          <span className="pill" style={{ background: "rgba(255,255,255,.14)", color: "#eafaff" }}>{a.badge}</span>
        </div>
        <h1 style={{ fontSize: "46px", color: "#fff", maxWidth: "165mm" }}>
          {a.headingA}<br /><span style={{ color: "#5fe0ff" }}>{a.headingAccent}</span>
        </h1>
        <p style={{ marginTop: "6mm", fontSize: "15px", lineHeight: 1.5, maxWidth: "160mm" }}>{a.lead}</p>
      </div>

      <div style={{ padding: "11mm 16mm 0" }}>
        <div className="eyebrow" style={{ marginBottom: "4mm" }}>{a.servicesTitle}</div>
        <div className="svc-chips">
          {c.services.map((s, i) => (
            <span className="chip" key={`${s.icon}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ico(s.icon)} alt="" />{s.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "11mm 16mm 0" }}>
        <div className="steps row">
          {a.steps.map((st, i) => (
            <div className="step" key={i}>
              <div className="n">{i + 1}</div>
              <h3>{st.title}</h3>
              <p>{st.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto" }}>
        <div style={{ margin: "0 16mm 6mm", padding: "8mm 9mm", borderRadius: "5mm", background: "var(--wash)", border: "1px solid #cdeef7", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8mm" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: "2mm" }}>{a.ctaLabel}</div>
            <div className="grad-text" style={{ fontSize: "32px", fontWeight: 800 }}>{a.url}</div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--body)", maxWidth: "70mm", textAlign: "right" }}>{a.partnerNote}</p>
        </div>
        <div style={{ padding: "0 16mm 13mm" }}>
          <div className="safety"><span><b>{a.safety.bold}</b>{a.safety.text}</span></div>
        </div>
      </div>
    </div>
  );
}

export function CollateralDoc({ doc, content }: { doc: DocId; content: CollateralContent }) {
  if (doc === "referral") return <Referral c={content} />;
  if (doc === "advert") return <Advert c={content} />;
  return <Poster c={content} />;
}

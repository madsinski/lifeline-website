// The Fjarlækningar print documents for the HSU pilot. Each is a single A4
// portrait page (`.a4`) rendered from a Doc (see content.ts). The collateral is
// a dynamic list, so a document is duplicatable/deletable in the studio. Shared
// brand styling lives in collateral-css.ts; logos live in /public.

import qrcode from "qrcode-generator";
import type {
  Doc,
  PosterFields,
  ReferralFields,
  AdvertFields,
} from "./content";

function ico(icon: string) {
  // Icons matching the live Medalia patient portal, normalised onto white tiles.
  return `/fjarlaekningar-icons/portal/${icon}.png`;
}

// Isomorphic QR (browser-safe, no Buffer): renders the matrix as an SVG path so
// it regenerates live from an editable URL on both server and client.
function QrSvg({ value, size = "26mm" }: { value: string; size?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value || " ");
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return (
    <svg viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" aria-hidden
      style={{ width: size, height: size, display: "block" }}>
      <rect width={n} height={n} fill="#ffffff" />
      <path d={d} fill="#0b1220" />
    </svg>
  );
}

// Render a free-form heading: line breaks split lines; ==double equals== wraps
// blue-coloured words. Everything else stays the hero default (white).
function renderHeading(text: string) {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {line.split(/==(.+?)==/g).map((part, i) =>
        i % 2 === 1
          ? <span key={i} style={{ color: "#5fe0ff" }}>{part}</span>
          : <span key={i}>{part}</span>,
      )}
    </span>
  ));
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
function Poster({ p }: { p: PosterFields }) {
  return (
    <div className="a4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11mm 14mm 6mm" }}>
        <FjarLogo />
        <span className="pill tint dot">{p.badge}</span>
      </div>

      <div className="hero" style={{ padding: "10mm 14mm 10mm", margin: "0 14mm", borderRadius: "6mm" }}>
        <div className="eyebrow" style={{ marginBottom: "3.5mm" }}>{p.eyebrow}</div>
        <h1 style={{ fontSize: "31px", maxWidth: "155mm" }}>{renderHeading(p.heading)}</h1>
        <p style={{ marginTop: "4mm", fontSize: "13px", lineHeight: 1.5, maxWidth: "155mm", color: "#cdeefb" }}>{p.lead}</p>
      </div>

      <div style={{ padding: "8mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "4mm" }}>{p.servicesTitle}</h2>
        <div className="svc-grid">
          {p.services.map((s, i) => (
            <div className="svc" key={`${s.icon}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ico(s.icon)} alt="" />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "5mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "4mm" }}>{p.stepsTitle}</h2>
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

      <div style={{ marginTop: "auto", padding: "8mm 14mm 10mm" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8mm", borderTop: "1px solid var(--line)", paddingTop: "6mm" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6mm" }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ border: "1px solid var(--line)", borderRadius: "2mm", padding: "1.5mm", background: "#fff" }}>
                <QrSvg value={p.portalUrl} size="26mm" />
              </div>
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
function Referral({ r }: { r: ReferralFields }) {
  return (
    <div className="a4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9mm 14mm 4mm" }}>
        <FjarLogo />
        <span className="pill solid">{r.badge}</span>
      </div>

      <div style={{ padding: "0 14mm" }}>
        <div className="eyebrow" style={{ marginBottom: "2.5mm" }}>{r.eyebrow}</div>
        <h1 style={{ fontSize: "26px", maxWidth: "165mm" }}>
          {r.heading}<span className="grad-text">{r.headingAccent}</span>
        </h1>
        <p style={{ marginTop: "3mm", fontSize: "11.5px", lineHeight: 1.45, color: "var(--body)", maxWidth: "172mm" }}>{r.intro}</p>
      </div>

      <div style={{ padding: "5mm 14mm 0" }}>
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

      <div style={{ padding: "5mm 14mm 0" }}>
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

      <div style={{ padding: "5mm 14mm 0" }}>
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

      {/* Three ways to share the service with a patient */}
      <div style={{ padding: "5mm 14mm 0" }}>
        <h2 style={{ fontSize: "14px", marginBottom: "3mm" }}>{r.shareTitle}</h2>
        <div style={{ display: "flex", alignItems: "stretch", gap: "5mm", padding: "4mm 5mm", borderRadius: "4mm", background: "var(--wash)", border: "1px solid #cdeef7" }}>
          <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "3mm" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: "1mm" }}>1 · Vefslóð</div>
              <div className="grad-text" style={{ fontSize: "18px", fontWeight: 800 }}>{r.url}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow" style={{ marginBottom: "1mm" }}>2 · Beinn tengill</div>
              <div style={{ fontSize: "9.5px", color: "var(--body)", wordBreak: "break-all", lineHeight: 1.3, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}>{r.portalUrl}</div>
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0, borderLeft: "1px solid #cdeef7", paddingLeft: "5mm", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div className="eyebrow" style={{ marginBottom: "1.5mm" }}>3 · QR-kóði</div>
            <div style={{ border: "1px solid var(--line)", borderRadius: "2mm", padding: "1mm", background: "#fff" }}>
              <QrSvg value={r.portalUrl} size="18mm" />
            </div>
            <div style={{ fontSize: "8.5px", color: "var(--muted)", marginTop: "1mm", fontWeight: 600 }}>Skannaðu</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "6mm 14mm 9mm" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8mm", borderTop: "1px solid var(--line)", paddingTop: "4mm" }}>
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
function Advert({ a }: { a: AdvertFields }) {
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
          {a.services.map((s, i) => (
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
        <div style={{ margin: "0 16mm 6mm", padding: "8mm 9mm", borderRadius: "5mm", background: "var(--wash)", border: "1px solid #cdeef7", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "7mm" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: "2mm" }}>{a.ctaLabel}</div>
            <div className="grad-text" style={{ fontSize: "32px", fontWeight: 800 }}>{a.url}</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ background: "#fff", borderRadius: "2mm", padding: "1mm", display: "inline-block" }}>
              <QrSvg value={a.portalUrl} size="24mm" />
            </div>
            <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "1.5mm", fontWeight: 600 }}>Skannaðu til að opna</div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--body)", maxWidth: "50mm", textAlign: "right" }}>{a.partnerNote}</p>
        </div>
        <div style={{ padding: "0 16mm 13mm" }}>
          <div className="safety"><span><b>{a.safety.bold}</b>{a.safety.text}</span></div>
        </div>
      </div>
    </div>
  );
}

export function CollateralDoc({ doc }: { doc: Doc }) {
  if (doc.type === "referral") return <Referral r={doc.referral} />;
  if (doc.type === "advert") return <Advert a={doc.advert} />;
  return <Poster p={doc.poster} />;
}

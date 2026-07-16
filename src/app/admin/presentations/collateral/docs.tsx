// The Fjarlækningar print documents for the HSU pilot. Each is a single A4
// portrait page (`.a4`) rendered from a Doc (see content.ts). The collateral is
// a dynamic list, so a document is duplicatable/deletable in the studio. Shared
// brand styling lives in collateral-css.ts; logos live in /public.

import qrcode from "qrcode-generator";
import {
  Clock, Pill, Undo2, Lock, FileText, Stethoscope, ShieldCheck,
  Send, CheckCircle2, Bell, MessageSquare, House,
  PersonStanding, HeartPulse, Droplet, Gauge, ClipboardCheck, Smartphone,
  type LucideIcon,
} from "lucide-react";

// Curated lucide set for the referral "what happens next" markers.
const AFTER_ICONS: Record<string, LucideIcon> = {
  clock: Clock, pill: Pill, undo: Undo2, lock: Lock, doc: FileText,
  stethoscope: Stethoscope, shield: ShieldCheck, send: Send,
  check: CheckCircle2, bell: Bell, message: MessageSquare, home: House,
};
export const AFTER_ICON_KEYS = Object.keys(AFTER_ICONS);

// Lucide set for the Lifeline health-check benefits.
const BENEFIT_ICONS: Record<string, LucideIcon> = {
  body: PersonStanding, heart: HeartPulse, drop: Droplet, gauge: Gauge,
  report: ClipboardCheck, app: Smartphone, stethoscope: Stethoscope,
  shield: ShieldCheck, check: CheckCircle2, clock: Clock,
};
export const BENEFIT_ICON_KEYS = Object.keys(BENEFIT_ICONS);
import type {
  Doc,
  PosterFields,
  ReferralFields,
  AdvertFields,
  LifelineFields,
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
function renderHeading(text: string, accent = "#5fe0ff") {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {line.split(/==(.+?)==/g).map((part, i) =>
        i % 2 === 1
          ? <span key={i} style={{ color: accent }}>{part}</span>
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

// HSU co-brand lockup — "Í samstarfi við HSU" + their logo. The print-friendly
// adaptation of the website's HSU cooperation section.
function HsuCobrand({ label = "Í samstarfi við HSU", height = "11mm" }: { label?: string; height?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
      <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", textAlign: "right", lineHeight: 1.25, maxWidth: "30mm" }}>{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hsu-logo.webp" alt="Heilbrigðisstofnun Suðurlands" style={{ height, width: "auto", display: "block" }} />
    </div>
  );
}

// ── 1. Reception poster ──────────────────────────────────────────────────
function Poster({ p }: { p: PosterFields }) {
  return (
    <div className="a4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11mm 14mm 6mm" }}>
        <FjarLogo />
        <HsuCobrand label={p.badge} />
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

      <div style={{ padding: "4mm 14mm 0" }}>
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
        <HsuCobrand />
      </div>

      <div style={{ padding: "0 14mm" }}>
        <div className="eyebrow" style={{ marginBottom: "2.5mm" }}>{r.eyebrow}</div>
        <h1 style={{ fontSize: "26px", maxWidth: "165mm" }}>
          {r.heading}<span className="grad-text">{r.headingAccent}</span>
        </h1>
        <p style={{ marginTop: "2.5mm", fontSize: "11px", lineHeight: 1.4, color: "var(--body)", maxWidth: "172mm" }}>{r.intro}</p>
      </div>

      <div style={{ padding: "4mm 14mm 0" }}>
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

      <div style={{ padding: "4mm 14mm 0" }}>
        <div className="sec-rule" />
        <h2 className="sec-h2">{r.referTitle}</h2>
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

      <div style={{ padding: "4mm 14mm 0" }}>
        <div className="sec-rule" />
        <h2 className="sec-h2">{r.afterTitle}</h2>
        <div className="rows">
          {r.after.map((a, i) => {
            const Ico = a.icon ? AFTER_ICONS[a.icon] : undefined;
            return (
              <div className="rowitem" key={i}>
                <span className="k">{Ico ? <Ico size={17} strokeWidth={2.2} /> : a.k}</span>
                <span className="t"><b>{a.bold}</b>{a.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Three ways to share the service with a patient */}
      <div style={{ padding: "4mm 14mm 0" }}>
        <div className="sec-rule" />
        <h2 className="sec-h2">{r.shareTitle}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "4mm", alignItems: "stretch" }}>
          <div className="share-card">
            <div className="share-head"><span className="share-n">1</span><span className="eyebrow">Vefslóð</span></div>
            <div className="grad-text" style={{ fontSize: "18px", fontWeight: 800 }}>{r.url}</div>
            <div className="share-note">Sláðu inn í vafra</div>
          </div>
          <div className="share-card">
            <div className="share-head"><span className="share-n">2</span><span className="eyebrow">Beinn tengill</span></div>
            <div style={{ fontSize: "9.5px", color: "var(--body)", wordBreak: "break-all", lineHeight: 1.35, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}>{r.portalUrl}</div>
            <div className="share-note">Deildu tenglinum beint</div>
          </div>
          <div className="share-card" style={{ alignItems: "center", textAlign: "center" }}>
            <div className="share-head"><span className="share-n">3</span><span className="eyebrow">QR-kóði</span></div>
            <div style={{ border: "1px solid var(--line)", borderRadius: "2mm", padding: "1mm", background: "#fff" }}>
              <QrSvg value={r.portalUrl} size="15mm" />
            </div>
            <div className="share-note" style={{ fontWeight: 700 }}>Skannaðu</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "4mm 14mm 7mm" }}>
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

      <div style={{ marginTop: "auto", padding: "9mm 16mm 13mm" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8mm", borderTop: "1px solid var(--line)", paddingTop: "7mm" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6mm" }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ border: "1px solid var(--line)", borderRadius: "2mm", padding: "1.5mm", background: "#fff" }}>
                <QrSvg value={a.portalUrl} size="26mm" />
              </div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "1.5mm", fontWeight: 600 }}>Skannaðu til að opna</div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: "2mm" }}>{a.ctaLabel}</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--ink)" }} className="grad-text">{a.url}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "2.5mm", marginTop: "2.5mm" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/hsu-logo.webp" alt="Heilbrigðisstofnun Suðurlands" style={{ height: "9mm", width: "auto", flexShrink: 0 }} />
                <p style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "55mm" }}>{a.partnerNote}</p>
              </div>
            </div>
          </div>
          <div className="safety" style={{ textAlign: "right", justifyContent: "flex-end" }}>
            <span><b>{a.safety.bold}</b>{a.safety.text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 4. Lifeline × Lyfja health-check poster ──────────────────────────────
function LifelinePoster({ l }: { l: LifelineFields }) {
  const EM = "#10B981", EM_DARK = "#047857", EM_DEEP = "#065f46";
  const MINT = "#6ee7b7";
  return (
    <div className="a4" style={{ color: "#334155" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11mm 14mm 5mm" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lifeline-logo-rebrand.svg" alt="Lifeline" style={{ height: "9mm", width: "auto", display: "block" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
          <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280" }}>{l.cobrandLabel}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/partner-lyfja.png" alt="Lyfja" style={{ height: "11mm", width: "auto", display: "block" }} />
        </div>
      </div>

      <div style={{ margin: "0 14mm", borderRadius: "6mm", padding: "9mm 13mm", color: "#fff", position: "relative", overflow: "hidden", flexShrink: 0,
        background: "radial-gradient(120% 120% at 85% -10%, rgba(52,211,153,.5), transparent 55%), linear-gradient(135deg," + EM_DEEP + "," + EM_DARK + ")" }}>
        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: MINT, marginBottom: "3.5mm" }}>{l.eyebrow}</div>
        <h1 style={{ fontSize: "31px", maxWidth: "150mm", color: "#fff" }}>{renderHeading(l.heading, MINT)}</h1>
        <p style={{ marginTop: "4mm", fontSize: "13px", lineHeight: 1.5, maxWidth: "150mm", color: "rgba(255,255,255,.92)" }}>{l.lead}</p>
      </div>

      <div style={{ padding: "5mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "4mm" }}>{l.benefitsTitle}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3.5mm" }}>
          {l.benefits.map((b, i) => {
            const Ico = BENEFIT_ICONS[b.icon];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "3.5mm", padding: "3mm 4mm", borderRadius: "3.5mm", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <span style={{ flex: "0 0 auto", width: "9mm", height: "9mm", borderRadius: "2.5mm", display: "flex", alignItems: "center", justifyContent: "center", background: EM, color: "#fff" }}>
                  {Ico ? <Ico size={19} strokeWidth={2} /> : null}
                </span>
                <div>
                  <div style={{ fontSize: "12.5px", fontWeight: 800, color: "#065f46", lineHeight: 1.15 }}>{b.label}</div>
                  {b.detail ? <div style={{ fontSize: "10.5px", color: "#475569", lineHeight: 1.2, marginTop: "0.5mm" }}>{b.detail}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "5mm 14mm 0" }}>
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "4mm", padding: "4mm 6mm" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: EM_DARK, marginBottom: "1.5mm" }}>{l.whyTitle}</div>
          <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#334155" }}>{l.why}</p>
        </div>
      </div>

      <div style={{ padding: "5mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "4mm" }}>{l.stepsTitle}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "4mm" }}>
          {l.steps.map((st, i) => (
            <div key={i}>
              <div style={{ width: "7.5mm", height: "7.5mm", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg," + EM + ",#34d399)", color: "#fff", fontWeight: 800, fontSize: "12px", marginBottom: "2.2mm" }}>{i + 1}</div>
              <h3 style={{ margin: "0 0 1mm", fontSize: "12px", fontWeight: 800, color: "#0f2733" }}>{st.title}</h3>
              <p style={{ margin: 0, fontSize: "10.5px", lineHeight: 1.32, color: "#334155" }}>{st.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "7mm 14mm 10mm" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8mm", borderRadius: "5mm", padding: "7mm 8mm", color: "#fff",
          background: "linear-gradient(135deg," + EM_DEEP + "," + EM_DARK + ")" }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ background: "#fff", borderRadius: "2.5mm", padding: "2mm" }}>
              <QrSvg value={l.portalUrl} size="30mm" />
            </div>
            <div style={{ fontSize: "10px", marginTop: "1.5mm", fontWeight: 700, color: "#ecfdf5" }}>{l.ctaLabel}</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: MINT, marginBottom: "2mm" }}>Byrjaðu hér</div>
            <div style={{ fontSize: "23px", fontWeight: 800, lineHeight: 1.12, marginBottom: "2.5mm" }}>{l.ctaHeading}</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#d1fae5" }}>{l.url}</div>
            <p style={{ fontSize: "10.5px", color: "rgba(255,255,255,.82)", marginTop: "2.5mm", maxWidth: "85mm" }}>{l.footerNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollateralDoc({ doc }: { doc: Doc }) {
  if (doc.type === "referral") return <Referral r={doc.referral} />;
  if (doc.type === "advert") return <Advert a={doc.advert} />;
  if (doc.type === "lifelinecheck") return <LifelinePoster l={doc.lifeline} />;
  return <Poster p={doc.poster} />;
}

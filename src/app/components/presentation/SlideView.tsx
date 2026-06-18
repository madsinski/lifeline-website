/* eslint-disable @next/next/no-img-element -- deck renders CMS/storage/full-bleed imagery where next/image's layout constraints don't fit; plain <img> is intentional. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { Slide, MemberItem, IconKey } from "@/lib/presentations/types";
import { DeckDefs, Logo, Icon } from "./DeckAssets";

export { DeckDefs };

/** Extra slide class for a non-default brand (drives palette + logo colour). */
export function brandClass(brand?: string): string {
  return brand === "fjarlaekningar" ? " brand-fjar" : brand === "worldclass" ? " brand-wc" : "";
}

// Render ==accent== markers as gradient spans and \n as line breaks.
function rich(text?: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts = line.split("==");
    return (
      <React.Fragment key={li}>
        {parts.map((p, i) =>
          i % 2 === 1 ? <span key={i} className="grad">{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>
        )}
        {li < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
}

function HeadTag({ tag }: { tag?: string }) {
  if (!tag) return null;
  if (/coming soon/i.test(tag)) {
    return <span className="badge-soon"><span className="dot" />{tag}</span>;
  }
  return <span className="tag-pill">{tag}</span>;
}

/** Enlarged phone mockup in a portal — the whole device frame scales up with
 *  the screenshot inside (not the bare image). Literal styles since it renders
 *  outside the .lldeck scope. Click / Escape closes. */
function PhoneLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt || "App screenshot"} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10060, background: "rgba(3,16,12,.93)", display: "grid", placeItems: "center", padding: "3vmin", cursor: "zoom-out" }}>
      <div style={{ height: "min(92vh, 820px)", aspectRatio: "9 / 19", border: "9px solid #0c100f", borderRadius: 40, overflow: "hidden", background: "#0c100f", boxShadow: "0 40px 90px -24px rgba(0,0,0,.85)" }}>
        <img src={src} alt={alt || ""} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
      </div>
    </div>,
    document.body
  );
}

function PhoneImg({ src, alt, zoomable }: { src?: string; alt?: string; zoomable?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const clickable = !!(zoomable && src);
  return (
    <>
      <div className={`phone-shot${clickable ? " is-zoomable" : ""}`} title={clickable ? "Smelltu til að stækka" : undefined}
        onClick={clickable ? () => setOpen(true) : undefined}>
        {src ? <img src={src} alt={alt || ""} /> : <div className="phone-ph">No image yet</div>}
      </div>
      {open && src && <PhoneLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function memberInitials(name?: string): string {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
}

function MemberCard({ m }: { m: MemberItem }) {
  return (
    <div className="member">
      {m.photo
        ? <img className="photo" src={m.photo} alt={m.name} />
        : <div className="photo ph-initials" aria-hidden>{memberInitials(m.name)}</div>}
      {m.flag && <span className="flag">{m.flag}</span>}
      <h4>{m.name}</h4>
      <span className="role">{m.role}</span>
    </div>
  );
}

type HighlightRect = { x: number; y: number; w: number; h: number };

// One "x,y,w,h" rect in % of the image, or null when malformed.
function parseHighlight(spec?: string): HighlightRect | null {
  if (!spec) return null;
  const n = spec.split(/[,\s]+/).filter(Boolean).map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [x, y, w, h] = n.map((v) => Math.max(0, Math.min(100, v)));
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

// Full highlight spec: one or more rects separated by ";".
function parseHighlights(spec?: string): HighlightRect[] {
  return (spec || "").split(";").map((part) => parseHighlight(part.trim())).filter((r): r is HighlightRect => !!r);
}

/** Spotlight boxes over a screenshot: brand-cyan outlines, everything outside
 *  the boxes dimmed by a single even-odd cut-out layer (so multiple boxes
 *  don't dim each other's interior). */
function HighlightBoxes({ rects }: { rects: HighlightRect[] }) {
  return (
    <>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <path
          d={`M0 0H100V100H0Z ${rects.map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`).join(" ")}`}
          fill="rgba(5,16,24,.45)"
          fillRule="evenodd"
        />
      </svg>
      {rects.map((r, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute", left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
            border: "3px solid var(--cyan, #22d3ee)", borderRadius: 6,
            boxShadow: "0 0 24px rgba(0,214,255,.35)",
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

/** Full-screen zoom for the report slide's laptop screenshot. Rendered in a
 *  portal so it escapes the deck's scaled / letterboxed containers. Click or
 *  Escape closes; the capture-phase listener keeps Escape from also closing
 *  the editor's preview overlay underneath. */
function Lightbox({ src, alt, highlights, onClose }: { src: string; alt: string; highlights: HighlightRect[]; onClose: () => void }) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot, full size"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10050, background: "rgba(3,14,20,.92)", display: "grid", placeItems: "center", padding: "3vmin", cursor: "zoom-out" }}
    >
      {/* The wrapper shrink-wraps the image, so highlight percentages map 1:1
          onto the rendered image box. */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 10, boxShadow: "0 24px 80px -20px rgba(0,0,0,.8)" }}>
        <img src={src} alt={alt} style={{ maxWidth: "94vw", maxHeight: "94vh", display: "block" }} />
        {highlights.length > 0 && <HighlightBoxes rects={highlights} />}
      </div>
    </div>,
    document.body
  );
}

/** Pulsing pill above the report laptop telling the audience the screenshot
 *  can be clicked open. Clicking the pill opens the lightbox too. */
function ZoomHint({ onClick }: { onClick: () => void }) {
  return (
    <span className="zoom-hint" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
      </svg>
      Smelltu á skjáinn til að stækka
    </span>
  );
}

/** Magnifier-plus glyph, shared by the zoom hint and hotspot badges. */
function ZoomGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}

/** Full-screen zoom into ONE region of an image, with an optional caption.
 *  Uses a background-image crop so the region fills the viewport crisply
 *  (needs a high-res master image). Portals to <body>, so colours are literal
 *  (CSS vars don't resolve outside the .lldeck scope). */
function FocusView({ src, rect, title, body, onClose }: { src: string; rect: HighlightRect; title?: string; body?: string; onClose: () => void }) {
  const [aspect, setAspect] = React.useState(16 / 9);
  React.useEffect(() => {
    const im = new window.Image();
    im.onload = () => { if (im.naturalHeight) setAspect(im.naturalWidth / im.naturalHeight); };
    im.src = src;
  }, [src]);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const rectAspect = aspect * (rect.w / rect.h);
  const bgSize = `${(10000 / rect.w).toFixed(2)}% ${(10000 / rect.h).toFixed(2)}%`;
  const bgPos = `${rect.w >= 100 ? 0 : (rect.x / (100 - rect.w) * 100).toFixed(2)}% ${rect.h >= 100 ? 0 : (rect.y / (100 - rect.h) * 100).toFixed(2)}%`;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title || "Focus area"} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10060, background: "rgba(3,16,12,.94)", display: "grid", placeItems: "center", padding: "4vmin", cursor: "zoom-out" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: "1.1rem", alignItems: "center", maxWidth: "94vw" }}>
        <div style={{ width: `min(94vw, ${(78 * rectAspect).toFixed(1)}vh)`, aspectRatio: String(rectAspect), maxHeight: "76vh",
          backgroundImage: `url(${src})`, backgroundSize: bgSize, backgroundPosition: bgPos, backgroundRepeat: "no-repeat",
          borderRadius: 14, border: "2px solid #34d399", boxShadow: "0 24px 80px -20px rgba(0,0,0,.85)" }} />
        {(title || body) && (
          <div style={{ textAlign: "center", color: "#eafaf3", maxWidth: "62ch" }}>
            {title && <div style={{ fontSize: "clamp(1.1rem,2.4vw,1.7rem)", fontWeight: 800 }}>{title}</div>}
            {body && <p style={{ marginTop: ".45rem", color: "#bfe7d8", fontSize: "clamp(.92rem,1.5vw,1.08rem)", lineHeight: 1.5 }}>{body}</p>}
          </div>
        )}
        <span style={{ fontSize: ".8rem", color: "#7fb8a6" }}>Smelltu til að loka · Esc</span>
      </div>
    </div>,
    document.body
  );
}

/** Full-bleed image slide. When interactive (zoomable), the image opens in a
 *  lightbox on click, and any focus areas become clickable zoom-in hotspots. */
function FullbleedView({ s, zoomable }: { s: Slide; zoomable?: boolean }) {
  const [focus, setFocus] = React.useState<number | null>(null);
  const [zoom, setZoom] = React.useState(false);
  const img = s.image;
  const spots = (zoomable && s.hotspots) ? s.hotspots : [];
  const objectFit = s.fit === "contain" ? "contain" : "cover";
  return (
    <div className="fullbleed">
      {img
        ? <img src={img} alt={s.heading || "Illustration"} style={{ objectFit, cursor: zoomable && !spots.length ? "zoom-in" : "default" }}
            onClick={zoomable && !spots.length ? () => setZoom(true) : undefined} />
        : <span className="hero-ph">No image yet</span>}
      {img && spots.map((h, i) => (
        <button key={i} type="button" className="fb-hotspot" aria-label={h.title || `Skoða svæði ${i + 1}`}
          style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }} onClick={() => setFocus(i)}>
          <span className="fb-hotspot-badge"><ZoomGlyph /></span>
        </button>
      ))}
      {(s.kicker || s.heading) && (
        <div className="fb-cap">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          {s.heading && <h2>{rich(s.heading)}</h2>}
        </div>
      )}
      {spots.length > 0 && <span className="fb-hint"><ZoomGlyph /> Smelltu á svæði til að skoða nánar</span>}
      {focus !== null && img && spots[focus] && (
        <FocusView src={img} rect={spots[focus]} title={spots[focus].title} body={spots[focus].body} onClose={() => setFocus(null)} />
      )}
      {zoom && img && <Lightbox src={img} alt={s.heading || "Illustration"} highlights={[]} onClose={() => setZoom(false)} />}
    </div>
  );
}

/** Renders the inner content of a single slide (without the <section> shell). */
function SlideBody({ s, zoomable }: { s: Slide; zoomable?: boolean }) {
  const [zoom, setZoom] = React.useState(false);
  switch (s.type) {
    case "title":
    case "closing":
      return (
        <div className="body center">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          {s.type === "title"
            ? <h1>{rich(s.heading)}</h1>
            : <h1 style={{ maxWidth: "16ch" }}>{rich(s.heading)}</h1>}
          {s.lead && <p className="lead" style={{ marginTop: "1.6rem" }}>{s.lead}</p>}
          {s.tagline && <p className="tagline" style={{ marginTop: "2.2rem" }}>{s.tagline}</p>}
        </div>
      );

    case "stats":
      return (
        <div className="body two">
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            {s.lead && <p className="lead" style={{ marginTop: "1.2rem" }}>{s.lead}</p>}
          </div>
          <div className="cols-2">
            {(s.stats || []).map((st, i) => (
              <div key={i} className="stat card"><span className="big grad">{st.value}</span><span className="lbl">{st.label}</span></div>
            ))}
          </div>
        </div>
      );

    case "cards": {
      const cards = (
        (s.cards || []).map((c, i) => (
          <div key={i} className="card"><div className="icon"><Icon name={c.icon} /></div><h3>{c.title}</h3><p>{c.body}</p></div>
        ))
      );
      // 2-up cards sit BESIDE the heading (a full-width 2×2 grid under the
      // heading is taller than the slide and overflows). 3/4-up stay stacked.
      if (s.columns === 2) {
        return (
          <div className="body two" style={{ alignItems: "start", gridTemplateColumns: ".9fr 1.1fr" }}>
            <div style={{ paddingTop: ".2rem" }}>
              {s.kicker && <span className="kicker">{s.kicker}</span>}
              {s.heading && <h2>{rich(s.heading)}</h2>}
              {s.lead && <p className="lead" style={{ marginTop: "1.1rem" }}>{s.lead}</p>}
            </div>
            <div className="cols-2">{cards}</div>
          </div>
        );
      }
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          {s.heading && <h2 style={{ maxWidth: "22ch" }}>{rich(s.heading)}</h2>}
          {s.lead && <p className="lead" style={{ marginTop: ".9rem" }}>{s.lead}</p>}
          <div className={`cols-${s.columns || 3}`} style={{ marginTop: "2.1rem" }}>{cards}</div>
        </div>
      );
    }

    case "quote":
      return (
        <div className="body center">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          <p className="quote">{rich(s.quote)}</p>
          {s.lead && <p className="lead" style={{ marginTop: "1.8rem" }}>{s.lead}</p>}
        </div>
      );

    case "story":
      return (
        <div className="body two">
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            {s.lead && <p className="lead" style={{ marginTop: "1.2rem" }}>{s.lead}</p>}
            {!!(s.bullets || []).length && (
              <ul className="clean" style={{ marginTop: "1.3rem" }}>
                {s.bullets!.map((b, i) => <li key={i}><span>{b}</span></li>)}
              </ul>
            )}
          </div>
          <div>
            <div className="photo-frame">
              {s.photo ? <img src={s.photo} alt={s.caption || ""} /> : <div className="phone-ph" style={{ aspectRatio: "4/3" }}>No photo yet</div>}
            </div>
            {s.caption && <p className="photo-cap">{s.caption}</p>}
          </div>
        </div>
      );

    case "team":
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          <h2>{rich(s.heading)}</h2>
          {s.lead && <p className="lead" style={{ marginTop: ".7rem" }}>{s.lead}</p>}
          <div className="team">
            {(s.members || []).map((m, i) => (
              <div key={i} className="member">
                {m.photo
                  ? <img className="photo" src={m.photo} alt={m.name} />
                  : <div className="photo ph-empty">No photo</div>}
                {m.flag && <span className="flag">{m.flag}</span>}
                <h4>{m.name}</h4>
                <span className="role">{m.role}</span>
              </div>
            ))}
          </div>
          {s.footnote && <p className="footnote">{s.footnote}</p>}
        </div>
      );

    case "team-branch": {
      const team = (label: string | undefined, brand: Slide["brand"], members: MemberItem[] | undefined) => (
        <div className={`tb-team${brandClass(brand)}`}>
          <div className="tb-team-head">
            <Logo brand={brand} />
            {label && <span className="tb-label">{label}</span>}
          </div>
          <div className="tb-row">{(members || []).map((m, i) => <MemberCard key={i} m={m} />)}</div>
        </div>
      );
      const hasCommon = !!(s.common || []).length;
      return (
        <div className="body team-branch">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          <h2>{rich(s.heading)}</h2>
          {s.lead && <p className="lead" style={{ marginTop: ".5rem" }}>{s.lead}</p>}
          <div className="tb-teams">
            {hasCommon && (
              <div className="tb-team">
                {s.commonLabel && <span className="tb-label tb-team-head">{s.commonLabel}</span>}
                <div className="tb-row">{(s.common || []).map((m, i) => <MemberCard key={i} m={m} />)}</div>
              </div>
            )}
            {team(s.branch1Label, s.branch1Brand, s.branch1)}
            {team(s.branch2Label, s.branch2Brand, s.branch2)}
          </div>
        </div>
      );
    }

    case "pillars":
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          <h2>{rich(s.heading)}</h2>
          {s.lead && <p className="lead" style={{ marginTop: ".8rem" }}>{s.lead}</p>}
          <div className="cols-4" style={{ marginTop: "2.1rem" }}>
            {(s.pillars || []).map((p, i) => (
              <div key={i} className={`pillar p-${p.key}`}><div className="pi"><Icon name={p.icon} /></div><h3>{p.title}</h3><p>{p.body}</p></div>
            ))}
          </div>
        </div>
      );

    case "steps":
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          <h2>{rich(s.heading)}</h2>
          <div className="cols-3" style={{ marginTop: "2.1rem", rowGap: "1.6rem" }}>
            {(s.steps || []).map((st, i) => (
              <div key={i} className="step"><span className="num">{i + 1}</span><div><h3>{st.title}</h3><p>{st.body}</p></div></div>
            ))}
          </div>
        </div>
      );

    case "bullets":
      return (
        <div className="body">
          <div className="two">
            <div>
              {s.kicker && <span className="kicker">{s.kicker}</span>}
              <h2>{rich(s.heading)}</h2>
              {s.lead && <p className="lead" style={{ marginTop: "1.2rem" }}>{s.lead}</p>}
              {!!(s.chips || []).length && (
                <div className="pad-row">
                  {s.chips!.map((c, i) => <span key={i} className="chip"><span className="cdot" />{c.label}</span>)}
                </div>
              )}
            </div>
            <ul className="clean">
              {(s.bullets || []).map((b, i) => <li key={i}><span>{b}</span></li>)}
            </ul>
          </div>
          {s.footnote && <p className="footnote">{s.footnote}</p>}
        </div>
      );

    case "phone-feature":
      return (
        <div className="body two">
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            {s.lead && <p className="lead" style={{ marginTop: "1rem" }}>{s.lead}</p>}
            {!!(s.bullets || []).length && (
              <ul className="clean" style={{ marginTop: "1.3rem" }}>
                {s.bullets!.map((b, i) => <li key={i}><span>{b}</span></li>)}
              </ul>
            )}
          </div>
          <PhoneImg src={s.phone} zoomable={zoomable} />
        </div>
      );

    case "app-showcase":
      return (
        <div className="body two" style={{ gridTemplateColumns: ".82fr 1.18fr", alignItems: "center", gap: "clamp(1rem,3cqw,2.5rem)" }}>
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            <ul className="clean" style={{ marginTop: "1.2rem" }}>
              {(s.bullets || []).map((b, i) => <li key={i}><span>{b}</span></li>)}
            </ul>
          </div>
          <div className="phone-row showcase">
            {(s.phones || []).slice(0, 3).map((p, i) => <PhoneImg key={i} src={p} zoomable={zoomable} />)}
          </div>
        </div>
      );

    case "trio":
      return (
        <div className="body phone-trio-body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          {s.heading && <h2 style={{ maxWidth: "24ch" }}>{rich(s.heading)}</h2>}
          {s.lead && <p className="lead" style={{ marginTop: ".8rem" }}>{s.lead}</p>}
          <div className="phone-trio">
            {(s.trio || []).slice(0, 3).map((p, i) => (
              <div key={i} className="phone-trio-item">
                <PhoneImg src={p?.value} zoomable={zoomable} />
                {p?.caption && <p>{p.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      );

    case "coaching":
      return (
        <div className="body two" style={{ gridTemplateColumns: ".8fr 1.2fr" }}>
          <div className="coach-phone"><PhoneImg src={s.phone} zoomable={zoomable} /></div>
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            {s.lead && <p className="lead" style={{ marginTop: ".9rem" }}>{s.lead}</p>}
            <div className="stack" style={{ marginTop: "1.4rem" }}>
              {(s.cards || []).map((c, i) => (
                <div key={i} className="card coach-card"><div className="icon"><Icon name={c.icon} /></div><div className="ct"><h3>{c.title}</h3><p>{c.body}</p></div></div>
              ))}
            </div>
          </div>
        </div>
      );

    case "timeline":
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          <h2>{rich(s.heading)}</h2>
          <div className="tl">
            {(s.nodes || []).map((n, i) => (
              <div key={i} className="node"><div className="dotn"><Icon name={n.icon} /></div><h4>{n.title}</h4><p>{n.body}</p></div>
            ))}
          </div>
          {s.lead && <p className="lead" style={{ marginTop: "2rem" }}>{s.lead}</p>}
        </div>
      );

    case "statement":
      return (
        <div className="body center">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          <p className="statement">{rich(s.heading)}</p>
          {s.lead && <p className="lead" style={{ marginTop: "1.6rem" }}>{s.lead}</p>}
        </div>
      );

    case "metric":
      return (
        <div className="body two" style={{ alignItems: "center", gridTemplateColumns: ".9fr 1.1fr" }}>
          <div className="metric-val"><span className="grad">{s.value}</span></div>
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            {s.lead && <p className="lead" style={{ marginTop: "1rem" }}>{s.lead}</p>}
            {s.footnote && <p className="footnote">{s.footnote}</p>}
          </div>
        </div>
      );

    case "feature-rows":
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          {s.heading && <h2>{rich(s.heading)}</h2>}
          <div className="frows" style={{ marginTop: "2.1rem" }}>
            {(s.rows || []).map((r, i) => (
              <div key={i} className="frow">
                <div className="icon"><Icon name={r.icon} /></div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "clusters": {
      const cls = s.clusters || [];
      const PAL = ["#10B981", "#0EA5A3", "#06B6D4", "#0E9F6E", "#0891B2", "#16A34A"];
      const half = Math.ceil(cls.length / 2);
      const renderCard = (c: NonNullable<Slide["clusters"]>[number], idx: number) => {
        const color = PAL[idx % PAL.length];
        return (
          <div className="cl-card" key={idx}>
            <div className="cl-head">
              <span className="cl-ic" style={{ background: color }}><Icon name={c.icon} /></span>
              <h3>{c.title}</h3>
            </div>
            {!!(c.items || []).length && (
              <div className="cl-items">
                {c.items!.map((it, j) => (
                  <span className="cl-item" key={j} style={{ color }}>
                    <span className="cl-chip"><Icon name={it.icon} /></span>
                    <span className="cl-label">{it.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      };
      return (
        <div className="clusters-wrap">
          <div className="clusters-col">{cls.slice(0, half).map((c, i) => renderCard(c, i))}</div>
          <div className="clusters-hub">
            {s.kicker && <span className="cl-hub-kicker">{s.kicker}</span>}
            {s.heading && <h2>{rich(s.heading)}</h2>}
            {s.lead && <p>{s.lead}</p>}
            {s.footnote && <span className="cl-hub-note">{s.footnote}</span>}
          </div>
          <div className="clusters-col">{cls.slice(half).map((c, i) => renderCard(c, i + half))}</div>
        </div>
      );
    }

    case "fullbleed":
      return <FullbleedView s={s} zoomable={zoomable} />;

    case "hero-image":
      return (
        <>
          <div className="hero-img" style={{ backgroundImage: s.image ? `url(${s.image})` : undefined }}>
            {!s.image && <span className="hero-ph">No image yet</span>}
          </div>
          <div className="body hero-body">
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h1 style={{ fontSize: "clamp(1.6rem,4.4cqw,3.4rem)" }}>{rich(s.heading)}</h1>
            {s.lead && <p className="lead" style={{ marginTop: "1.2rem" }}>{s.lead}</p>}
            {s.tagline && <p className="tagline" style={{ marginTop: "1.6rem" }}>{s.tagline}</p>}
          </div>
        </>
      );

    case "fan": {
      const group = (title: string | undefined, icon: IconKey | undefined, items: { value: string; body?: string; points?: string }[] | undefined) => (
        <div className="grp">
          <div className="grp-head">
            {icon && <div className="icon"><Icon name={icon} /></div>}
            {title && <h3>{title}</h3>}
          </div>
          <div className="grp-cards">
            {(items || []).map((it, i) => {
              const pts = (it.points || "").split("\n").map((p) => p.trim()).filter(Boolean);
              return (
                <div key={i} className="grp-card">
                  <h4>{it.value}</h4>
                  {it.body && <p>{it.body}</p>}
                  {!!pts.length && (
                    <ul className="grp-points">{pts.map((p, j) => <li key={j}>{p}</li>)}</ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          {s.heading && <h2>{rich(s.heading)}</h2>}
          {s.lead && <p className="lead" style={{ marginTop: ".8rem", maxWidth: "62ch" }}>{s.lead}</p>}
          <div className="grps">
            {group(s.fan1Title, s.fan1Icon, s.fan1)}
            {group(s.fan2Title, s.fan2Icon, s.fan2)}
          </div>
        </div>
      );
    }

    case "checklist":
      return (
        <div className="body">
          {s.kicker && <span className="kicker">{s.kicker}</span>}
          {s.heading && <h2>{rich(s.heading)}</h2>}
          <div className={`checklist cols-${s.columns || 2}`} style={{ marginTop: "2.1rem" }}>
            {(s.items || []).map((it, i) => (
              <div key={i} className="check"><span className="cbox" /><span>{it}</span></div>
            ))}
          </div>
        </div>
      );

    case "report": {
      const img = s.image;
      const hls = parseHighlights(s.highlight);
      return (
        <div className="body two" style={{ gridTemplateColumns: ".82fr 1.18fr" }}>
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            {s.lead && <p className="lead" style={{ marginTop: ".9rem" }}>{s.lead}</p>}
            {!!(s.bullets || []).length && (
              s.numbered ? (
                <ol className="numbered" style={{ marginTop: "1.2rem" }}>
                  {s.bullets!.map((b, i) => <li key={i}><span className="n">{i + 1}</span><span>{b}</span></li>)}
                </ol>
              ) : (
                <ul className="clean" style={{ marginTop: "1.2rem" }}>
                  {s.bullets!.map((b, i) => <li key={i}><span>{b}</span></li>)}
                </ul>
              )
            )}
          </div>
          <div>
            {zoomable && img && <ZoomHint onClick={() => setZoom(true)} />}
            <div className="laptop">
              <div className="screen">
                {img ? (
                  // Shrink-wrap wrapper so highlight percentages align with the
                  // image box (the .screen frame letterboxes to 16:10).
                  <div style={{ position: "relative", width: "100%" }}>
                    <img
                      src={img}
                      alt={s.heading || "Report"}
                      title="Click to enlarge"
                      style={{ width: "100%", height: "auto", cursor: "zoom-in" }}
                      onClick={() => setZoom(true)}
                    />
                    {hls.length > 0 && <HighlightBoxes rects={hls} />}
                  </div>
                ) : <div className="phone-ph">No screenshot yet</div>}
              </div>
              <div className="laptop-base" />
            </div>
          </div>
          {zoom && img && <Lightbox src={img} alt={s.heading || "Screenshot"} highlights={hls} onClose={() => setZoom(false)} />}
        </div>
      );
    }

    default:
      return null;
  }
}

/** Full slide: themed <section> + background layers + header chrome + body. */
export function SlideView({ slide, zoomable }: { slide: Slide; zoomable?: boolean }) {
  const hasBg = (slide.type === "title" || slide.type === "closing") && !!slide.bg;
  // Full-bleed illustrations carry their own baked-in title, so the corner
  // logo is suppressed there to avoid collisions.
  const noHead = slide.type === "fullbleed";
  return (
    <>
      {hasBg && <div className="slide-bg" style={{ backgroundImage: `url(${slide.bg})` }} />}
      {hasBg && <div className="slide-bg-ov" />}
      {!noHead && (
        <div className="slide-head">
          {slide.type === "team-branch" ? <span /> : <Logo brand={slide.brand} />}
          <HeadTag tag={slide.tag} />
        </div>
      )}
      <SlideBody s={slide} zoomable={zoomable} />
      {/* footnote already handled inside some bodies; title/closing render it here */}
      {(slide.type === "title" || slide.type === "closing") && slide.footnote && (
        <p className="footnote">{slide.footnote}</p>
      )}
    </>
  );
}

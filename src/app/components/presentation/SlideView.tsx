/* eslint-disable @next/next/no-img-element -- deck renders CMS/storage/full-bleed imagery where next/image's layout constraints don't fit; plain <img> is intentional. */
import React from "react";
import type { Slide, MemberItem } from "@/lib/presentations/types";
import { DeckDefs, Logo, Icon } from "./DeckAssets";

export { DeckDefs };

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

function PhoneImg({ src, alt }: { src?: string; alt?: string }) {
  return (
    <div className="phone-shot">
      {src ? <img src={src} alt={alt || ""} /> : <div className="phone-ph">No image yet</div>}
    </div>
  );
}

function MemberCard({ m }: { m: MemberItem }) {
  return (
    <div className="member">
      {m.photo
        ? <img className="photo" src={m.photo} alt={m.name} />
        : <div className="photo ph-empty">No photo</div>}
      {m.flag && <span className="flag">{m.flag}</span>}
      <h4>{m.name}</h4>
      <span className="role">{m.role}</span>
    </div>
  );
}

/** Renders the inner content of a single slide (without the <section> shell). */
function SlideBody({ s }: { s: Slide }) {
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
        <div className={`tb-team${brand === "fjarlaekningar" ? " brand-fjar" : ""}`}>
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
          <PhoneImg src={s.phone} />
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
            {(s.phones || []).slice(0, 3).map((p, i) => <PhoneImg key={i} src={p} />)}
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
                <PhoneImg src={p?.value} />
                {p?.caption && <p>{p.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      );

    case "coaching":
      return (
        <div className="body two" style={{ gridTemplateColumns: ".8fr 1.2fr" }}>
          <div className="coach-phone"><PhoneImg src={s.phone} /></div>
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

    case "report":
      return (
        <div className="body two" style={{ gridTemplateColumns: ".82fr 1.18fr" }}>
          <div>
            {s.kicker && <span className="kicker">{s.kicker}</span>}
            <h2>{rich(s.heading)}</h2>
            {s.lead && <p className="lead" style={{ marginTop: ".9rem" }}>{s.lead}</p>}
            {!!(s.bullets || []).length && (
              <ul className="clean" style={{ marginTop: "1.2rem" }}>
                {s.bullets!.map((b, i) => <li key={i}><span>{b}</span></li>)}
              </ul>
            )}
          </div>
          <div className="laptop">
            <div className="screen">
              {s.image ? <img src={s.image} alt={s.heading || "Report"} /> : <div className="phone-ph">No screenshot yet</div>}
            </div>
            <div className="laptop-base" />
          </div>
        </div>
      );

    default:
      return null;
  }
}

/** Full slide: themed <section> + background layers + header chrome + body. */
export function SlideView({ slide }: { slide: Slide }) {
  const hasBg = (slide.type === "title" || slide.type === "closing") && !!slide.bg;
  return (
    <>
      {hasBg && <div className="slide-bg" style={{ backgroundImage: `url(${slide.bg})` }} />}
      {hasBg && <div className="slide-bg-ov" />}
      <div className="slide-head">
        {slide.type === "team-branch" ? <span /> : <Logo brand={slide.brand} />}
        <HeadTag tag={slide.tag} />
      </div>
      <SlideBody s={slide} />
      {/* footnote already handled inside some bodies; title/closing render it here */}
      {(slide.type === "title" || slide.type === "closing") && slide.footnote && (
        <p className="footnote">{slide.footnote}</p>
      )}
    </>
  );
}

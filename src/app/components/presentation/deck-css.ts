// Scoped stylesheet for the presentation deck. Every selector is namespaced
// under `.lldeck` and typography uses container-query units (cqw/cqh) so the
// same markup scales to fullscreen (public route) and to the editor preview
// box without a separate "scale" hack. The deck root must set
// `container-type: size`.
//
// THEMING: all palette/typography choices are CSS variables declared on
// `.lldeck` (the "lifeline" default). A design is selected with a
// `data-design="…"` attribute on the root, whose block overrides the subset
// of variables that differ. Add a new design = add one override block +
// register it in types.ts DESIGNS.
export const DECK_CSS = `
.lldeck{
  /* themeable */
  --emerald:#10B981; --emerald-dark:#047857; --cyan:#06B6D4;
  --ink:#0f2e25; --foreground:#1F2937; --muted:#5b6b66;
  --bg:#eef2f1; --card:#ffffff; --line:#dde5e2;
  --on-dark:#eafaf3; --on-dark-muted:#bfe7d8; --on-dark-accent:#6ee7b7;
  --dark1:#06231c; --dark2:#064e3b; --dark3:#07372b;
  --glow1:rgba(16,185,129,.22); --glow2:rgba(6,182,212,.18);
  --head-font:var(--font-inter), 'Inter', system-ui, sans-serif;
  --head-weight:800; --head-spacing:-.025em; --card-radius:16px;
  /* fixed (semantic) */
  --exercise:#EA580C; --nutrition:#65A30D; --sleep:#7C6FB0; --mental:#0EA5E9; --amber:#F59E0B;
  --shadow:0 10px 40px -12px rgba(6,78,59,.18);
  position:relative; width:100%; height:100%; overflow:hidden;
  container-type:size; container-name:deck;
  font-family:var(--font-inter), 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing:antialiased; color:var(--foreground); background:var(--dark1);
}

/* ===== designs ===== */
.lldeck[data-design="midnight"]{
  --emerald:#6366F1; --emerald-dark:#4f46e5; --cyan:#22D3EE;
  --ink:#1e1b4b; --foreground:#1e213a; --muted:#5b6080;
  --bg:#eef0f8; --card:#ffffff; --line:#dde0ee;
  --on-dark:#eaecff; --on-dark-muted:#c2c8f0; --on-dark-accent:#a5b4fc;
  --dark1:#0b1024; --dark2:#1a1f4d; --dark3:#0e1430;
  --glow1:rgba(99,102,241,.30); --glow2:rgba(34,211,238,.18);
}
.lldeck[data-design="clinical"]{
  --emerald:#2563EB; --emerald-dark:#1d4ed8; --cyan:#06B6D4;
  --ink:#0f2540; --foreground:#102a43; --muted:#5a6b80;
  --bg:#f2f6fc; --card:#ffffff; --line:#dbe6f2;
  --on-dark:#eaf2ff; --on-dark-muted:#bcd2ee; --on-dark-accent:#93c5fd;
  --dark1:#0a1f3a; --dark2:#13315c; --dark3:#0e2747;
  --glow1:rgba(37,99,235,.26); --glow2:rgba(6,182,212,.18);
  --head-font:Georgia, 'Times New Roman', serif; --head-spacing:-.01em;
}
.lldeck[data-design="warm"]{
  --emerald:#E1730B; --emerald-dark:#C2410C; --cyan:#F59E0B;
  --ink:#43261a; --foreground:#3b2a20; --muted:#7c6a5d;
  --bg:#faf3ea; --card:#fffaf3; --line:#ece0d2;
  --on-dark:#fdeedd; --on-dark-muted:#e9c9ad; --on-dark-accent:#f9b97a;
  --dark1:#2a1812; --dark2:#4a2716; --dark3:#341c12;
  --glow1:rgba(234,115,23,.30); --glow2:rgba(245,158,11,.18);
  --head-font:Georgia, 'Times New Roman', serif; --head-spacing:-.012em;
  --shadow:0 10px 40px -12px rgba(80,40,15,.20);
}
.lldeck[data-design="mono"]{
  --emerald:#059669; --emerald-dark:#065f46; --cyan:#34D399;
  --ink:#0a0a0a; --foreground:#0a0a0a; --muted:#525252;
  --bg:#ffffff; --card:#ffffff; --line:#e5e5e5;
  --on-dark:#ffffff; --on-dark-muted:#d4d4d4; --on-dark-accent:#34D399;
  --dark1:#0a0a0a; --dark2:#171717; --dark3:#0f0f0f;
  --glow1:rgba(16,185,129,.16); --glow2:rgba(255,255,255,.05);
  --head-weight:900; --head-spacing:-.04em;
  --shadow:0 10px 30px -14px rgba(0,0,0,.35);
}

/* Bloom — wellness: soft rounded shapes, minty palette, airy, rounded font. */
.lldeck[data-design="bloom"]{
  --emerald:#0EA17E; --emerald-dark:#0B7A60; --cyan:#2DD4BF;
  --ink:#0c3b30; --foreground:#214a40; --muted:#5e7d73;
  --bg:#f1faf6; --card:#ffffff; --line:#dcefe6;
  --on-dark:#eafff8; --on-dark-muted:#bfe9d8; --on-dark-accent:#7af0cf;
  --dark1:#06382c; --dark2:#0a5a44; --dark3:#073a2d;
  --glow1:rgba(45,212,191,.26); --glow2:rgba(16,185,129,.18);
  --head-font:var(--font-nunito-sans), 'Inter', sans-serif; --head-weight:800;
  --card-radius:26px; --shadow:0 16px 44px -16px rgba(11,122,96,.22);
}
.lldeck[data-design="bloom"] .slide.light{background:radial-gradient(620px 460px at 88% 4%, rgba(45,212,191,.16), transparent 60%),radial-gradient(520px 440px at 2% 98%, rgba(16,185,129,.13), transparent 60%),var(--bg);}
.lldeck[data-design="bloom"] .icon{border-radius:18px;}
.lldeck[data-design="bloom"] .pillar{border-radius:24px;}
.lldeck[data-design="bloom"] .kicker::before{width:18px;border-radius:3px;}

/* Vital — medical: crisp white, dotted grid, card top-accent, tabular figures. */
.lldeck[data-design="vital"]{
  --emerald:#0E9F6E; --emerald-dark:#0a7d57; --cyan:#0891B2;
  --ink:#0b3a3f; --foreground:#143b42; --muted:#5b7177;
  --bg:#f5fbfd; --card:#ffffff; --line:#d7e9ef;
  --on-dark:#eafaff; --on-dark-muted:#bfe2ec; --on-dark-accent:#67e8d6;
  --dark1:#06303a; --dark2:#0a4f5e; --dark3:#073744;
  --glow1:rgba(8,145,178,.22); --glow2:rgba(14,159,110,.18);
  --card-radius:10px; --shadow:0 8px 30px -14px rgba(8,80,100,.20);
}
.lldeck[data-design="vital"] .slide.light{background:radial-gradient(circle, rgba(8,145,178,.10) 1px, transparent 1.4px) 0 0/22px 22px, var(--bg);}
.lldeck[data-design="vital"] .card{border-top:3px solid var(--emerald);}
.lldeck[data-design="vital"] .stat .big{font-feature-settings:"tnum";letter-spacing:-.02em;}
.lldeck[data-design="vital"] .kicker{color:var(--cyan);}

/* Pulse — motivational: big bold type, energetic emerald→lime, pill kicker. */
.lldeck[data-design="pulse"]{
  --emerald:#10B981; --emerald-dark:#15803d; --cyan:#A3E635;
  --ink:#0c2e22; --foreground:#1d3b30; --muted:#5b7568;
  --bg:#f0fbef; --card:#ffffff; --line:#dbf0d6;
  --on-dark:#f2fff0; --on-dark-muted:#c8edbf; --on-dark-accent:#bef264;
  --dark1:#062a14; --dark2:#0b5d2e; --dark3:#08401f;
  --glow1:rgba(163,230,53,.26); --glow2:rgba(16,185,129,.22);
  --head-weight:900; --head-spacing:-.04em;
}
.lldeck[data-design="pulse"] h1{font-size:clamp(2.1rem,7cqw,5.6rem);}
.lldeck[data-design="pulse"] .kicker{background:color-mix(in srgb, var(--emerald) 14%, transparent);padding:.38rem .8rem;border-radius:999px;}
.lldeck[data-design="pulse"] .kicker::before{display:none;}

/* Journey — personal/editorial: cream, handwritten kicker + tagline (Caveat). */
.lldeck[data-design="journey"]{
  --emerald:#0F8A6A; --emerald-dark:#0c6e54; --cyan:#34D399;
  --ink:#33402f; --foreground:#3a3a30; --muted:#7a766a;
  --bg:#fbf7ef; --card:#fffdf8; --line:#ece4d4;
  --on-dark:#f6f1e6; --on-dark-muted:#d8e6cf; --on-dark-accent:#8fe6c4;
  --dark1:#10241c; --dark2:#1e4533; --dark3:#142a20;
  --glow1:rgba(52,211,153,.22); --glow2:rgba(15,138,106,.16);
  --shadow:0 12px 40px -14px rgba(60,50,20,.18); --card-radius:18px;
}
.lldeck[data-design="journey"] .kicker{font-family:var(--font-signature), cursive;font-size:clamp(1.1rem,2cqw,1.7rem);text-transform:none;letter-spacing:.01em;font-weight:700;}
.lldeck[data-design="journey"] .kicker::before{display:none;}
.lldeck[data-design="journey"] .tagline{font-family:var(--font-signature), cursive;font-size:clamp(1.3rem,2.4cqw,2rem);letter-spacing:0;}

/* Fjarlækningar — electric cyan brand (mark #00d6ff, primary #00a8cc, accent
   magenta #cf147b, slate neutrals). Available deck-wide via data-design, AND
   per-slide via .brand-fjar — so a mixed Lifeline + Fjarlækningar deck renders
   each company in its own colours (the .slide-level override beats the deck
   design's root variables for that slide only). */
.lldeck[data-design="fjarlaekningar"],
.lldeck .brand-fjar{
  --emerald:#00a8cc; --emerald-dark:#0488a4; --cyan:#00d6ff;
  --ink:#1a1a1a; --foreground:#1f2937; --muted:#6b7280;
  --bg:#f5f7fa; --card:#ffffff; --line:#e3e9ef;
  --on-dark:#eafaff; --on-dark-muted:#bfe6f2; --on-dark-accent:#5fe0ff;
  --dark1:#062a38; --dark2:#0a4a5e; --dark3:#07313f;
  --glow1:rgba(0,214,255,.24); --glow2:rgba(207,20,123,.18);
  --shadow:0 10px 40px -12px rgba(8,70,90,.20);
}
/* Cyan-led wash with a hint of magenta on light Fjarlækningar slides. */
.lldeck[data-design="fjarlaekningar"] .slide.light,
.lldeck .slide.brand-fjar.light{
  background:
    radial-gradient(620px 460px at 88% 4%, rgba(0,214,255,.13), transparent 60%),
    radial-gradient(520px 440px at 2% 98%, rgba(207,20,123,.08), transparent 60%),
    var(--bg);
}
/* Fjarlækningar kickers stand on their own — no leading dash (the uppercase,
   letter-spaced cyan label already reads as a kicker). */
.lldeck[data-design="fjarlaekningar"] .kicker::before,
.lldeck .brand-fjar .kicker::before{display:none;}

/* World Class — red brand (#D03C3C) on near-black, for the Lifeline × World
   Class partnership deck. Per-slide via .brand-wc, deck-wide via data-design. */
.lldeck[data-design="worldclass"],
.lldeck .brand-wc{
  --emerald:#D03C3C; --emerald-dark:#B22820; --cyan:#841A22;
  --ink:#1D1D1D; --foreground:#1D1D1D; --muted:#5b5656;
  --bg:#f6f4f4; --card:#ffffff; --line:#e7e2e2;
  --on-dark:#f7eaea; --on-dark-muted:#e2b8b8; --on-dark-accent:#ff8175;
  --dark1:#181313; --dark2:#3a1413; --dark3:#221011;
  --glow1:rgba(208,60,60,.28); --glow2:rgba(132,26,34,.20);
}
.lldeck[data-design="worldclass"] .slide.light,
.lldeck .slide.brand-wc.light{
  background:
    radial-gradient(620px 460px at 88% 4%, rgba(208,60,60,.10), transparent 60%),
    radial-gradient(520px 440px at 2% 98%, rgba(132,26,34,.07), transparent 60%),
    var(--bg);
}
/* World Class logo: red on light slides, white on dark (their brand usage). */
.lldeck .slide.brand-wc .logo{color:#D03C3C;}
.lldeck .slide.brand-wc.dark .logo{color:#ffffff;}
.lldeck .logo-wc,.lldeck .logo-wc svg{height:clamp(22px,2.6cqw,38px);}
.lldeck *{box-sizing:border-box;margin:0;padding:0;}

.lldeck .slide{
  position:absolute; inset:0; display:grid; grid-template-rows:auto 1fr auto;
  row-gap:clamp(1rem,3.5cqh,2.6rem); align-items:start;
  padding:6cqh 8cqw 7cqh; overflow:hidden;
  opacity:0; visibility:hidden; transform:translateY(18px) scale(.995);
  transition:opacity .5s ease, transform .5s ease, visibility .5s;
}
.lldeck .slide.active{opacity:1; visibility:visible; transform:none; z-index:2;}
.lldeck .slide.prev{transform:translateY(-18px) scale(.995);}
/* Stage = single-slide editor preview: always show the one rendered slide. */
.lldeck.is-stage .slide{position:relative; height:100%; opacity:1; visibility:visible; transform:none; transition:none;}
.lldeck .slide.light{background:var(--bg); color:var(--foreground);}
.lldeck .slide.dark{
  background:
    radial-gradient(1200px 800px at 12% -10%, var(--glow1), transparent 55%),
    radial-gradient(1000px 700px at 110% 120%, var(--glow2), transparent 55%),
    linear-gradient(135deg,var(--dark1) 0%, var(--dark2) 55%, var(--dark3) 100%);
  color:var(--on-dark);
}

.lldeck h1{font-size:clamp(1.9rem,6cqw,5rem);font-weight:var(--head-weight);line-height:1.02;letter-spacing:-.03em;font-family:var(--head-font);}
.lldeck h2{font-size:clamp(1.55rem,3.8cqw,3.1rem);font-weight:var(--head-weight);line-height:1.05;letter-spacing:var(--head-spacing);font-family:var(--head-font);}
.lldeck h3{font-size:clamp(.95rem,1.6cqw,1.4rem);font-weight:700;letter-spacing:-.01em;}
.lldeck p,.lldeck li{font-size:clamp(.82rem,1.35cqw,1.3rem);line-height:1.55;font-weight:400;}
.lldeck .lead{font-size:clamp(.95rem,1.7cqw,1.6rem);line-height:1.5;color:var(--muted);font-weight:400;max-width:48ch;}
.lldeck .dark .lead{color:var(--on-dark-muted);}
.lldeck .kicker{display:inline-flex;align-items:center;gap:.55rem;font-size:clamp(.62rem,.85cqw,.82rem);font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--emerald-dark);margin-bottom:1.2cqh;}
.lldeck .dark .kicker{color:var(--on-dark-accent);}
.lldeck .kicker::before{content:"";width:26px;height:2px;background:currentColor;border-radius:2px;}
.lldeck .grad{background:linear-gradient(100deg,var(--emerald),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;}
/* In print/PDF, render accent text as a solid brand colour: background-clip:text
   prints a coloured bar / invisible text in many viewers. Global so it applies on
   every print path (the export overlay AND a direct Ctrl+P of the deck). */
@media print{
  .lldeck .grad{background:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;color:var(--emerald-dark)!important;-webkit-text-fill-color:var(--emerald-dark)!important;}
  .lldeck .dark .grad{color:var(--on-dark-accent)!important;-webkit-text-fill-color:var(--on-dark-accent)!important;}
}
.lldeck .accent{color:var(--emerald-dark);font-weight:700;}
.lldeck .dark .accent{color:var(--on-dark-accent);}
.lldeck .tagline{color:var(--on-dark-accent);font-weight:700;letter-spacing:.04em;}
.lldeck .light .tagline{color:var(--emerald-dark);}

.lldeck .slide-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;z-index:4;}
.lldeck .logo{display:flex;align-items:center;height:clamp(20px,2.1cqw,30px);color:var(--ink);}
.lldeck .dark .logo{color:var(--on-dark);}
.lldeck .logo svg{height:clamp(20px,2.1cqw,30px);width:auto;display:block;}
/* The Fjarlækningar lockup is more compact than the Lifeline wordmark, so size
   it up to read at a comparable visual weight in the header. */
.lldeck .logo-fjar{height:clamp(28px,3.1cqw,44px);}
.lldeck .logo-fjar svg{height:clamp(28px,3.1cqw,44px);}
.lldeck .tag-pill{font-size:clamp(.55rem,.78cqw,.72rem);font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--emerald-dark);border:1px solid var(--line);border-radius:999px;padding:.4rem .8rem;background:var(--card);white-space:nowrap;}
.lldeck .dark .tag-pill{color:var(--on-dark-accent);border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.06);}

.lldeck .body{align-self:center;width:100%;min-height:0;}

.lldeck .two{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(1.4rem,5cqw,5rem);align-items:center;}
.lldeck .cols-2{display:grid;grid-template-columns:repeat(2,1fr);gap:1.2rem;}
.lldeck .cols-3{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem;}
.lldeck .cols-4{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;}
.lldeck .stack{display:flex;flex-direction:column;gap:.9rem;}
/* compact horizontal cards + smaller phone for the coaching slide so it fits */
.lldeck .coach-card{display:flex;flex-direction:row;align-items:flex-start;gap:.85rem;padding:.95rem 1.1rem;}
.lldeck .coach-card .icon{margin-bottom:0;}
.lldeck .coach-card h3{margin-bottom:.15rem;}
.lldeck .coach-phone .phone-shot{width:clamp(150px,16.5cqw,222px);}

.lldeck .card{background:var(--card);border:1px solid var(--line);border-radius:var(--card-radius);padding:1.3rem;box-shadow:var(--shadow);}
.lldeck .dark .card{background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.12);backdrop-filter:blur(6px);box-shadow:none;}
.lldeck .card h3{margin-bottom:.45rem;}
.lldeck .card p{color:var(--muted);font-size:clamp(.78rem,1cqw,1.02rem);}
.lldeck .dark .card p{color:var(--on-dark-muted);}

.lldeck .icon{width:clamp(38px,3.4cqw,52px);height:clamp(38px,3.4cqw,52px);border-radius:13px;display:grid;place-items:center;margin-bottom:.9rem;background:color-mix(in srgb, var(--emerald) 14%, transparent);color:var(--emerald-dark);flex:none;}
.lldeck .icon svg{width:55%;height:55%;}
.lldeck .dark .icon{background:color-mix(in srgb, var(--emerald) 24%, transparent);color:var(--on-dark-accent);}

.lldeck .step{display:flex;gap:.9rem;align-items:flex-start;}
.lldeck .step .num{flex:none;width:clamp(34px,3cqw,44px);height:clamp(34px,3cqw,44px);border-radius:50%;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--emerald),var(--emerald-dark));}
.lldeck .step h3{margin-bottom:.2rem;}
.lldeck .step p{color:var(--muted);}
.lldeck .dark .step p{color:var(--on-dark-muted);}

.lldeck .stat{display:flex;flex-direction:column;}
.lldeck .stat .big{font-size:clamp(2rem,5cqw,4rem);font-weight:900;letter-spacing:-.03em;line-height:1;}
.lldeck .stat .lbl{color:var(--muted);font-size:clamp(.78rem,1cqw,1rem);margin-top:.35rem;}
.lldeck .dark .stat .lbl{color:var(--on-dark-muted);}

.lldeck .pillar{border-radius:16px;padding:1.2rem;color:#fff;display:flex;flex-direction:column;gap:.45rem;min-height:clamp(120px,15cqh,180px);box-shadow:0 14px 30px -14px rgba(0,0,0,.45);}
.lldeck .pillar .pi{width:clamp(36px,3cqw,46px);height:clamp(36px,3cqw,46px);border-radius:11px;background:rgba(255,255,255,.22);display:grid;place-items:center;margin-bottom:.3rem;}
.lldeck .pillar .pi svg{width:55%;height:55%;}
.lldeck .pillar h3{font-size:clamp(1rem,1.4cqw,1.25rem);}
.lldeck .pillar p{font-size:clamp(.74rem,.95cqw,.95rem);opacity:.92;line-height:1.4;}
.lldeck .p-exercise{background:linear-gradient(150deg,#f97316,#EA580C);}
.lldeck .p-nutrition{background:linear-gradient(150deg,#84cc16,#65A30D);}
.lldeck .p-sleep{background:linear-gradient(150deg,#8b80c4,#6d5fa8);}
.lldeck .p-mental{background:linear-gradient(150deg,#38bdf8,#0EA5E9);}

.lldeck ul.clean{list-style:none;display:flex;flex-direction:column;gap:.8rem;}
.lldeck ul.clean li{display:flex;gap:.7rem;align-items:flex-start;}
.lldeck ul.clean li::before{content:"";flex:none;width:20px;height:20px;margin-top:.15rem;border-radius:6px;background-color:var(--emerald);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E") center/14px no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E") center/14px no-repeat;}

.lldeck .quote{font-size:clamp(1.3rem,3.2cqw,2.7rem);font-weight:700;line-height:1.25;letter-spacing:-.02em;max-width:20ch;font-family:var(--head-font);}

.lldeck .badge-soon{display:inline-flex;align-items:center;gap:.5rem;font-size:clamp(.55rem,.78cqw,.72rem);font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:999px;padding:.4rem .85rem;}
.lldeck .badge-soon .dot{width:8px;height:8px;border-radius:50%;background:var(--amber);box-shadow:0 0 0 4px rgba(245,158,11,.25);}

.lldeck .pad-row{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.2rem;}
.lldeck .chip{display:inline-flex;align-items:center;gap:.5rem;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:.5rem .95rem;font-weight:600;font-size:clamp(.78rem,1cqw,.95rem);}
.lldeck .dark .chip{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:var(--on-dark);}
.lldeck .chip .cdot{width:9px;height:9px;border-radius:50%;background:var(--emerald);}

/* photo backgrounds */
.lldeck .slide-bg{position:absolute;inset:0;background-size:cover;background-position:center;z-index:0;}
.lldeck .slide-bg-ov{position:absolute;inset:0;z-index:1;}
.lldeck .dark .slide-bg-ov{background:linear-gradient(100deg,color-mix(in srgb,var(--dark1) 94%, transparent) 0%,color-mix(in srgb,var(--dark2) 82%, transparent) 48%,color-mix(in srgb,var(--dark3) 40%, transparent) 100%);}
.lldeck .light .slide-bg-ov{background:linear-gradient(100deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.78) 48%,rgba(255,255,255,.4) 100%);}
.lldeck .has-bg > .slide-head,.lldeck .has-bg > .body,.lldeck .has-bg > .footnote{position:relative;z-index:2;}

.lldeck .photo-frame{border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 60px -24px rgba(0,0,0,.55);}
.lldeck .light .photo-frame{border-color:#fff;box-shadow:var(--shadow);}
.lldeck .photo-frame img{width:100%;display:block;}
.lldeck .photo-cap{font-size:clamp(.72rem,.95cqw,.82rem);color:var(--on-dark-muted);margin-top:.7rem;}
.lldeck .light .photo-cap{color:var(--muted);}

.lldeck .phone-shot{border:6px solid rgba(255,255,255,.16);border-radius:30px;overflow:hidden;background:var(--dark2);box-shadow:0 30px 60px -22px rgba(0,0,0,.6);width:clamp(150px,16cqw,240px);aspect-ratio:9/19;margin:0 auto;}
.lldeck .light .phone-shot{border-color:#fff;box-shadow:var(--shadow);}
.lldeck .phone-shot img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}
.lldeck .phone-row{display:flex;gap:.8rem;justify-content:center;align-items:flex-end;}
.lldeck .phone-row .phone-shot{width:clamp(90px,11cqw,165px);margin:0;}
.lldeck .phone-row .phone-shot:nth-child(2){width:clamp(104px,12.5cqw,188px);margin-bottom:14px;}
/* app-showcase: larger phones so the screenshots are legible */
.lldeck .phone-row.showcase{align-items:center;gap:clamp(.5rem,1.4cqw,1.1rem);}
.lldeck .phone-row.showcase .phone-shot{width:clamp(132px,17cqw,222px);margin:0;}
.lldeck .phone-row.showcase .phone-shot:nth-child(2){width:clamp(144px,18.5cqw,242px);margin-bottom:0;}
.lldeck .phone-ph{display:grid;place-items:center;color:var(--on-dark-muted);font-size:.8rem;text-align:center;height:100%;padding:1rem;}
/* trio — three equal-size phone mockups, centered, with captions */
.lldeck .phone-trio-body{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
.lldeck .phone-trio{display:flex;gap:clamp(1rem,3.2cqw,2.6rem);justify-content:center;align-items:flex-start;margin-top:clamp(1.6rem,3.4cqh,2.6rem);}
.lldeck .phone-trio-item{display:flex;flex-direction:column;align-items:center;gap:.7rem;}
.lldeck .phone-trio .phone-shot{width:clamp(120px,14.5cqw,230px);margin:0;}
.lldeck .phone-trio-item p{font-size:clamp(.74rem,.95cqw,.92rem);color:var(--muted);max-width:18ch;line-height:1.35;}
.lldeck .dark .phone-trio-item p{color:var(--on-dark-muted);}

.lldeck .team{display:grid;grid-template-columns:repeat(4,1fr);gap:1.3rem;margin-top:clamp(1.6rem,3.6cqh,2.8rem);}
.lldeck .member{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.5rem;}
.lldeck .member .photo{width:clamp(78px,9cqw,132px);height:clamp(78px,9cqw,132px);border-radius:50%;object-fit:cover;object-position:center top;border:3px solid #fff;background:#dfeae6;box-shadow:var(--shadow);}
.lldeck .member .ph-empty{display:grid;place-items:center;color:var(--muted);font-size:.7rem;}
.lldeck .member .flag{font-size:clamp(.58rem,.72cqw,.68rem);font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--emerald-dark);}
.lldeck .dark .member .flag{color:var(--on-dark-accent);}
.lldeck .member h4{font-size:clamp(.88rem,1.1cqw,1.04rem);font-weight:700;line-height:1.2;}
.lldeck .member .role{font-size:clamp(.72rem,.9cqw,.82rem);color:var(--muted);line-height:1.35;max-width:22ch;}
.lldeck .dark .member .role{color:var(--on-dark-muted);}

/* team-branch — one or two company teams stacked on a single slide */
.lldeck .team-branch{display:flex;flex-direction:column;}
.lldeck .tb-label{display:inline-block;font-size:clamp(.58rem,.74cqw,.72rem);font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem;}
.lldeck .tb-row{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(1rem,2.4cqw,2rem);align-items:start;}
/* breathing room between the heading and the first team */
.lldeck .tb-teams{display:flex;flex-direction:column;gap:clamp(1.4rem,3.6cqh,2.8rem);margin-top:clamp(1.4rem,3.4cqh,2.8rem);}
.lldeck .tb-team-head{display:flex;align-items:center;gap:.8rem;min-height:clamp(26px,3.2cqw,44px);margin-bottom:.95rem;}
.lldeck .tb-team-head .logo{height:auto;color:var(--ink);}
.lldeck .tb-team-head .logo svg{height:clamp(24px,3.1cqw,42px);}
.lldeck .tb-team-head .tb-label{margin-bottom:0;}
.lldeck .team-branch .member{gap:.45rem;}
.lldeck .team-branch .member .photo{width:clamp(64px,7cqw,104px);height:clamp(64px,7cqw,104px);}
.lldeck .team-branch .member h4{font-size:clamp(.82rem,1.05cqw,1rem);}
.lldeck .team-branch .member .role{font-size:clamp(.68rem,.86cqw,.8rem);max-width:18ch;}

.lldeck .tl{display:grid;grid-template-columns:repeat(5,1fr);gap:0;position:relative;margin-top:clamp(1.4rem,3cqh,2.4rem);}
.lldeck .tl::before{content:"";position:absolute;left:6%;right:6%;top:clamp(16px,1.6cqw,22px);height:3px;background:linear-gradient(90deg,var(--emerald),var(--cyan));border-radius:3px;}
.lldeck .tl .node{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.6rem;position:relative;padding:0 .4rem;}
.lldeck .tl .dotn{width:clamp(34px,3.2cqw,46px);height:clamp(34px,3.2cqw,46px);border-radius:50%;background:#fff;border:3px solid var(--emerald);display:grid;place-items:center;color:var(--emerald-dark);z-index:1;}
.lldeck .dark .tl .dotn{background:var(--dark2);color:var(--on-dark-accent);}
.lldeck .tl .dotn svg{width:46%;height:46%;}
.lldeck .tl h4{font-size:clamp(.82rem,1cqw,.98rem);font-weight:700;}
.lldeck .tl p{font-size:clamp(.66rem,.82cqw,.82rem);color:var(--muted);line-height:1.35;}
.lldeck .dark .tl p{color:var(--on-dark-muted);}

.lldeck .footnote{font-size:clamp(.66rem,.82cqw,.78rem);color:var(--muted);margin-top:1.1cqh;}
.lldeck .dark .footnote{color:var(--on-dark-muted);}

.lldeck .center{display:flex;flex-direction:column;align-items:flex-start;}

/* ===== from-scratch layout primitives ===== */
/* statement */
.lldeck .statement{font-family:var(--head-font);font-weight:var(--head-weight);font-size:clamp(1.8rem,5.4cqw,4.6rem);line-height:1.08;letter-spacing:var(--head-spacing);max-width:20ch;}
/* metric */
.lldeck .metric-val{font-weight:900;font-size:clamp(3.6rem,15cqw,12rem);line-height:.86;letter-spacing:-.04em;}
/* feature-rows */
.lldeck .frows{display:flex;flex-direction:column;}
.lldeck .frow{display:grid;grid-template-columns:auto .9fr 1.5fr;gap:clamp(.8rem,2cqw,1.6rem);align-items:center;padding:clamp(.7rem,1.6cqh,1.2rem) 0;border-top:1px solid var(--line);}
.lldeck .frow:last-child{border-bottom:1px solid var(--line);}
.lldeck .dark .frow{border-color:rgba(255,255,255,.14);}
.lldeck .frow .icon{margin-bottom:0;}
.lldeck .frow h3{font-size:clamp(.98rem,1.7cqw,1.5rem);}
.lldeck .frow p{color:var(--muted);font-size:clamp(.78rem,1.05cqw,1.08rem);}
.lldeck .dark .frow p{color:var(--on-dark-muted);}
/* full-bleed image / illustration */
.lldeck .fullbleed{position:absolute;inset:0;z-index:0;background:var(--dark1);display:grid;place-items:center;}
.lldeck .fullbleed img{width:100%;height:100%;object-position:center;display:block;}
.lldeck .fb-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:clamp(1.1rem,4cqw,3rem);background:linear-gradient(0deg,rgba(3,18,14,.82),rgba(3,18,14,.34) 60%,transparent);}
.lldeck .fb-cap h2{color:#fff;max-width:24ch;margin-top:.4rem;}
.lldeck .fb-cap .kicker{color:var(--on-dark-accent);}
.lldeck .fb-cap .kicker::before{background:var(--on-dark-accent);}
/* full-bleed clickable focus areas (hotspots) */
.lldeck .fb-hotspot{position:absolute;z-index:3;border:2px solid rgba(110,231,183,.85);border-radius:10px;background:rgba(16,185,129,.10);cursor:zoom-in;padding:0;transition:background .15s,border-color .15s;}
.lldeck .fb-hotspot:hover,.lldeck .fb-hotspot:focus-visible{background:rgba(16,185,129,.24);border-color:#6ee7b7;outline:none;}
.lldeck .fb-hotspot-badge{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:clamp(22px,2cqw,30px);height:clamp(22px,2cqw,30px);border-radius:50%;background:#10b981;color:#03120e;box-shadow:0 4px 12px rgba(0,0,0,.35);}
.lldeck .fb-hotspot-badge svg{width:58%;height:58%;}
.lldeck .fb-hint{position:absolute;left:50%;top:clamp(10px,1.6cqw,18px);transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:.5em;background:#10b981;color:#03120e;border-radius:999px;padding:.5em 1.1em;font-size:clamp(11px,1.05cqw,15px);font-weight:800;box-shadow:0 6px 20px rgba(16,185,129,.4);pointer-events:none;animation:fbpulse 2.6s ease-in-out infinite;}
.lldeck .fb-hint svg{width:1.1em;height:1.1em;}
@keyframes fbpulse{0%,100%{opacity:.9}50%{opacity:1}}
/* hero-image (edge-bleed) */
.lldeck .hero-img{position:absolute;top:0;right:0;bottom:0;width:42%;background-size:cover;background-position:center;z-index:0;display:grid;place-items:center;background-color:var(--dark2);}
.lldeck .hero-ph{color:var(--on-dark-muted);font-size:.8rem;}
.lldeck .hero-body{padding-right:46%;}
/* two labelled groups of cards (e.g. Clients / Collaborations) */
.lldeck .grps{display:grid;grid-template-columns:1fr 1fr;gap:clamp(1.4rem,4cqw,3rem);align-items:start;margin-top:clamp(1.8rem,4.4cqh,3rem);}
.lldeck .grp-head{display:flex;align-items:center;gap:.7rem;padding-bottom:.7rem;margin-bottom:1rem;border-bottom:2px solid color-mix(in srgb, var(--emerald) 30%, transparent);}
.lldeck .grp-head .icon{margin-bottom:0;width:clamp(32px,2.8cqw,42px);height:clamp(32px,2.8cqw,42px);}
.lldeck .grp-head h3{font-size:clamp(1.05rem,1.8cqw,1.5rem);letter-spacing:-.01em;}
.lldeck .grp-cards{display:flex;flex-direction:column;gap:clamp(.7rem,1.6cqh,1.1rem);}
.lldeck .grp-card{background:var(--card);border:1px solid var(--line);border-radius:var(--card-radius);box-shadow:var(--shadow);padding:clamp(.9rem,1.4cqw,1.2rem) clamp(1rem,1.6cqw,1.3rem);}
.lldeck .dark .grp-card{background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.12);backdrop-filter:blur(6px);box-shadow:none;}
.lldeck .grp-card h4{font-size:clamp(.95rem,1.3cqw,1.18rem);font-weight:700;line-height:1.2;}
.lldeck .grp-card p{font-size:clamp(.78rem,1cqw,1rem);color:var(--muted);line-height:1.45;margin-top:.25rem;}
.lldeck .dark .grp-card p{color:var(--on-dark-muted);}
.lldeck .grp-points{list-style:none;display:flex;flex-direction:column;gap:.4rem;margin-top:.6rem;}
.lldeck .grp-points li{display:flex;gap:.5rem;align-items:flex-start;font-size:clamp(.76rem,1cqw,.98rem);color:var(--muted);line-height:1.4;}
.lldeck .grp-points li::before{content:"";flex:none;width:16px;height:16px;margin-top:.12rem;border-radius:5px;background-color:var(--emerald);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E") center/11px no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E") center/11px no-repeat;}
.lldeck .dark .grp-points li{color:var(--on-dark-muted);}

/* numbered list (e.g. the report's assessment steps) */
.lldeck ol.numbered{list-style:none;display:flex;flex-direction:column;gap:.7rem;}
.lldeck ol.numbered li{display:flex;gap:.7rem;align-items:flex-start;font-size:clamp(.82rem,1.35cqw,1.3rem);line-height:1.5;}
.lldeck ol.numbered .n{flex:none;width:clamp(22px,2.4cqw,30px);height:clamp(22px,2.4cqw,30px);border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:clamp(.7rem,1cqw,.92rem);color:#fff;background:linear-gradient(135deg,var(--emerald),var(--emerald-dark));margin-top:.1rem;}
.lldeck .dark ol.numbered li{color:var(--on-dark);}

/* report — laptop mock-up. Screenshots are letterboxed (contain) on a light
   screen so the whole capture shows — portrait app shots aren't cropped, and
   wide web captures keep their full width. */
.lldeck .laptop{width:100%;max-width:760px;margin:0 auto;}
.lldeck .laptop .screen{border:clamp(7px,.9cqw,12px) solid #16181c;border-bottom:none;border-radius:14px 14px 0 0;background:#f4f4f5;aspect-ratio:16/10;overflow:hidden;box-shadow:0 30px 60px -28px rgba(0,0,0,.55);}
.lldeck .laptop .screen img{width:100%;height:100%;object-fit:contain;object-position:top center;display:block;}
.lldeck .laptop .screen .phone-ph{height:100%;color:var(--muted);}
.lldeck .laptop .laptop-base{height:clamp(10px,1.3cqw,16px);margin:0 -7%;border-radius:0 0 7px 7px;background:linear-gradient(180deg,#cfd3d9,#9aa0a8);position:relative;box-shadow:0 14px 22px -14px rgba(0,0,0,.45);}
.lldeck .laptop .laptop-base::after{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:14%;height:clamp(4px,.55cqw,7px);background:rgba(0,0,0,.16);border-radius:0 0 9px 9px;}
/* "click to enlarge" affordance above the report laptop (hidden in PDF export
   via the zoomable prop — a printed page can't be clicked). */
.lldeck .zoom-hint{display:flex;align-items:center;gap:.55em;width:fit-content;margin:0 auto clamp(.6rem,1.4cqh,1rem);background:var(--cyan,#22d3ee);color:#04202b;border-radius:999px;padding:.55em 1.15em;font-size:clamp(11px,1.05cqw,15px);font-weight:800;letter-spacing:.01em;cursor:pointer;box-shadow:0 6px 20px rgba(0,214,255,.4);animation:llzoomhint 2.6s ease-in-out infinite;}
.lldeck .zoom-hint svg{width:1.15em;height:1.15em;flex:none;}
@keyframes llzoomhint{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
/* checklist */
.lldeck .checklist{display:grid;gap:clamp(.7rem,1.6cqh,1.1rem) 2rem;}
.lldeck .checklist.cols-2{grid-template-columns:1fr 1fr;}
.lldeck .checklist.cols-1{grid-template-columns:1fr;}
.lldeck .check{display:flex;gap:.8rem;align-items:flex-start;font-size:clamp(.88rem,1.3cqw,1.3rem);line-height:1.4;}
.lldeck .check .cbox{flex:none;width:clamp(22px,2.2cqw,30px);height:clamp(22px,2.2cqw,30px);margin-top:.1rem;border-radius:8px;background:color-mix(in srgb, var(--emerald) 16%, transparent);position:relative;}
.lldeck .check .cbox::after{content:"";position:absolute;inset:0;background-color:var(--emerald);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E") center/64% no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E") center/64% no-repeat;}

/* ===== controls (present mode only) ===== */
.lldeck .deck-bar{position:absolute;top:0;left:0;height:4px;background:linear-gradient(90deg,var(--emerald),var(--cyan));z-index:50;transition:width .4s ease;box-shadow:0 0 12px color-mix(in srgb,var(--emerald) 60%, transparent);}
.lldeck .deck-nav{position:absolute;bottom:18px;right:22px;z-index:50;display:flex;align-items:center;gap:10px;}
.lldeck .deck-nav button{width:42px;height:42px;border-radius:50%;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.92);color:#0f2e25;cursor:pointer;font-size:1.1rem;display:grid;place-items:center;box-shadow:0 6px 18px -6px rgba(0,0,0,.3);transition:.2s;}
.lldeck .deck-nav button:hover{transform:translateY(-2px);background:#fff;}
.lldeck .deck-nav .count{font-variant-numeric:tabular-nums;font-weight:700;font-size:.95rem;color:#0f2e25;background:rgba(255,255,255,.92);border-radius:999px;padding:.45rem .8rem;box-shadow:0 6px 18px -6px rgba(0,0,0,.3);min-width:62px;text-align:center;}
.lldeck .deck-hint{position:absolute;bottom:22px;left:22px;z-index:50;font-size:.78rem;color:rgba(255,255,255,.5);}
.lldeck .deck-notes{position:absolute;left:0;right:0;bottom:0;z-index:60;background:#0a1f19;color:#cdeee2;border-top:2px solid var(--emerald);padding:1rem 1.4rem 1.2rem;transform:translateY(110%);transition:transform .3s ease;max-height:40%;overflow:auto;}
.lldeck .deck-notes.show{transform:none;}
.lldeck .deck-notes b{color:var(--on-dark-accent);letter-spacing:.1em;text-transform:uppercase;font-size:.72rem;display:block;margin-bottom:.4rem;}
.lldeck .deck-notes p{font-size:1rem;line-height:1.5;max-width:90ch;}

@container deck (max-width:720px){
  .lldeck .two,.lldeck .cols-3,.lldeck .cols-4,.lldeck .team{grid-template-columns:1fr;gap:1rem;}
  .lldeck .cols-2{grid-template-columns:1fr;}
}
`;

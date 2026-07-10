// Scoped stylesheet for the Fjarlækningar print collateral (A4 documents:
// reception poster, internal referral guide, newspaper advert). Self-contained
// — it does NOT depend on the deck's DECK_CSS. It only borrows the Fjarlækningar
// brand palette (electric cyan #00d6ff mark, #00a8cc primary, #cf147b magenta
// accent) and the `#fjar-logo` symbol from <DeckDefs>.
//
// Everything is namespaced under `.llcol`. Each document is a fixed A4 portrait
// page (`.a4`, 210×297mm). On screen the page is scaled to fit via a CSS var
// (`--fit`) set by the studio; in print the scale is dropped so the sheet prints
// at true A4. Print rules live in CollateralPrint (they portal to <body> and
// hide the admin chrome), mirroring the deck's DeckPrint approach.

export const COLLATERAL_CSS = `
.llcol{
  --cyan:#00d6ff; --primary:#00a8cc; --primary-dark:#0488a4;
  --accent:#cf147b; --accent-dark:#af146a;
  --ink:#0f2733; --body:#334155; --muted:#64748b; --line:#e3e9ef;
  --wash:#f5f9fc; --wash2:#eef6fb;
  --dark1:#062a38; --dark2:#0a4a5e;
  font-family:var(--font-inter),Inter,system-ui,sans-serif,
    "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji";
}

/* ── A4 page shell ─────────────────────────────────────────────────────── */
.llcol .a4{
  width:210mm; height:297mm; background:#fff; color:var(--body);
  position:relative; overflow:hidden;
  transform:scale(var(--fit,1)); transform-origin:top left;
  box-shadow:0 18px 60px -18px rgba(8,70,90,.45);
  display:flex; flex-direction:column;
  -webkit-font-smoothing:antialiased;
}
.llcol .a4 *{box-sizing:border-box;}

/* ── shared atoms ──────────────────────────────────────────────────────── */
.llcol .fjar-logo{display:block; height:11mm; width:auto;}

.llcol .grad-text{
  background:linear-gradient(100deg,var(--primary),var(--cyan));
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
/* background-clip:text leaves a stray gradient sliver at the text edge when
   printed to PDF — fall back to a solid brand colour for print. */
@media print{
  .llcol .grad-text{
    background:none!important; color:var(--primary)!important;
    -webkit-text-fill-color:var(--primary)!important;
  }
}
.llcol .pill{
  display:inline-flex; align-items:center; gap:2mm;
  border-radius:999px; padding:1.6mm 4mm; font-weight:700;
  font-size:9.5px; letter-spacing:.06em; text-transform:uppercase;
}
.llcol .pill.tint{background:var(--wash2); color:var(--primary-dark);}
.llcol .pill.solid{background:var(--ink); color:#fff;}
.llcol .pill.dot::before{content:""; width:6px; height:6px; border-radius:50%;
  background:var(--cyan); box-shadow:0 0 0 3px rgba(0,214,255,.28);}

.llcol .eyebrow{
  font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase;
  color:var(--primary-dark);
}
.llcol .eyebrow.on-dark{color:var(--cyan);}

.llcol .a4 h1{margin:0; color:var(--ink); font-weight:800; letter-spacing:-.02em; line-height:1.08;}
.llcol .a4 h2{margin:0; color:var(--ink); font-weight:800; letter-spacing:-.01em;}
.llcol .a4 p{margin:0;}

/* Emergency / footer strip common to all docs */
.llcol .safety{
  display:flex; align-items:center; gap:2.5mm;
  font-size:10.5px; color:var(--muted);
}
.llcol .safety b{color:var(--accent-dark);}

/* ── service tile grid (poster) ────────────────────────────────────────── */
.llcol .svc-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:3mm;}
.llcol .svc{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  gap:2mm; padding:3mm 2mm; border-radius:4mm;
  background:#fff; border:1px solid var(--line);
}
.llcol .svc img{width:13mm; height:13mm;}
.llcol .svc span{font-size:12px; font-weight:700; color:var(--ink); line-height:1.15;}

/* compact chip list (advert + referral) */
.llcol .svc-chips{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:3mm;}
.llcol .chip{
  display:flex; align-items:center; gap:2.5mm;
  border:1px solid var(--line); border-radius:999px; padding:2.6mm 4.5mm;
  font-size:11.5px; font-weight:700; color:var(--ink); background:#fff;
}
.llcol .chip img{width:7mm; height:7mm; flex-shrink:0;}

/* ── numbered steps ────────────────────────────────────────────────────── */
.llcol .steps{display:grid; gap:3mm;}
.llcol .steps.row{grid-template-columns:repeat(3,1fr);}
.llcol .step{position:relative; padding-left:0;}
.llcol .step .n{
  display:flex; align-items:center; justify-content:center;
  width:8mm; height:8mm; border-radius:50%; margin-bottom:2.4mm;
  background:linear-gradient(135deg,var(--primary),var(--cyan));
  color:#fff; font-weight:800; font-size:13px;
}
.llcol .step h3{margin:0 0 1mm; font-size:12.5px; font-weight:800; color:var(--ink);}
.llcol .step p{font-size:11px; line-height:1.35; color:var(--body);}

/* ── two-column suitability (referral) ─────────────────────────────────── */
.llcol .cols2{display:grid; grid-template-columns:1fr 1fr; gap:5mm;}
.llcol .panel{border-radius:4mm; padding:3.5mm 4.5mm; border:1px solid var(--line);}
.llcol .panel.yes{background:var(--wash); border-color:#cdeef7;}
.llcol .panel.no{background:#fdf2f6; border-color:#f5d3e1;}
.llcol .panel h3{margin:0 0 2mm; font-size:13px; font-weight:800; display:flex; align-items:center; gap:2mm;}
.llcol .panel.yes h3{color:var(--primary-dark);}
.llcol .panel.no h3{color:var(--accent-dark);}
.llcol .ticklist{list-style:none; margin:0; padding:0; display:grid; gap:1.3mm;}
.llcol .ticklist li{position:relative; padding-left:6mm; font-size:11px; line-height:1.3; color:var(--body);}
.llcol .ticklist li::before{position:absolute; left:0; top:0; font-weight:800;}
.llcol .panel.yes .ticklist li::before{content:"✓"; color:var(--primary);}
.llcol .panel.no .ticklist li::before{content:"✕"; color:var(--accent);}

/* generic bullet rows */
.llcol .rows{display:grid; gap:2mm;}
.llcol .rowitem{display:flex; gap:3mm; align-items:flex-start;}
.llcol .rowitem{align-items:center;}
.llcol .rowitem .k{
  flex:0 0 auto; min-width:8mm; height:8mm; padding:0 1.4mm; border-radius:2.5mm;
  display:flex; align-items:center; justify-content:center;
  background:var(--wash2); color:var(--primary);
  font-weight:800; font-size:10px; white-space:nowrap;
}
.llcol .rowitem .k svg{width:4.6mm; height:4.6mm;}
.llcol .rowitem .t{font-size:11px; line-height:1.4; color:var(--body);}
.llcol .rowitem .t b{color:var(--ink);}

/* share cards (referral) — three ways to share */
.llcol .share-card{
  display:flex; flex-direction:column; gap:2mm;
  border-radius:4mm; background:#fff; border:1px solid #cdeef7; padding:3mm 4mm;
  box-shadow:0 5px 16px -10px rgba(8,70,90,.4);
}
.llcol .share-head{display:flex; align-items:center; gap:2.5mm;}
.llcol .share-n{
  flex:0 0 auto; display:flex; align-items:center; justify-content:center;
  width:6mm; height:6mm; border-radius:50%; font-weight:800; font-size:11px; color:#fff;
  background:linear-gradient(135deg,var(--primary),var(--cyan));
}
.llcol .share-note{font-size:9px; color:var(--muted); margin-top:auto;}

/* section headers (referral) — accent bar + optional divider */
.llcol .sec-h2{font-size:14.5px; font-weight:800; color:var(--ink); margin:0 0 4mm; letter-spacing:-.01em;}
.llcol .sec-rule{border-top:1px solid var(--line); margin-bottom:4mm;}

/* dark hero band (poster + advert) */
.llcol .hero{
  position:relative; color:#eafaff; overflow:hidden; flex-shrink:0;
  background:
    radial-gradient(120% 120% at 90% -10%, rgba(0,214,255,.5), transparent 55%),
    radial-gradient(120% 120% at -10% 120%, rgba(207,20,123,.35), transparent 55%),
    linear-gradient(135deg,var(--dark1),var(--dark2));
}
.llcol .hero .eyebrow{color:var(--cyan);}
.llcol .hero h1{color:#fff;}
.llcol .hero p{color:#bfe6f2;}
`;

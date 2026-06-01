// Scoped stylesheet for the presentation deck. Every selector is namespaced
// under `.lldeck` and typography uses container-query units (cqw/cqh) so the
// same markup scales to fullscreen (public route) and to the editor preview
// box without a separate "scale" hack. The deck root must set
// `container-type: size`.
export const DECK_CSS = `
.lldeck{
  --emerald:#10B981; --emerald-dark:#047857; --cyan:#06B6D4; --ink:#0f2e25;
  --foreground:#1F2937; --muted:#5b6b66; --bg:#eef2f1; --card:#ffffff; --line:#dde5e2;
  --exercise:#EA580C; --nutrition:#65A30D; --sleep:#7C6FB0; --mental:#0EA5E9; --amber:#F59E0B;
  --shadow:0 10px 40px -12px rgba(6,78,59,.18);
  position:relative; width:100%; height:100%; overflow:hidden;
  container-type:size; container-name:deck;
  font-family:var(--font-inter), 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing:antialiased; color:var(--foreground); background:#06231c;
}
.lldeck *{box-sizing:border-box;margin:0;padding:0;}

.lldeck .slide{
  position:absolute; inset:0; display:flex; flex-direction:column;
  padding:6cqh 8cqw 8cqh; overflow:hidden;
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
    radial-gradient(1200px 800px at 12% -10%, rgba(16,185,129,.22), transparent 55%),
    radial-gradient(1000px 700px at 110% 120%, rgba(6,182,212,.18), transparent 55%),
    linear-gradient(135deg,#06231c 0%, #064e3b 55%, #07372b 100%);
  color:#eafaf3;
}

.lldeck h1{font-size:clamp(1.9rem,6cqw,5rem);font-weight:800;line-height:1.02;letter-spacing:-.03em;}
.lldeck h2{font-size:clamp(1.55rem,3.8cqw,3.1rem);font-weight:800;line-height:1.05;letter-spacing:-.025em;}
.lldeck h3{font-size:clamp(.95rem,1.6cqw,1.4rem);font-weight:700;letter-spacing:-.01em;}
.lldeck p,.lldeck li{font-size:clamp(.82rem,1.35cqw,1.3rem);line-height:1.55;font-weight:400;}
.lldeck .lead{font-size:clamp(.95rem,1.7cqw,1.6rem);line-height:1.5;color:var(--muted);font-weight:400;max-width:48ch;}
.lldeck .dark .lead{color:#bfe7d8;}
.lldeck .kicker{display:inline-flex;align-items:center;gap:.55rem;font-size:clamp(.62rem,.85cqw,.82rem);font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--emerald-dark);margin-bottom:1.2cqh;}
.lldeck .dark .kicker{color:#6ee7b7;}
.lldeck .kicker::before{content:"";width:26px;height:2px;background:currentColor;border-radius:2px;}
.lldeck .grad{background:linear-gradient(100deg,var(--emerald),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;}
.lldeck .accent{color:var(--emerald-dark);font-weight:700;}
.lldeck .dark .accent{color:#6ee7b7;}

.lldeck .slide-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:auto;gap:1rem;}
.lldeck .logo{display:flex;align-items:center;height:clamp(20px,2.1cqw,30px);color:var(--ink);}
.lldeck .dark .logo{color:#eafaf3;}
.lldeck .logo svg{height:clamp(20px,2.1cqw,30px);width:auto;display:block;}
.lldeck .tag-pill{font-size:clamp(.55rem,.78cqw,.72rem);font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--emerald-dark);border:1px solid var(--line);border-radius:999px;padding:.4rem .8rem;background:#fff;white-space:nowrap;}
.lldeck .dark .tag-pill{color:#a7f3d0;border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.06);}

.lldeck .body{margin:auto 0;width:100%;}

.lldeck .two{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(1.4rem,5cqw,5rem);align-items:center;}
.lldeck .cols-2{display:grid;grid-template-columns:repeat(2,1fr);gap:1.2rem;}
.lldeck .cols-3{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem;}
.lldeck .cols-4{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;}
.lldeck .stack{display:flex;flex-direction:column;gap:1.1rem;}

.lldeck .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1.3rem;box-shadow:var(--shadow);}
.lldeck .dark .card{background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.12);backdrop-filter:blur(6px);box-shadow:none;}
.lldeck .card h3{margin-bottom:.45rem;}
.lldeck .card p{color:var(--muted);font-size:clamp(.78rem,1cqw,1.02rem);}
.lldeck .dark .card p{color:#bfe7d8;}

.lldeck .icon{width:clamp(38px,3.4cqw,52px);height:clamp(38px,3.4cqw,52px);border-radius:13px;display:grid;place-items:center;margin-bottom:.9rem;background:rgba(16,185,129,.12);color:var(--emerald-dark);flex:none;}
.lldeck .icon svg{width:55%;height:55%;}
.lldeck .dark .icon{background:rgba(16,185,129,.18);color:#6ee7b7;}

.lldeck .step{display:flex;gap:.9rem;align-items:flex-start;}
.lldeck .step .num{flex:none;width:clamp(34px,3cqw,44px);height:clamp(34px,3cqw,44px);border-radius:50%;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--emerald),var(--emerald-dark));}
.lldeck .step h3{margin-bottom:.2rem;}
.lldeck .step p{color:var(--muted);}
.lldeck .dark .step p{color:#bfe7d8;}

.lldeck .stat{display:flex;flex-direction:column;}
.lldeck .stat .big{font-size:clamp(2rem,5cqw,4rem);font-weight:900;letter-spacing:-.03em;line-height:1;}
.lldeck .stat .lbl{color:var(--muted);font-size:clamp(.78rem,1cqw,1rem);margin-top:.35rem;}
.lldeck .dark .stat .lbl{color:#bfe7d8;}

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

.lldeck .quote{font-size:clamp(1.3rem,3.2cqw,2.7rem);font-weight:700;line-height:1.25;letter-spacing:-.02em;max-width:20ch;}

.lldeck .badge-soon{display:inline-flex;align-items:center;gap:.5rem;font-size:clamp(.55rem,.78cqw,.72rem);font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:999px;padding:.4rem .85rem;}
.lldeck .badge-soon .dot{width:8px;height:8px;border-radius:50%;background:var(--amber);box-shadow:0 0 0 4px rgba(245,158,11,.25);}

.lldeck .pad-row{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.2rem;}
.lldeck .chip{display:inline-flex;align-items:center;gap:.5rem;background:#fff;border:1px solid var(--line);border-radius:999px;padding:.5rem .95rem;font-weight:600;font-size:clamp(.78rem,1cqw,.95rem);}
.lldeck .dark .chip{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:#eafaf3;}
.lldeck .chip .cdot{width:9px;height:9px;border-radius:50%;background:var(--emerald);}

/* photo backgrounds */
.lldeck .slide-bg{position:absolute;inset:0;background-size:cover;background-position:center;z-index:0;}
.lldeck .slide-bg-ov{position:absolute;inset:0;z-index:1;}
.lldeck .dark .slide-bg-ov{background:linear-gradient(100deg,rgba(4,28,22,.94) 0%,rgba(5,55,43,.82) 48%,rgba(6,95,74,.40) 100%);}
.lldeck .light .slide-bg-ov{background:linear-gradient(100deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.78) 48%,rgba(255,255,255,.4) 100%);}
.lldeck .has-bg > .slide-head,.lldeck .has-bg > .body,.lldeck .has-bg > .footnote{position:relative;z-index:2;}

.lldeck .photo-frame{border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 60px -24px rgba(0,0,0,.55);}
.lldeck .light .photo-frame{border-color:#fff;box-shadow:var(--shadow);}
.lldeck .photo-frame img{width:100%;display:block;}
.lldeck .photo-cap{font-size:clamp(.72rem,.95cqw,.82rem);color:#bfe7d8;margin-top:.7rem;}
.lldeck .light .photo-cap{color:var(--muted);}

.lldeck .phone-shot{border:6px solid rgba(255,255,255,.16);border-radius:30px;overflow:hidden;background:#0a4d3a;box-shadow:0 30px 60px -22px rgba(0,0,0,.6);width:clamp(150px,16cqw,240px);aspect-ratio:9/19;margin:0 auto;}
.lldeck .light .phone-shot{border-color:#fff;box-shadow:var(--shadow);}
.lldeck .phone-shot img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}
.lldeck .phone-row{display:flex;gap:.8rem;justify-content:center;align-items:flex-end;}
.lldeck .phone-row .phone-shot{width:clamp(90px,11cqw,165px);margin:0;}
.lldeck .phone-row .phone-shot:nth-child(2){width:clamp(104px,12.5cqw,188px);margin-bottom:14px;}
.lldeck .phone-ph{display:grid;place-items:center;color:#bfe7d8;font-size:.8rem;text-align:center;height:100%;padding:1rem;}

.lldeck .team{display:grid;grid-template-columns:repeat(4,1fr);gap:1.3rem;margin-top:1.8cqh;}
.lldeck .member{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.5rem;}
.lldeck .member .photo{width:clamp(78px,9cqw,132px);height:clamp(78px,9cqw,132px);border-radius:50%;object-fit:cover;object-position:center top;border:3px solid #fff;background:#dfeae6;box-shadow:var(--shadow);}
.lldeck .member .ph-empty{display:grid;place-items:center;color:var(--muted);font-size:.7rem;}
.lldeck .member .flag{font-size:clamp(.58rem,.72cqw,.68rem);font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--emerald-dark);}
.lldeck .member h4{font-size:clamp(.88rem,1.1cqw,1.04rem);font-weight:700;line-height:1.2;}
.lldeck .member .role{font-size:clamp(.72rem,.9cqw,.82rem);color:var(--muted);line-height:1.35;max-width:22ch;}

.lldeck .tl{display:grid;grid-template-columns:repeat(5,1fr);gap:0;position:relative;margin-top:1rem;}
.lldeck .tl::before{content:"";position:absolute;left:6%;right:6%;top:clamp(16px,1.6cqw,22px);height:3px;background:linear-gradient(90deg,var(--emerald),var(--cyan));border-radius:3px;}
.lldeck .tl .node{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.6rem;position:relative;padding:0 .4rem;}
.lldeck .tl .dotn{width:clamp(34px,3.2cqw,46px);height:clamp(34px,3.2cqw,46px);border-radius:50%;background:#fff;border:3px solid var(--emerald);display:grid;place-items:center;color:var(--emerald-dark);z-index:1;}
.lldeck .dark .tl .dotn{background:#07372b;color:#6ee7b7;}
.lldeck .tl .dotn svg{width:46%;height:46%;}
.lldeck .tl h4{font-size:clamp(.82rem,1cqw,.98rem);font-weight:700;}
.lldeck .tl p{font-size:clamp(.66rem,.82cqw,.82rem);color:var(--muted);line-height:1.35;}
.lldeck .dark .tl p{color:#bfe7d8;}

.lldeck .footnote{font-size:clamp(.66rem,.82cqw,.78rem);color:var(--muted);margin-top:1.1cqh;}
.lldeck .dark .footnote{color:#8fc7b5;}

.lldeck .center{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;height:100%;}

/* ===== controls (present mode only) ===== */
.lldeck .deck-bar{position:absolute;top:0;left:0;height:4px;background:linear-gradient(90deg,var(--emerald),var(--cyan));z-index:50;transition:width .4s ease;box-shadow:0 0 12px rgba(16,185,129,.6);}
.lldeck .deck-nav{position:absolute;bottom:18px;right:22px;z-index:50;display:flex;align-items:center;gap:10px;}
.lldeck .deck-nav button{width:42px;height:42px;border-radius:50%;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.92);color:#0f2e25;cursor:pointer;font-size:1.1rem;display:grid;place-items:center;box-shadow:0 6px 18px -6px rgba(0,0,0,.3);transition:.2s;}
.lldeck .deck-nav button:hover{transform:translateY(-2px);background:#fff;}
.lldeck .deck-nav .count{font-variant-numeric:tabular-nums;font-weight:700;font-size:.95rem;color:#0f2e25;background:rgba(255,255,255,.92);border-radius:999px;padding:.45rem .8rem;box-shadow:0 6px 18px -6px rgba(0,0,0,.3);min-width:62px;text-align:center;}
.lldeck .deck-hint{position:absolute;bottom:22px;left:22px;z-index:50;font-size:.78rem;color:rgba(255,255,255,.5);}
.lldeck .deck-notes{position:absolute;left:0;right:0;bottom:0;z-index:60;background:#0a1f19;color:#cdeee2;border-top:2px solid var(--emerald);padding:1rem 1.4rem 1.2rem;transform:translateY(110%);transition:transform .3s ease;max-height:40%;overflow:auto;}
.lldeck .deck-notes.show{transform:none;}
.lldeck .deck-notes b{color:#6ee7b7;letter-spacing:.1em;text-transform:uppercase;font-size:.72rem;display:block;margin-bottom:.4rem;}
.lldeck .deck-notes p{font-size:1rem;line-height:1.5;max-width:90ch;}

@container deck (max-width:720px){
  .lldeck .two,.lldeck .cols-3,.lldeck .cols-4,.lldeck .team{grid-template-columns:1fr;gap:1rem;}
  .lldeck .cols-2{grid-template-columns:1fr;}
}
`;

// Probe the Flaticon CDN by ID range and render readable, labelled grids so you can
// identify icons and read their exact IDs (Flaticon's site is bot-blocked, but the PNG
// CDN is open: https://cdn-icons-png.flaticon.com/512/<floor(id/1000)>/<id>.png).
//
// Usage:  node probe-flaticon.mjs <start> <end>      e.g. node probe-flaticon.mjs 7350760 7350959
// Output: ./probe/batchN.png   (48 icons each, IDs labelled under every thumbnail)
//
// The iconfield color-fill MEDICAL pack containing the herpes icon (7350791) lives in the
// block ~7350760–7350959+ (interleaved with iconfield's numbers/typography packs).
import { mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire('/home/mads/lifeline-website/package.json');
const sharp = require('sharp');

const start = Number(process.argv[2] || 7350760);
const end   = Number(process.argv[3] || 7350959);
const OUT = '/home/mads/lifeline-website/fjarlaekningar-icons/flaticon/probe';
mkdirSync(OUT, { recursive: true });

const ids = []; for (let id = start; id <= end; id++) ids.push(id);
const res = await Promise.all(ids.map(async id => {
  const g = Math.floor(id / 1000);
  try { const r = await fetch(`https://cdn-icons-png.flaticon.com/512/${g}/${id}.png`);
    if (r.status !== 200) return null; const b = Buffer.from(await r.arrayBuffer());
    return b.length < 800 ? null : { id, b }; } catch { return null; }
}));
const ok = res.filter(Boolean);

const T = 150, GAP = 6, COLS = 8, LBL = 18, PER = 48;
for (let p = 0; p < Math.ceil(ok.length / PER); p++) {
  const slice = ok.slice(p * PER, (p + 1) * PER); let comp = [];
  for (let i = 0; i < slice.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const th = await sharp(slice[i].b).resize(T - 12, T - 12, { fit: 'inside', background: '#fff' }).flatten({ background: '#fff' }).toBuffer();
    const m = await sharp(th).metadata();
    const cell = await sharp({ create: { width: T, height: T + LBL, channels: 4, background: { r:255,g:255,b:255,alpha:1 } } })
      .composite([{ input: th, left: Math.round((T - m.width)/2), top: Math.round((T-12-m.height)/2)+2 },
        { input: Buffer.from(`<svg width="${T}" height="${LBL}"><text x="${T/2}" y="14" font-family="Arial" font-size="13" fill="#111" text-anchor="middle">${slice[i].id}</text></svg>`), left: 0, top: T }]).png().toBuffer();
    comp.push({ input: cell, left: GAP + col*(T+GAP), top: GAP + row*(T+LBL+GAP) });
  }
  const rows = Math.ceil(slice.length / COLS), W = GAP + COLS*(T+GAP), H = GAP + rows*(T+LBL+GAP);
  await sharp({ create: { width: W, height: H, channels: 4, background: { r:250,g:250,b:250,alpha:1 } } }).composite(comp).png().toFile(`${OUT}/batch${p+1}.png`);
}
console.log(`rendered ${Math.ceil(ok.length/PER)} batches, ${ok.length} icons, range ${start}-${end}`);

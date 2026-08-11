import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire('/home/mads/lifeline-website/package.json');
const sharp = require('sharp');

const OUT = '/home/mads/lifeline-website/fjarlaekningar-icons/sourced';
const BLUE = '2563EB', BLUEH = '#2563EB', TILE = '#EFF4FF';
const CANVAS = 256, BOX = 152;   // icon fits within BOX, centered in CANVAS

// service slug -> [iconId | 'composite:ristill', label]
const map = [
  ['frjokornaofnaemi',           'mdi:flower-pollen-outline',                        'Frjókornaofnæmi'],
  ['frunsa',                     'healthicons:mouth-outline',                        'Frunsa'],
  ['getnadarvorn',               'healthicons:oral-contraception-pillsx21-outline',  'Getnaðarvörn'],
  ['kvef-hosti-halsbolga',       'healthicons:coughing-outline',                     'Kvef, hósti eða hálsbólga'],
  ['lyfjuendurnyjun',            'healthicons:medicines-outline',                    'Lyfjuendurnýjun'],
  ['njalgur',                    'healthicons:intestine-outline',                    'Njálgur'],
  ['ristill',                    'composite:ristill',                                'Ristill'],
  ['risvandamal',                'healthicons:penis-outline',                        'Risvandamál'],
  ['thvagfaera-leggangasykingar','healthicons:female-reproductive-system-outline',   'Þvagfæra- og leggangasýkingar'],
];

mkdirSync(`${OUT}/svg`, { recursive: true });
mkdirSync(`${OUT}/png`, { recursive: true });

async function fetchSvg(id, color) {
  const u = `https://api.iconify.design/${id}.svg${color ? `?color=%23${color}` : ''}`;
  const t = await (await fetch(u)).text();
  return t.startsWith('<svg') ? t : null;
}
const innerOf = (svg) => svg.replace(/^<svg[^>]*>/, '').replace('</svg>', '');

// Ristill = sourced ARM (line art) + a localized CLUSTER of vesicles on the forearm.
// Vesicles are solid `col` discs so they read on the hollow line-art arm.
function ristillSvg(armInner, col) {
  const s = 1.18, cx = 12.5, cy = 29.9;
  const ves = [[-1.7,-1.5],[0.2,-2.1],[1.9,-1.1],[-2,0.4],[0,-0.1],[1.7,0.6],[-0.9,1.7],[1,1.6]]
    .map(([dx,dy]) => `<circle cx="${cx+dx*s}" cy="${cy+dy*s}" r="${1.15*s}" fill="${col}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><g fill="${col}">${armInner}</g>${ves}</svg>`;
}

async function glyphFor(id, color) {
  if (id === 'composite:ristill') {
    const arm = await fetchSvg('healthicons:arm-outline');   // currentColor original
    return ristillSvg(innerOf(arm).replace(/fill="currentColor"/g, ''), color ? BLUEH : 'currentColor');
  }
  return fetchSvg(id, color ? BLUE : null);
}

// render an svg, trim transparent margins, fit into BOX, centre on CANVAS (transparent)
async function centeredPng(svg) {
  const big = await sharp(Buffer.from(svg), { density: 600 })
    .resize(480, 480, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const trimmed = await sharp(big).trim({ threshold: 1 })
    .resize(BOX, BOX, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const m = await sharp(trimmed).metadata();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, left: Math.round((CANVAS - m.width) / 2), top: Math.round((CANVAS - m.height) / 2) }])
    .png().toBuffer();
}

const tileBgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}"><rect width="${CANVAS}" height="${CANVAS}" rx="56" fill="${TILE}"/></svg>`;
const tileBg = await sharp(Buffer.from(tileBgSvg)).png().toBuffer();

const cards = [];
for (const [slug, id, label] of map) {
  const orig = await glyphFor(id, false);   // currentColor (themeable)
  const blue = await glyphFor(id, true);    // brand blue
  writeFileSync(`${OUT}/svg/${slug}.svg`, orig);
  writeFileSync(`${OUT}/svg/${slug}.blue.svg`, blue);

  const glyphPng = await centeredPng(blue);
  writeFileSync(`${OUT}/png/${slug}.png`, glyphPng);
  const tilePng = await sharp(tileBg).composite([{ input: glyphPng }]).png().toBuffer();
  writeFileSync(`${OUT}/png/${slug}.tile.png`, tilePng);

  // centred tile SVG (icon scaled to fit a centred 36px box on a 64 tile)
  const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect width="64" height="64" rx="16" fill="${TILE}"/>
    <image x="14" y="14" width="36" height="36" href="data:image/png;base64,${glyphPng.toString('base64')}"/></svg>`;
  writeFileSync(`${OUT}/svg/${slug}.tile.svg`, tileSvg);

  cards.push([slug, label, glyphPng.toString('base64')]);
}

// contact sheet — real UI card layout, icons centred via the pre-centred PNGs
const cols = 3, cw = 380, ch = 150, pad = 24;
const rows = Math.ceil(cards.length / cols);
let g = '';
cards.forEach(([slug, label, b64], i) => {
  const x = pad + (i % cols) * (cw + pad);
  const y = pad + Math.floor(i / cols) * (ch + pad);
  g += `<g transform="translate(${x},${y})">
    <rect width="${cw}" height="${ch}" rx="14" fill="#fff" stroke="#E6EAF2"/>
    <rect x="26" y="34" width="64" height="64" rx="16" fill="${TILE}"/>
    <image x="40" y="48" width="36" height="36" href="data:image/png;base64,${b64}"/>
    <text x="112" y="58" font-family="Arial" font-size="20" font-weight="700" fill="#0F172A">${label.replace(/&/g,'&amp;')}</text>
    <text x="112" y="84" font-family="Arial" font-size="13" fill="#64748B">Greining og meðferð</text>
  </g>`;
});
const W = pad + cols * (cw + pad), H = pad + rows * (ch + pad);
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#FAFAF7"/>${g}</svg>`;
await sharp(Buffer.from(sheet)).png().toFile(`${OUT}/contact-sheet.png`);
console.log('sourced set (centred) ->', OUT);

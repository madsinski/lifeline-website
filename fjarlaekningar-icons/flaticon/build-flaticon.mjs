import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire('/home/mads/lifeline-website/package.json');
const sharp = require('sharp');

const OUT = '/home/mads/lifeline-website/fjarlaekningar-icons/flaticon';
const TILE = '#EFF4FF';
mkdirSync(`${OUT}/png`, { recursive: true });

// slug -> [flaticonId | null, IS label, EN hint for what to find in iconfield's pack]
const map = [
  ['frjokornaofnaemi',            null,     'Frjókornaofnæmi', 'pollen / allergy / sneeze'],
  ['frunsa',                      7350791,  'Frunsa', 'cold sore / herpes (DONE)'],
  ['getnadarvorn',                null,     'Getnaðarvörn', 'contraception / birth-control pills'],
  ['kvef-hosti-halsbolga',        null,     'Kvef, hósti eða hálsbólga', 'cough / cold / sore throat'],
  ['lyfjuendurnyjun',             null,     'Lyfjuendurnýjun', 'medicine / pills / prescription'],
  ['njalgur',                     null,     'Njálgur', 'worm / parasite / intestine'],
  ['ristill',                     null,     'Ristill', 'shingles / rash / skin'],
  ['risvandamal',                 null,     'Risvandamál', 'erectile dysfunction / penis'],
  ['thvagfaera-leggangasykingar', null,     'Þvagfæra- og leggangasýkingar', 'UTI / uterus / vaginal'],
];

async function fetchPng(id) {
  const g = Math.floor(id / 1000);
  const r = await fetch(`https://cdn-icons-png.flaticon.com/512/${g}/${id}.png`);
  if (r.status !== 200) return null;
  return Buffer.from(await r.arrayBuffer());
}

async function centered(buf, canvas = 256, box = 150) {
  const ic = await sharp(buf).resize(box, box, { fit: 'inside', background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
  const m = await sharp(ic).metadata();
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
    .composite([{ input: ic, left: Math.round((canvas - m.width)/2), top: Math.round((canvas - m.height)/2) }]).png().toBuffer();
}

const tileBg = await sharp(Buffer.from(`<svg width="256" height="256"><rect width="256" height="256" rx="56" fill="${TILE}"/></svg>`)).png().toBuffer();
const placeholder = await sharp(Buffer.from(`<svg width="256" height="256"><rect width="256" height="256" rx="56" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="3" stroke-dasharray="10 8"/><text x="128" y="138" font-family="Arial" font-size="120" fill="#CBD5E1" text-anchor="middle">?</text></svg>`)).png().toBuffer();

const cards = [];
for (const [slug, id, label, hint] of map) {
  let tile;
  if (id) {
    const buf = await fetchPng(id);
    const glyph = await centered(buf);
    writeFileSync(`${OUT}/png/${slug}.png`, glyph);
    tile = await sharp(tileBg).composite([{ input: glyph }]).png().toBuffer();
    writeFileSync(`${OUT}/png/${slug}.tile.png`, tile);
  } else {
    tile = placeholder;
  }
  cards.push([label, hint, !!id, await sharp(tile).resize(96,96).png().toBuffer()]);
}

// contact sheet / shopping list
const cols = 3, cw = 400, ch = 150, pad = 24;
const rows = Math.ceil(cards.length / cols);
let g = '';
for (let i = 0; i < cards.length; i++) {
  const [label, hint, done, t96] = cards[i];
  const x = pad + (i % cols) * (cw + pad), y = pad + Math.floor(i / cols) * (ch + pad);
  g += `<g transform="translate(${x},${y})">
    <rect width="${cw}" height="${ch}" rx="14" fill="#fff" stroke="${done ? '#86EFAC' : '#E6EAF2'}"/>
    <image x="26" y="34" width="96" height="96" href="data:image/png;base64,${t96.toString('base64')}"/>
    <text x="138" y="56" font-family="Arial" font-size="18" font-weight="700" fill="#0F172A">${label.replace(/&/g,'&amp;')}</text>
    <text x="138" y="80" font-family="Arial" font-size="12" fill="${done ? '#16A34A' : '#94A3B8'}">${done ? '✓ have it (herpes)' : 'need: ' + hint}</text>
  </g>`;
}
const W = pad + cols * (cw + pad), H = pad + rows * (ch + pad);
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#FAFAF7"/>${g}</svg>`)).png().toFile(`${OUT}/contact-sheet.png`);
console.log('flaticon scaffold ->', OUT);

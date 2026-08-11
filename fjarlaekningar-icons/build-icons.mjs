import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire('/home/mads/lifeline-website/package.json');
const sharp = require('sharp');

const OUT = '/home/mads/lifeline-website/fjarlaekningar-icons';

// --- Design system v2 -------------------------------------------------------
// Semantic two-tone: INK = body / anatomy / object,  SIG = the symptom / the
// affected area. The warm signal is always placed where the patient feels it.
const INK  = '#2563EB';   // brand blue — line
const FILL = '#DBEAFE';   // soft blue fill
const SIG  = '#F43F5E';   // rose — the ailment / symptom
const SIGF = '#FFE1E6';   // soft rose fill
const TILE = '#EFF4FF';   // pastel tile
const SW = 2.2;

// helper: 5 rotated copies of a petal around a center
const petals = (cx, cy) =>
  [0, 72, 144, 216, 288].map(a =>
    `<path transform="rotate(${a} ${cx} ${cy})"
       d="M${cx},${cy} C${cx-3.2},${cy-2.4} ${cx-3.0},${cy-9.5} ${cx},${cy-11.5}
                       C${cx+3.0},${cy-9.5} ${cx+3.2},${cy-2.4} ${cx},${cy} Z"
       fill="${FILL}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`
  ).join('');

const icons = {
  // 1. Pollen / seasonal allergy — flower (blue) + drifting allergen motes (rose)
  'frjokornaofnaemi': `
    <path d="M19,22 V41" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linecap="round"/>
    <path d="M19,33 C22,30.5 26,31.5 27.5,34 C24.5,36.5 20.5,35.5 19,33 Z"
          fill="${FILL}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
    ${petals(19, 20)}
    <circle cx="19" cy="20" r="3.1" fill="${SIG}"/>
    <g fill="${SIG}">
      <circle cx="33" cy="9"  r="1.6"/>
      <circle cx="37" cy="12" r="1.2"/>
      <circle cx="33.5" cy="14" r="1"/>
    </g>
    <path d="M39,7.5 v3 M37.5,9 h3" stroke="${SIG}" stroke-width="1.5" stroke-linecap="round"/>`,

  // 2. Cold sore — lips with a real cupid's bow (blue) + blister cluster (rose)
  'frunsa': `
    <g stroke="${INK}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11.5,26.5
               C13.5,23.8 15,23.2 16.5,23.2 C18.3,23.2 19.2,24.4 20,25.2
               C21.3,26.2 22.7,26.4 24,26.4 C25.3,26.4 26.7,26.2 28,25.2
               C28.8,24.4 29.7,23.2 31.5,23.2 C33,23.2 34.5,23.8 36.5,26.5
               C33.5,33.8 14.5,33.8 11.5,26.5 Z" fill="${FILL}"/>
      <path d="M11.5,26.5 C17,29.2 31,29.2 36.5,26.5" fill="none"/>
    </g>
    <g stroke="${SIG}" stroke-width="1.6">
      <circle cx="15.4" cy="24.1" r="1.9" fill="${SIGF}"/>
      <circle cx="17.9" cy="22.7" r="1.4" fill="${SIGF}"/>
      <circle cx="16.2" cy="21.4" r="1.1" fill="${SIGF}"/>
    </g>
    <path d="M12.2,20.4 l-1.4,-1.2 M21.2,21.2 l1.6,-1.3" stroke="${SIG}" stroke-width="1.4" stroke-linecap="round"/>`,

  // 3. Contraception — 21-day dial pack (blue), today's pill highlighted (rose)
  'getnadarvorn': `
    <g stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round">
      <circle cx="24" cy="24" r="15" fill="${FILL}"/>
      <circle cx="24" cy="24" r="4" fill="#ffffff"/>
      <path d="M24,11 v2.4" stroke-linecap="round"/>
    </g>
    <g fill="${INK}">
      <circle cx="34" cy="24" r="2.1"/>
      <circle cx="31.07" cy="31.07" r="2.1"/>
      <circle cx="24" cy="34" r="2.1"/>
      <circle cx="16.93" cy="31.07" r="2.1"/>
      <circle cx="14" cy="24" r="2.1"/>
      <circle cx="16.93" cy="16.93" r="2.1"/>
      <circle cx="31.07" cy="16.93" r="2.1"/>
    </g>
    <circle cx="24" cy="14" r="2.6" fill="${SIG}"/>`,

  // 4. Cold / cough / sore throat — thermometer with warm fever (rose) + cough waves
  'kvef-hosti-halsbolga': `
    <g stroke="${INK}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
      <rect x="16.6" y="8" width="6.8" height="22" rx="3.4" fill="#ffffff"/>
      <path d="M22,13 h-1.6 M22,17.5 h-1.6 M22,22 h-1.6" stroke-width="1.5"/>
      <circle cx="20" cy="34" r="6" fill="${SIGF}"/>
    </g>
    <path d="M20,16 V31" stroke="${SIG}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="20" cy="34" r="2.7" fill="${SIG}"/>
    <g stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M30,14 q3.5,-3 7,0"/>
      <path d="M30,20 q3.5,-3 7,0"/>
      <path d="M30,26 q3.5,-3 7,0"/>
    </g>`,

  // 5. Prescription renewal — two-tone capsule inside a single clean refresh ring
  'lyfjuendurnyjun': `
    <g fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M37,16 A15,15 0 1 0 39,25"/>
      <path d="M37,16 l-5.4,0.4 M37,16 l0.6,5.4"/>
    </g>
    <g transform="rotate(-45 24 24)">
      <path d="M15.5,24.1 a3.1,3.1 0 0 1 3.1,-3.1 H24 v6.2 H18.6 a3.1,3.1 0 0 1 -3.1,-3.1 Z"
            fill="${FILL}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M24,21 H29.4 a3.1,3.1 0 0 1 0,6.2 H24 Z"
            fill="${SIGF}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
    </g>`,

  // 6. Pinworm — elegant segmented worm (blue), the pest itself
  'njalgur': `
    <path d="M11,30 C15,21 21,38 27,28 C31,21 36,29 39,22.5"
          fill="none" stroke="${INK}" stroke-width="5.4" stroke-linecap="round"/>
    <path d="M11,30 C15,21 21,38 27,28 C31,21 36,29 39,22.5"
          fill="none" stroke="#ffffff" stroke-width="1.1" stroke-dasharray="0.1 5" stroke-linecap="round"/>
    <circle cx="39" cy="22.5" r="1.2" fill="#ffffff"/>`,

  // 7. Shingles — skin swatch (blue) with a band of blisters + nerve pain (rose)
  'ristill': `
    <g transform="rotate(-12 24 25)">
      <rect x="9.5" y="14.5" width="29" height="21" rx="7"
            fill="${FILL}" stroke="${INK}" stroke-width="${SW}"/>
    </g>
    <g stroke="${SIG}" stroke-width="1.7">
      <circle cx="16.5" cy="29" r="2.1" fill="${SIGF}"/>
      <circle cx="21" cy="26" r="2.4" fill="${SIGF}"/>
      <circle cx="25.5" cy="23.5" r="2.1" fill="${SIGF}"/>
      <circle cx="22.5" cy="31" r="1.9" fill="${SIGF}"/>
      <circle cx="29.5" cy="22" r="1.8" fill="${SIGF}"/>
      <circle cx="28" cy="27" r="1.7" fill="${SIGF}"/>
    </g>
    <path d="M33,15 l2.6,-2.4 M36.5,18.5 l3,-1.6 M30,12.5 l1.4,-3"
          stroke="${SIG}" stroke-width="1.8" stroke-linecap="round"/>`,

  // 8. Erectile dysfunction — confidence/vitality restored: heart lifting upward (calm blue)
  'risvandamal': `
    <path d="M24,40 C18.5,35.6 12.5,31.6 12.5,25.4 C12.5,21.4 15.6,19.2 18.7,19.2
             C21,19.2 23.1,20.5 24,22.6 C24.9,20.5 27,19.2 29.3,19.2
             C32.4,19.2 35.5,21.4 35.5,25.4 C35.5,31.6 29.5,35.6 24,40 Z"
          fill="${FILL}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>
    <g stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M24,28 V8.5"/>
      <path d="M17.6,14.9 L24,8.5 L30.4,14.9"/>
    </g>`,

  // 9. UTI / vaginal infection — bladder (blue) + infected drop & burning sting (rose)
  'thvagfaera-leggangasykingar': `
    <g stroke="${INK}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16,21 C16,15.5 20.5,13 24,13 C27.5,13 32,15.5 32,21
               C34,22 35,25 35,28.5 C35,34.5 30,38.5 24,38.5
               C18,38.5 13,34.5 13,28.5 C13,25 14,22 16,21 Z" fill="#ffffff"/>
      <path d="M18.5,14.4 l-2.4,-4 M29.5,14.4 l2.4,-4" fill="none"/>
    </g>
    <path d="M24,22.5 C24,22.5 19.6,28 19.6,31 a4.4,4.4 0 0 0 8.8,0 C28.4,28 24,22.5 24,22.5 Z"
          fill="${SIGF}" stroke="${SIG}" stroke-width="${SW}" stroke-linejoin="round"/>
    <g stroke="${SIG}" stroke-width="1.8" stroke-linecap="round">
      <path d="M24,38.5 v3.5 M20.5,40.5 l-1.4,2.4 M27.5,40.5 l1.4,2.4"/>
    </g>`,
};

const labels = {
  'frjokornaofnaemi': 'Frjókornaofnæmi',
  'frunsa': 'Frunsa',
  'getnadarvorn': 'Getnaðarvörn',
  'kvef-hosti-halsbolga': 'Kvef, hósti eða hálsbólga',
  'lyfjuendurnyjun': 'Lyfjuendurnýjun',
  'njalgur': 'Njálgur',
  'ristill': 'Ristill',
  'risvandamal': 'Risvandamál',
  'thvagfaera-leggangasykingar': 'Þvagfæra- og leggangasýkingar',
};

const wrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="none">${inner}</svg>`;

mkdirSync(`${OUT}/svg`, { recursive: true });
mkdirSync(`${OUT}/png`, { recursive: true });

const order = Object.keys(icons);
for (const key of order) {
  const glyph = wrap(icons[key]).trim();
  writeFileSync(`${OUT}/svg/${key}.svg`, glyph);
  const tiled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect width="64" height="64" rx="16" fill="${TILE}"/>
    <g transform="translate(8,8)">${icons[key]}</g></svg>`;
  writeFileSync(`${OUT}/svg/${key}.tile.svg`, tiled.trim());
  await sharp(Buffer.from(glyph), { density: 384 }).resize(256, 256).png().toFile(`${OUT}/png/${key}.png`);
  await sharp(Buffer.from(tiled), { density: 384 }).resize(256, 256).png().toFile(`${OUT}/png/${key}.tile.png`);
}

// contact sheet (real-UI card layout)
const cols = 3, cw = 380, ch = 150, pad = 24;
const rows = Math.ceil(order.length / cols);
let cards = '';
order.forEach((key, i) => {
  const cx = pad + (i % cols) * (cw + pad);
  const cy = pad + Math.floor(i / cols) * (ch + pad);
  cards += `<g transform="translate(${cx},${cy})">
    <rect width="${cw}" height="${ch}" rx="14" fill="#ffffff" stroke="#E6EAF2"/>
    <rect x="26" y="34" width="64" height="64" rx="16" fill="${TILE}"/>
    <g transform="translate(34,42)">${icons[key]}</g>
    <text x="112" y="58" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#0F172A">${labels[key]}</text>
    <text x="112" y="84" font-family="Arial, sans-serif" font-size="13" fill="#64748B">Greining og meðferð</text>
  </g>`;
});
const W = pad + cols * (cw + pad), H = pad + rows * (ch + pad);
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#FAFAF7"/>${cards}</svg>`;
writeFileSync(`${OUT}/contact-sheet.svg`, sheet);
await sharp(Buffer.from(sheet)).png().toFile(`${OUT}/contact-sheet.png`);
console.log('v2: wrote', order.length, 'icons + contact sheet ->', OUT);

/**
 * Icelandic postcodes (póstnúmer) -> place names (staðir).
 *
 * Source: Pósturinn (Iceland Post) official postcode list
 *   https://www.postur.is/gogn/Gotuskra/postnumer.txt
 * Retrieved: 2026-10-17. Count: 195 codes. Place names exactly as published
 * (note: Pósturinn uses the dative form for some, e.g. "Vestmannaeyjum").
 * `kind` mirrors Pósturinn's "Tegund" column: 'box' = Pósthólf (PO box only),
 * 'rural' = Dreifbýli, 'town' = Stærra dreifbýli (larger delivery area).
 */
export type IsPostcodeKind = "box" | "rural" | "town";
export type IsPostcode = { code: string; place: string; kind?: IsPostcodeKind };

export const IS_POSTCODES: readonly IsPostcode[] = [
  { code: "101", place: "Reykjavík", kind: "town" },
  { code: "102", place: "Reykjavík", kind: "town" },
  { code: "103", place: "Reykjavík", kind: "town" },
  { code: "104", place: "Reykjavík", kind: "town" },
  { code: "105", place: "Reykjavík", kind: "town" },
  { code: "107", place: "Reykjavík", kind: "town" },
  { code: "108", place: "Reykjavík", kind: "town" },
  { code: "109", place: "Reykjavík", kind: "town" },
  { code: "110", place: "Reykjavík", kind: "town" },
  { code: "111", place: "Reykjavík", kind: "town" },
  { code: "112", place: "Reykjavík", kind: "town" },
  { code: "113", place: "Reykjavík", kind: "town" },
  { code: "116", place: "Reykjavík", kind: "town" },
  { code: "121", place: "Reykjavík", kind: "box" },
  { code: "123", place: "Reykjavík", kind: "box" },
  { code: "124", place: "Reykjavík", kind: "box" },
  { code: "125", place: "Reykjavík", kind: "box" },
  { code: "127", place: "Reykjavík", kind: "box" },
  { code: "128", place: "Reykjavík", kind: "box" },
  { code: "129", place: "Reykjavík", kind: "box" },
  { code: "130", place: "Reykjavík", kind: "box" },
  { code: "132", place: "Reykjavík", kind: "box" },
  { code: "150", place: "Reykjavík", kind: "rural" },
  { code: "155", place: "Reykjavík", kind: "rural" },
  { code: "161", place: "Reykjavík", kind: "rural" },
  { code: "162", place: "Reykjavík", kind: "rural" },
  { code: "170", place: "Seltjarnarnesi", kind: "town" },
  { code: "172", place: "Seltjarnarnesi", kind: "box" },
  { code: "190", place: "Vogum", kind: "town" },
  { code: "191", place: "Vogum", kind: "rural" },
  { code: "200", place: "Kópavogi", kind: "town" },
  { code: "201", place: "Kópavogi", kind: "town" },
  { code: "202", place: "Kópavogi", kind: "box" },
  { code: "203", place: "Kópavogi", kind: "town" },
  { code: "206", place: "Kópavogi", kind: "rural" },
  { code: "210", place: "Garðabæ", kind: "town" },
  { code: "212", place: "Garðabæ", kind: "box" },
  { code: "220", place: "Hafnarfirði", kind: "town" },
  { code: "221", place: "Hafnarfirði", kind: "town" },
  { code: "222", place: "Hafnarfirði", kind: "box" },
  { code: "225", place: "Garðabæ", kind: "town" },
  { code: "230", place: "Reykjanesbæ", kind: "town" },
  { code: "232", place: "Reykjanesbæ", kind: "box" },
  { code: "233", place: "Reykjanesbæ", kind: "town" },
  { code: "235", place: "Keflavíkurflugvelli", kind: "town" },
  { code: "240", place: "Grindavík", kind: "town" },
  { code: "241", place: "Grindavík", kind: "rural" },
  { code: "245", place: "Sandgerði", kind: "town" },
  { code: "246", place: "Sandgerði", kind: "rural" },
  { code: "250", place: "Garði", kind: "town" },
  { code: "251", place: "Garði", kind: "rural" },
  { code: "260", place: "Reykjanesbæ", kind: "town" },
  { code: "262", place: "Reykjanesbæ", kind: "town" },
  { code: "270", place: "Mosfellsbæ", kind: "town" },
  { code: "271", place: "Mosfellsbæ", kind: "town" },
  { code: "276", place: "Kjós", kind: "town" },
  { code: "300", place: "Akranesi", kind: "town" },
  { code: "301", place: "Akranesi", kind: "rural" },
  { code: "302", place: "Akranesi", kind: "box" },
  { code: "310", place: "Borgarnesi", kind: "town" },
  { code: "311", place: "Borgarnesi", kind: "rural" },
  { code: "320", place: "Reykholti", kind: "town" },
  { code: "340", place: "Stykkishólmi", kind: "town" },
  { code: "341", place: "Stykkishólmi", kind: "rural" },
  { code: "342", place: "Stykkishólmi", kind: "rural" },
  { code: "345", place: "Flatey", kind: "town" },
  { code: "350", place: "Grundarfirði", kind: "town" },
  { code: "351", place: "Grundarfirði", kind: "rural" },
  { code: "355", place: "Ólafsvík", kind: "town" },
  { code: "356", place: "Snæfellsbæ", kind: "town" },
  { code: "360", place: "Hellissandi", kind: "town" },
  { code: "370", place: "Búðardal", kind: "town" },
  { code: "371", place: "Búðardal", kind: "rural" },
  { code: "380", place: "Reykhólahreppi", kind: "town" },
  { code: "381", place: "Reykhólahreppi", kind: "rural" },
  { code: "400", place: "Ísafirði", kind: "town" },
  { code: "401", place: "Ísafirði", kind: "rural" },
  { code: "410", place: "Hnífsdal", kind: "town" },
  { code: "415", place: "Bolungarvík", kind: "town" },
  { code: "416", place: "Bolungarvík", kind: "rural" },
  { code: "420", place: "Súðavík", kind: "town" },
  { code: "421", place: "Súðavík", kind: "rural" },
  { code: "425", place: "Flateyri", kind: "town" },
  { code: "426", place: "Flateyri", kind: "rural" },
  { code: "430", place: "Suðureyri", kind: "town" },
  { code: "431", place: "Suðureyri", kind: "rural" },
  { code: "450", place: "Patreksfirði", kind: "town" },
  { code: "451", place: "Patreksfirði", kind: "rural" },
  { code: "460", place: "Tálknafirði", kind: "town" },
  { code: "461", place: "Tálknafirði", kind: "rural" },
  { code: "465", place: "Bíldudal", kind: "town" },
  { code: "466", place: "Bíldudal", kind: "rural" },
  { code: "470", place: "Þingeyri", kind: "town" },
  { code: "471", place: "Þingeyri", kind: "rural" },
  { code: "500", place: "Stað", kind: "town" },
  { code: "510", place: "Hólmavík", kind: "town" },
  { code: "511", place: "Hólmavík", kind: "rural" },
  { code: "512", place: "Hólmavík", kind: "rural" },
  { code: "520", place: "Drangsnesi", kind: "town" },
  { code: "524", place: "Árneshreppi", kind: "rural" },
  { code: "530", place: "Hvammstanga", kind: "town" },
  { code: "531", place: "Hvammstanga", kind: "rural" },
  { code: "540", place: "Blönduósi", kind: "town" },
  { code: "541", place: "Blönduósi", kind: "rural" },
  { code: "545", place: "Skagaströnd", kind: "town" },
  { code: "546", place: "Skagaströnd", kind: "rural" },
  { code: "550", place: "Sauðárkróki", kind: "town" },
  { code: "551", place: "Sauðárkróki", kind: "rural" },
  { code: "560", place: "Varmahlíð", kind: "town" },
  { code: "561", place: "Varmahlíð", kind: "rural" },
  { code: "565", place: "Hofsósi", kind: "town" },
  { code: "566", place: "Hofsósi", kind: "rural" },
  { code: "570", place: "Fljótum", kind: "town" },
  { code: "580", place: "Siglufirði", kind: "town" },
  { code: "581", place: "Siglufirði", kind: "rural" },
  { code: "600", place: "Akureyri", kind: "town" },
  { code: "601", place: "Akureyri", kind: "rural" },
  { code: "602", place: "Akureyri", kind: "box" },
  { code: "603", place: "Akureyri", kind: "town" },
  { code: "604", place: "Akureyri", kind: "rural" },
  { code: "605", place: "Akureyri", kind: "rural" },
  { code: "606", place: "Akureyri", kind: "rural" },
  { code: "607", place: "Akureyri", kind: "rural" },
  { code: "610", place: "Grenivík", kind: "town" },
  { code: "611", place: "Grímsey", kind: "town" },
  { code: "616", place: "Grenivík", kind: "rural" },
  { code: "620", place: "Dalvík", kind: "town" },
  { code: "621", place: "Dalvík", kind: "rural" },
  { code: "625", place: "Ólafsfirði", kind: "town" },
  { code: "626", place: "Ólafsfirði", kind: "rural" },
  { code: "630", place: "Hrísey", kind: "town" },
  { code: "640", place: "Húsavík", kind: "town" },
  { code: "641", place: "Húsavík", kind: "rural" },
  { code: "645", place: "Fosshóli", kind: "town" },
  { code: "650", place: "Laugum", kind: "town" },
  { code: "660", place: "Mývatni", kind: "town" },
  { code: "670", place: "Kópaskeri", kind: "town" },
  { code: "671", place: "Kópaskeri", kind: "rural" },
  { code: "675", place: "Raufarhöfn", kind: "town" },
  { code: "676", place: "Raufarhöfn", kind: "rural" },
  { code: "680", place: "Þórshöfn", kind: "town" },
  { code: "681", place: "Þórshöfn", kind: "rural" },
  { code: "685", place: "Bakkafirði", kind: "town" },
  { code: "686", place: "Bakkafirði", kind: "rural" },
  { code: "690", place: "Vopnafirði", kind: "town" },
  { code: "691", place: "Vopnafirði", kind: "rural" },
  { code: "700", place: "Egilsstöðum", kind: "town" },
  { code: "701", place: "Egilsstöðum", kind: "rural" },
  { code: "710", place: "Seyðisfirði", kind: "town" },
  { code: "711", place: "Seyðisfirði", kind: "rural" },
  { code: "715", place: "Mjóafirði", kind: "town" },
  { code: "720", place: "Borgarfirði eystra", kind: "town" },
  { code: "721", place: "Borgarfirði eystra", kind: "rural" },
  { code: "730", place: "Reyðarfirði", kind: "town" },
  { code: "731", place: "Reyðarfirði", kind: "rural" },
  { code: "735", place: "Eskifirði", kind: "town" },
  { code: "736", place: "Eskifirði", kind: "rural" },
  { code: "740", place: "Neskaupstað", kind: "town" },
  { code: "741", place: "Neskaupstað", kind: "rural" },
  { code: "750", place: "Fáskrúðsfirði", kind: "town" },
  { code: "751", place: "Fáskrúðsfirði", kind: "rural" },
  { code: "755", place: "Stöðvarfirði", kind: "town" },
  { code: "756", place: "Stöðvarfirði", kind: "rural" },
  { code: "760", place: "Breiðdalsvík", kind: "town" },
  { code: "761", place: "Breiðdalsvík", kind: "rural" },
  { code: "765", place: "Djúpavogi", kind: "town" },
  { code: "766", place: "Djúpavogi", kind: "rural" },
  { code: "780", place: "Höfn í Hornafirði", kind: "town" },
  { code: "781", place: "Höfn í Hornafirði", kind: "rural" },
  { code: "785", place: "Öræfum", kind: "town" },
  { code: "800", place: "Selfossi", kind: "town" },
  { code: "801", place: "Selfossi", kind: "rural" },
  { code: "802", place: "Selfossi", kind: "box" },
  { code: "803", place: "Selfossi", kind: "rural" },
  { code: "804", place: "Selfossi", kind: "rural" },
  { code: "805", place: "Selfossi", kind: "rural" },
  { code: "806", place: "Selfossi", kind: "rural" },
  { code: "810", place: "Hveragerði", kind: "town" },
  { code: "815", place: "Þorlákshöfn", kind: "town" },
  { code: "816", place: "Ölfusi", kind: "rural" },
  { code: "820", place: "Eyrarbakka", kind: "town" },
  { code: "825", place: "Stokkseyri", kind: "town" },
  { code: "840", place: "Laugarvatni", kind: "town" },
  { code: "845", place: "Flúðum", kind: "town" },
  { code: "846", place: "Flúðum", kind: "rural" },
  { code: "850", place: "Hellu", kind: "town" },
  { code: "851", place: "Hellu", kind: "rural" },
  { code: "860", place: "Hvolsvelli", kind: "town" },
  { code: "861", place: "Hvolsvelli", kind: "rural" },
  { code: "870", place: "Vík", kind: "town" },
  { code: "871", place: "Vík", kind: "rural" },
  { code: "880", place: "Kirkjubæjarklaustri", kind: "town" },
  { code: "881", place: "Kirkjubæjarklaustri", kind: "rural" },
  { code: "900", place: "Vestmannaeyjum", kind: "town" },
  { code: "902", place: "Vestmannaeyjum", kind: "box" },
];

const BY_CODE: ReadonlyMap<string, IsPostcode> = new Map(IS_POSTCODES.map((p) => [p.code, p]));

/** Lowercase and strip diacritics (þ→th, ð→d, æ→ae, ö→o, accents removed). */
export function normalizeIsText(s: string): string {
  return s
    .toLowerCase()
    .replace(/þ/g, "th")
    .replace(/ð/g, "d")
    .replace(/æ/g, "ae")
    .replace(/ö/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function placeForPostcode(code: string): string | null {
  return BY_CODE.get(String(code ?? "").trim())?.place ?? null;
}

export function isValidPostcode(code: string): boolean {
  return BY_CODE.has(String(code ?? "").trim());
}

/** Prefix matches first, then substring matches; each group sorted by code. */
export function postcodesForPlace(query: string, limit = 20): IsPostcode[] {
  const q = normalizeIsText(query);
  if (!q) return [];
  const prefix: IsPostcode[] = [];
  const contains: IsPostcode[] = [];
  for (const p of IS_POSTCODES) {
    const n = normalizeIsText(p.place);
    if (n.startsWith(q)) prefix.push(p);
    else if (n.includes(q)) contains.push(p);
  }
  return [...prefix, ...contains].slice(0, limit);
}

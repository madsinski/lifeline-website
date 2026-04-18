export type SameindStation = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  /** Plain text hours line, e.g. "Mon–Fri 08:00–16:00" */
  hours: string;
  phone: string;
};

export const SAMEIND_PHONE = "+354 580 9500";
export const SAMEIND_EMAIL = "sameind@sameind.is";
export const SAMEIND_WEBSITE = "https://sameind.is";

export const SAMEIND_STATIONS: SameindStation[] = [
  {
    id: "armuli",
    name: "Ármúli",
    address: "Ármúla 32",
    postalCode: "108",
    city: "Reykjavík",
    hours: "Mon–Fri 08:00–16:00",
    phone: SAMEIND_PHONE,
  },
  {
    id: "kirkjusandur",
    name: "Heilsugæslan Kirkjusandi",
    address: "Hallgerðargötu 13",
    postalCode: "105",
    city: "Reykjavík",
    hours: "Mon–Fri 08:00–12:00",
    phone: SAMEIND_PHONE,
  },
  {
    id: "hofdi",
    name: "Heilsugæslan Höfða",
    address: "Bíldshöfða 9",
    postalCode: "110",
    city: "Reykjavík",
    hours: "Mon–Fri 08:00–16:00",
    phone: SAMEIND_PHONE,
  },
  {
    id: "domus",
    name: "Domus læknar",
    address: "Hlíðasmára 17, 2. hæð",
    postalCode: "201",
    city: "Kópavogur",
    hours: "Mon–Fri 08:15–15:30",
    phone: SAMEIND_PHONE,
  },
  {
    id: "urdarhvarf",
    name: "Heilsugæslan Urðarhvarfi",
    address: "Urðarhvarfi 14",
    postalCode: "203",
    city: "Kópavogur",
    hours: "Mon–Fri 08:00–12:00",
    phone: SAMEIND_PHONE,
  },
  {
    id: "salahverfi",
    name: "Heilsugæslan Salahverfi",
    address: "Salavegi 2",
    postalCode: "201",
    city: "Kópavogur",
    hours: "Mon–Fri 08:00–12:00",
    phone: SAMEIND_PHONE,
  },
  {
    id: "sudurnes",
    name: "Heilsugæslan Höfða Suðurnesjum",
    address: "Aðalgötu 50",
    postalCode: "230",
    city: "Reykjanesbær",
    hours: "Mon–Fri 08:00–12:00",
    phone: SAMEIND_PHONE,
  },
];

export function fullAddress(s: SameindStation): string {
  return `${s.address}, ${s.postalCode} ${s.city}`;
}

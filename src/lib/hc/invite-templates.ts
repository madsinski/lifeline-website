// The messages a coach can send to somebody who is not yet in the system.
//
// Fixed text, picked from a list, rather than a box to write in. Two
// reasons, and the second is the one that bites:
//
//  - the same first contact should read the same way every time, and a
//    coach writing an introduction from scratch at 16:40 writes a worse one
//  - SMS to Icelandic numbers goes out under a sender ID that the carriers
//    whitelist by CONTENT as well as by sender. Free text is what gets
//    filtered, and a filtered message looks exactly like a delivered one
//    until the carrier says otherwise. Fjarlækningar hit this and settled
//    on fixed templates for the same reason.
//
// {name} is replaced with the person's first name when there is one, and
// the sentence is written so it still reads without it.

export interface InviteTemplate {
  key: string;
  label: string;
  /** What the coach is told it is for. */
  hint: string;
  subject: string;
  /** Email body. Plain sentences; the branded wrapper adds the rest. */
  email: string;
  /**
   * SMS body. ASCII-safe Icelandic on purpose: á ð þ í ó ú ý æ ö fall
   * outside GSM-7 and force UCS-2, which halves a segment to 70 characters
   * — so an accented message of this length costs three segments instead
   * of one, and three times the chance of being cut.
   */
  sms: string;
}

export const INVITE_TEMPLATES: InviteTemplate[] = [
  {
    key: "health_check",
    label: "Heilsufarsskoðun",
    hint: "Fyrir þann sem er að byrja í heilsufarsskoðun.",
    subject: "Heilsufarsskoðunin þín hjá Lifeline",
    email: "Við höfum sett upp aðgang fyrir þig hjá Lifeline. Þar bókar þú mælingar og blóðprufu, sérð niðurstöðurnar þegar þær koma og nærð í okkur.",
    sms: "Halló{name}. Vid hofum sett upp adgang fyrir thig hja Lifeline. Thar bokar thu maelingar og serd nidurstodurnar:",
  },
  {
    key: "coaching",
    label: "Þjálfun",
    hint: "Fyrir þann sem ætlar í þjálfun án skoðunar fyrst.",
    subject: "Aðgangurinn þinn að þjálfun hjá Lifeline",
    email: "Við höfum sett upp aðgang fyrir þig hjá Lifeline. Þar færðu áætlunina þína — æfingar, næringu og daglegar venjur — og getur sent okkur skilaboð hvenær sem er.",
    sms: "Hallo{name}. Adgangurinn thinn ad thjalfun hja Lifeline er tilbuinn. Thar faerdu aaetlunina thina:",
  },
  {
    key: "followup",
    label: "Eftirfylgd",
    hint: "Fyrir þann sem hefur verið hjá okkur áður.",
    subject: "Við tökum upp þráðinn — Lifeline",
    email: "Við höfum opnað aðganginn þinn aftur hjá Lifeline svo við getum tekið upp þráðinn. Þar sérðu fyrri niðurstöður og bókar næsta skref.",
    sms: "Hallo{name}. Vid hofum opnad adganginn thinn aftur hja Lifeline svo vid getum tekid upp thradinn:",
  },
];

export const inviteTemplate = (key: string) =>
  INVITE_TEMPLATES.find((t) => t.key === key) ?? INVITE_TEMPLATES[0];

/** First name only, and nothing at all when there is none. */
export function fillName(body: string, name?: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return body.replace("{name}", first ? ` ${first}` : "");
}

// Content model for a measurement-station instruction document. Rendered on the
// admin editor (/admin/station-instructions), and on the public, printable link
// (/leidbeiningar/[slug]). The DEFAULT_DOC below is the seed content — it renders
// immediately even before anything is saved, and admin edits persist over it.

export type Block =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "text"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "note"; text: string }
  | { type: "image"; src: string; caption?: string };

export interface StationDoc {
  title: string;
  intro?: string;
  blocks: Block[];
}

const IMG = (n: string) => `/station-instructions/${n}.jpg`;

export const DEFAULT_SLUG = "lyfja-smaratorg";

export const DEFAULT_DOC: StationDoc = {
  title: "Leiðbeiningar fyrir heilsufarsskoðun Lifeline Health hjá Lyfju",
  intro: "Þessi handbók lýsir öllu ferlinu á mælingastöðinni: skráningu skjólstæðings, líkamssamsetningarmælingu með Biody-tækinu og blóðþrýstingsmælingu í Medalia.",
  blocks: [
    { type: "heading", text: "Skref 1 — Skráning skjólstæðings" },
    { type: "text", text: "Skjólstæðingur getur skráð sig með eftirfarandi hætti:" },
    { type: "steps", items: [
      "Fara á lifelinehealth.is",
      "Skanna QR kóða",
      "Smella á „opna sjúklingagátt“",
      "Skanna QR kóða annars staðar",
    ] },
    { type: "image", src: IMG("l1"), caption: "Skráningarkortið á lifelinehealth.is" },

    { type: "heading", text: "Skref 2 — Líkamssamsetning" },
    { type: "text", text: "Opnaðu biodymanager.com og skráðu þig inn." },
    { type: "note", text: "Notandanafn: smarathjukrun@lyfja.is · Lykilorð: sent í tölvupósti á smarathjukrun@lyfja.is" },
    { type: "subheading", text: "Finna skjólstæðing" },
    { type: "text", text: "Smelltu á „Active patients“." },
    { type: "image", src: IMG("1"), caption: "Active patients" },
    { type: "text", text: "Leitaðu að skjólstæðingi — annaðhvort:" },
    { type: "steps", items: [
      "Smelltu á „show filter row“ og skrifaðu fornafn eða eftirnafn. Athugið: nöfn með séríslenskum stöfum virka oft ekki — þá er betra að raða listanum í stafrófsröð.",
      "Raðaðu listanum í stafrófsröð og leitaðu að skjólstæðingnum.",
    ] },
    { type: "image", src: IMG("2"), caption: "Show filter row / stafrófsröð" },
    { type: "text", text: "Finndu skjólstæðinginn í listanum og smelltu á „dashboard“." },
    { type: "image", src: IMG("3"), caption: "Veldu „dashboard“ við skjólstæðinginn" },
    { type: "text", text: "Nú kemurðu inn á síðu skjólstæðings. Ef engin mæling er til í kerfinu koma upp skilaboð um það — smelltu á „cancel“. Smelltu svo á „new measurement“." },
    { type: "image", src: IMG("4"), caption: "New measurement" },
    { type: "text", text: "Nú kemurðu inn á mælingasíðu skjólstæðings. Fylltu í tvo reiti: „Weight“ og „Height“ (170 cm fyllist sjálfkrafa hjá öllum — því þarf að breyta)." },
    { type: "image", src: IMG("5"), caption: "Weight og Height — og „Synchronise the measurement“" },

    { type: "subheading", text: "Mæling með Biody tækinu" },
    { type: "steps", items: [
      "Biddu skjólstæðing að fara úr öðrum skónum og sokknum og sitja á stól með hælinn upp á hlið.",
      "Kveiktu á tækinu með því að ýta einu sinni á ON.",
      "Bleyttu snertifletina fjóra.",
      "Skjólstæðingur grípur um tækið með þumli og tveimur fingrum — mikilvægt er að snerta snertifletina.",
      "Settu tækið niður á hælinn og haltu því þar til tækið segir að mælingin sé búin (eða þegar blátt ljós kviknar).",
    ] },
    { type: "note", text: "Þegar bláa ljósið kviknar hefurðu 2 mínútur til að yfirfæra mælinguna í tölvuna." },
    { type: "text", text: "Smelltu á „Synchronise the measurement“ (sjá mynd að ofan). Smelltu svo á nafn tækisins og á „pair“." },
    { type: "image", src: IMG("6"), caption: "Veldu tækið og smelltu á „pair“" },
    { type: "text", text: "Þegar mælingin er komin inn í kerfið kemur upp gluggi — smelltu á „view the results“. Ekki þarf að gera meira; hægt er að smella á heim-takkann." },
    { type: "image", src: IMG("7"), caption: "View the results" },

    { type: "heading", text: "Skref 3 — Blóðþrýstingsmæling" },
    { type: "text", text: "Opnaðu provider.medalia.is og skráðu þig inn með rafrænum skilríkjum. Þú kemur inn í sjúkraskrá Lifeline. Á heimasíðunni sérðu dagatal með yfirliti yfir verkefni teymisins. Ef skjólstæðingur er búinn að skrá sig í heilsufarsskoðun kemur upp verkefnið „svara spurningalista — mælingar hjúkrunarfræðings“. Smelltu á það." },
    { type: "image", src: IMG("m1"), caption: "Dagatal með verkefni skjólstæðings" },
    { type: "text", text: "Smelltu á „svara spurningalista“." },
    { type: "image", src: IMG("m2"), caption: "Svara spurningalista" },
    { type: "text", text: "Mældu blóðþrýsting hjá skjólstæðingnum tvisvar og fylltu í viðeigandi reiti." },
    { type: "image", src: IMG("m3"), caption: "Blóðþrýstingsreitir 1 og 2" },
    { type: "text", text: "Skrunaðu neðar og gakktu úr skugga um að allar tölur úr Biody-kerfinu séu komnar inn. Smelltu svo á „senda inn svör“. Þá er mælingunni lokið." },
    { type: "image", src: IMG("m4"), caption: "Líkamssamsetning úr Biody og „senda inn svör“" },
  ],
};

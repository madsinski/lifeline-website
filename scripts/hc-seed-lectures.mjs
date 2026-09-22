// Draft lecture series for the heilsuferð (Fræðsla). Upserts by slug.
globalThis.WebSocket ??= class {};
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const L = [
  {
    slug: "velkomin", title: "Velkomin í heilsuferðina", subtitle: "Hvað gerist næst og hvers vegna", kind: "slides",
    duration_min: 4, pillar: "general", is_welcome: true, sort: 0,
    slides: [
      { title: "Velkomin", body: "Þú hefur tekið fyrsta skrefið. Á næstu vikum förum við saman yfir svefn, hreyfingu, næringu og andlega líðan, og endum á áætlun sem hentar þér.", image_url: "/hc-fraedsla/fjorar-stodir.svg" },
      { title: "Átta skref", body: "Aðgangurinn sýnir alltaf næsta skref. Þú getur farið á þínum hraða og séð hvað er búið.", image_url: "/hc-fraedsla/ferlid.svg" },
      { title: "Blóðprufa og mælingar", body: "Blóðprufa á Heilsugæslunni og mælingar hjá samstarfsaðila okkar gefa mynd af stöðunni í dag. Þú bókar hvort tveggja í sjúklingagáttinni." },
      { title: "Skýrsla og viðtal", body: "Læknir Lifeline staðfestir skýrsluna. Síðan farið þú og hjúkrunarfræðingur yfir niðurstöðurnar og veljið það sem skiptir þig mestu máli." },
      { title: "Litlar breytingar sem endast", body: "Áætlunin er stutt og raunhæf. Fáar aðgerðir sem þú getur haldið út í þrjá mánuði gera meira gagn en margar sem þú gefst upp á.", image_url: "/hc-fraedsla/vana-lykkja.svg" },
      { title: "Fræðslan", body: "Hér á aðganginum eru stuttir fyrirlestrar um hverja stoð. Horfðu á þá þegar þér hentar, til dæmis á meðan þú bíður eftir niðurstöðum." },
    ],
  },
  {
    slug: "svefn-grunnur", title: "Svefn: undirstaðan", subtitle: "Sex einföld ráð og hvað gerist á nóttunni", kind: "video",
    video_url: "https://www.youtube.com/watch?v=t0kACis_dJE", duration_min: 8, pillar: "sleep", sort: 10,
    article_md: `## Hvað gerist á nóttunni?

Svefninn skiptist í lotur sem eru um 90 mínútur hver. Djúpsvefninn er mestur fyrri hluta nætur og draumsvefninn undir morgun.

![Svefnlotur yfir eina nótt](/hc-fraedsla/svefnhringur.svg)

> **Fastur fótaferðartími** er líklega einfaldasta breytingin sem þú getur gert. Líkamsklukkan stillist af reglu, líka um helgar.

## Þrjú atriði til að byrja á

- Farðu á fætur á sama tíma alla daga.
- Dragðu úr skjánotkun síðustu klukkustundina fyrir svefn.
- Hafðu svefnherbergið svalt, dimmt og hljóðlátt.

## Viltu vita meira?

@[video](https://www.youtube.com/watch?v=5MuIMqhT8DM) | Matt Walker, svefnrannsakandi: Sleep is your superpower (TED, á ensku)`,
  },
  {
    slug: "hreyfing-grunnur", title: "Hreyfing: byrjaðu þar sem þú ert", subtitle: "Hálftími á dag, í smáum skömmtum", kind: "video",
    video_url: "https://www.youtube.com/watch?v=aUaInS6HIGo", duration_min: 10, pillar: "exercise", sort: 20,
    article_md: `## Öll hreyfing telur

Ráðlagt er að hreyfa sig í um 150 mínútur á viku af miðlungsákefð og gera styrktaræfingar tvisvar í viku. Það má byrja mun minna.

![Dæmi um viku með 150 mínútum og tveimur styrktaræfingum](/hc-fraedsla/hreyfing-vika.svg)

> Rösk ganga þar sem þú getur talað en ekki sungið er **miðlungsákefð**. Tíu mínútur þrisvar á dag telja jafn mikið og hálftími í einu.

## Góð byrjun

- Rösk ganga í 10 mínútur eftir máltíð.
- Stigar í stað lyftu.
- Tvær stuttar styrktaræfingar í viku heima.

## Hreyfing og heilinn

@[video](https://www.youtube.com/watch?v=BHY0FxzoKZE) | Wendy Suzuki, taugavísindakona: The brain-changing benefits of exercise (TED, á ensku)`,
  },
  {
    slug: "naering-grunnur", title: "Næring: einfaldar breytingar", subtitle: "Diskurinn sem leiðarvísir", kind: "video",
    video_url: "https://www.youtube.com/watch?v=xyQY8a-ng6g", duration_min: 7, pillar: "nutrition", sort: 30,
    article_md: `## Diskaaðferðin

Í stað þess að vigta og telja er hægt að skipta disknum: hálfur diskur grænmeti, fjórðungur prótein og fjórðungur trefjaríkt kolvetni.

![Diskaaðferðin](/hc-fraedsla/diskurinn.svg)

> Þetta er ekki megrunarkúr. Markmiðið er **jafnvægi** sem þú getur haldið út, ekki fullkomnun.

## Byrjaðu hér

- Prótein í hverri máltíð, til dæmis skyr, egg, fiskur eða baunir.
- Vatn í stað sykraðra drykkja.
- Skipuleggðu máltíðir vikunnar fyrir fram og gerðu innkaupalista.
- Fiskur tvisvar í viku.`,
  },
  {
    slug: "andleg-lidan-grunnur", title: "Andleg líðan: streita og hvíld", subtitle: "Að vinna með streitunni, ekki á móti henni", kind: "video",
    video_url: "https://www.youtube.com/watch?v=RcGyVTAoXEU", duration_min: 15, pillar: "mental", sort: 40,
    article_md: `## Streita er eðlileg

Streita verður vandamál þegar hún er stöðug og hvíldin nær ekki að vega á móti. Það hjálpar að eiga einföld verkfæri sem þú getur gripið til hvenær sem er.

## Kassaöndun

![Kassaöndun: anda inn, halda, anda út, halda](/hc-fraedsla/ondun.svg)

@[video](https://www.youtube.com/watch?v=tEmt1Znux58) | Leiðbeiningar um kassaöndun frá Sunnybrook-sjúkrahúsinu (á ensku)

## Fleiri einföld verkfæri

- Útivera og dagsbirta á hverjum degi.
- Tími með fólki sem skiptir þig máli.
- Skrifaðu niður þrennt sem gekk vel í dag.

> Ef vanlíðan er langvarandi eða mikil skaltu ræða það í viðtalinu eða hafa samband við heilsugæsluna þína.`,
  },
  {
    slug: "venjur-sem-endast", title: "Venjur sem endast", subtitle: "Hvernig lítil skref verða að vana", kind: "slides",
    duration_min: 5, pillar: "general", sort: 50,
    slides: [
      { title: "Af hverju gefumst við upp?", body: "Flestir byrja of stórt. Stór markmið krefjast mikils viljastyrks, og viljastyrkur klárast." },
      { title: "Svona myndast venja", body: "Vísbending, venja og umbun. Tengdu nýju venjuna við eitthvað sem þú gerir nú þegar, til dæmis „eftir morgunkaffið fer ég í tíu mínútna göngu“.", image_url: "/hc-fraedsla/vana-lykkja.svg" },
      { title: "Gerðu það auðvelt", body: "Hafðu gönguskóna við dyrnar og vatnsflöskuna á borðinu. Því minni fyrirhöfn, því líklegra að þú gerir það." },
      { title: "Ekki brjóta keðjuna tvisvar", body: "Það er í lagi að missa úr einn dag. Reglan er að missa ekki úr tvo daga í röð." },
      { title: "Fylgstu með", body: "Merktu við í dagatali eða appi. Að sjá röð af dögum er umbun í sjálfu sér." },
    ],
  },
  {
    slug: "hvad-segja-maelingarnar", title: "Hvað segja mælingarnar?", subtitle: "Að lesa skýrsluna þína", kind: "article",
    duration_min: 6, pillar: "general", sort: 60,
    article_md: `## Til hvers eru mælingarnar?

Mælingar og blóðprufur gefa mynd af stöðunni í dag og viðmið til að bera saman við síðar. Þær eru eitt af mörgu sem hjúkrunarfræðingurinn fer yfir með þér í viðtalinu.

## Blóðþrýstingur

Skráður sem tvær tölur, til dæmis 125/80. Efri talan er þrýstingurinn þegar hjartað dregst saman, neðri talan þegar það slakar á. Ein mæling segir lítið ein og sér; þróunin skiptir meira máli.

## Líkamssamsetning

Sýnir hlutfall fitu og vöðva, ekki bara þyngd. Tveir einstaklingar sem vega það sama geta haft mjög ólíka samsetningu.

## Blóðprufur

- **HbA1c** endurspeglar meðalblóðsykur síðustu tveggja til þriggja mánaða.
- **Blóðfitur** (kólesteról, LDL, HDL og þríglýseríð) gefa mynd af fitu í blóði.
- Aðrar mælingar eru valdar út frá heilsufarsskoðuninni.

> Læknir Lifeline fer yfir allar niðurstöður. Ef eitthvað kallar á frekari skoðun er þér vísað á heilsugæsluna til eftirfylgdar.`,
  },
];

for (const l of L) {
  const row = {
    slug: l.slug, title: l.title, subtitle: l.subtitle ?? null, kind: l.kind, video_url: l.video_url ?? null,
    slides: l.slides ?? [], article_md: l.article_md ?? null, duration_min: l.duration_min, pillar: l.pillar,
    is_welcome: !!l.is_welcome, sort: l.sort, published: true, updated_by: "drög (Claude)", updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("hc_lectures").upsert(row, { onConflict: "slug" });
  console.log(error ? `FAIL ${l.slug}: ${error.message}` : `ok ${l.slug}`);
}

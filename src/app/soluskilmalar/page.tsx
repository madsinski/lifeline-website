import Link from "next/link";
import LifelineLogo from "@/app/components/LifelineLogo";
import BackButton from "@/app/components/BackButton";

export const metadata = {
  title: "Söluskilmálar — Lifeline Health",
  description:
    "Söluskilmálar Lifeline Health ehf. fyrir kaup á heilsumati og áskrift að Lifeline appinu. Greiðslur, áskrift, endurgreiðslur og afturköllunarréttur.",
};

const VERSION = "1.0";
const LAST_UPDATED = "20. maí 2026";

export default function SoluskilmalarPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LifelineLogo className="w-8 h-8" />
          <span className="font-semibold">Lifeline Health</span>
        </Link>
        <BackButton />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-sm prose-slate">
        <p className="text-sm text-gray-500">
          Útgáfa {VERSION} — Uppfært {LAST_UPDATED} ·{" "}
          <Link href="/sales-terms" className="underline">English version</Link>
        </p>
        <h1>Söluskilmálar</h1>

        <p>
          Söluskilmálar þessir gilda um kaup einstaklinga (hér eftir „neytandi" eða „þú") á
          þjónustum Lifeline Health ehf. í gegnum lifelinehealth.is og Lifeline snjallforritið.
          Skilmálarnir bætast við og takmarka ekki almenna{" "}
          <Link href="/terms">notkunarskilmála og persónuverndaryfirlýsingu</Link> Lifeline.
          Komi til ósamræmis gilda söluskilmálar þessir um öll atriði er varða greiðslur,
          áskrift og endurgreiðslur.
        </p>

        <h2>1. Seljandi og rekstrarfyrirkomulag</h2>
        <p>
          <strong>1.1</strong> Seljandi þjónustanna, eins og rekstrinum er háttað í dag, er:
        </p>
        <ul>
          <li>Lifeline Health ehf.</li>
          <li>Kennitala: 590925-1440</li>
          <li>Lögheimili: Langholtsvegi 111, 104 Reykjavík</li>
          <li>Netfang: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
          <li>Vefsíða: <a href="https://lifelinehealth.is">lifelinehealth.is</a></li>
        </ul>
        <p>
          Lifeline Health ehf. starfar sem heilbrigðisstofnun samkvæmt lögum nr. 40/2007
          um heilbrigðisþjónustu og er skráð sem slík hjá Embætti landlæknis.
        </p>
        <p>
          <strong>1.2</strong> Lifeline Health ehf. vinnur að stofnun sérstaks dótturfélags
          sem mun reka heilsuþjálfun og lífsstílsráðgjöf (áskriftarþjónustuna sem lýst er
          í gr. 3.2) sem sjálfstæða einingu. Tilgangurinn er að halda heilbrigðisstarfsleyfi
          Lifeline Health skýrt aðgreindu frá þeirri starfsemi sem ekki fellur undir
          heilbrigðisþjónustu samkvæmt lögum nr. 40/2007. Þar til dótturfélagið hefur
          starfsemi er Lifeline Health ehf. seljandi beggja þjónusta sem taldar eru í
          gr. 3. Skilmálum þessum verður breytt með að lágmarki 30 daga fyrirvara þegar
          dótturfélagið tekur við sölu áskriftarþjónustunnar.
        </p>

        <h2>2. Gildissvið og samþykki</h2>
        <p>
          Með því að ljúka greiðslu á vefsíðu Lifeline eða innan Lifeline snjallforritsins
          staðfestir neytandi að hann hafi lesið, skilji og samþykki skilmála þessa. Þjónustan
          er einungis seld einstaklingum 18 ára og eldri sem hafa lögheimili á Íslandi eða
          innan EES.
        </p>

        <h2>3. Þjónustur sem í boði eru</h2>

        <h3>3.1 Heilsumat (stök kaup) — heilbrigðisþjónusta</h3>
        <p>
          Heildstætt klínískt heilsumat sem felur í sér spurningalista, lífsstílsmat,
          líkamssamsetningarmælingu á samstarfsstöð, rannsóknarniðurstöður þar sem við á,
          og túlkun læknis á vegum Lifeline Health ehf. Heilsumat er{" "}
          <strong>heilbrigðisþjónusta</strong> í skilningi laga nr. 40/2007 og er veitt af
          Lifeline Health ehf. samkvæmt starfsleyfi þess félags. Verðlagt sem stök kaup og
          afhent stafrænt í aðgangi neytanda í snjallforritinu og á vef.
        </p>

        <h3>3.2 Áskrift að Lifeline appinu — heilsuþjálfun og lífsstílsráðgjöf</h3>
        <p>
          Áframhaldandi aðgangur að persónulegri heilsuþjálfun, daglegri leiðsögn,
          næringaráætlunum, eftirfylgni og samskiptum við heilsuráðgjafa Lifeline.
          Áskriftarþjónustan er <strong>heilsu- og lífsstílsráðgjöf</strong> og er ekki
          heilbrigðisþjónusta í skilningi laga nr. 40/2007 — hún kemur ekki í stað
          læknisþjónustu, klínískrar greiningar eða meðferðar. Áskrift er seld í
          mánaðarlegum eða árlegum tímabilum eins og fram kemur á söluskjá. Eins og fram
          kemur í gr. 1.2 mun rekstur þessarar þjónustu færast yfir til dótturfélags
          Lifeline Health þegar það félag tekur til starfa.
        </p>
        <p>
          Nákvæmt verð, innifaldir eiginleikar og tímabil eru ávallt birt á söluskjá áður en
          greiðsla er staðfest.
        </p>

        <h2>4. Verð, mynt og virðisaukaskattur</h2>
        <p>
          Öll verð eru birt í íslenskum krónum (ISK). Heilbrigðisþjónusta Lifeline Health er
          undanþegin virðisaukaskatti samkvæmt 2. mgr. 2. gr. laga nr. 50/1988 um
          virðisaukaskatt, og því er <strong>enginn VSK</strong> lagður á verð heilsumats eða
          áskriftar að heilsuþjálfun.
        </p>
        <p>
          Lifeline áskilur sér rétt til að breyta verðlagi. Verðbreytingar gilda ekki um
          þegar greiddar þjónustur eða yfirstandandi áskriftartímabil. Breytingar á verði
          áskriftar eru tilkynntar með að lágmarki 30 daga fyrirvara í tölvupósti eða í
          forritinu áður en næsta endurnýjun á sér stað.
        </p>

        <h2>5. Greiðslur og greiðslumiðlun</h2>
        <p>
          Greiðslur með greiðslukortum (Visa, Mastercard) eru meðhöndlaðar af samstarfsaðila
          okkar í greiðslumiðlun, Straumur greiðslumiðlun ehf. Lifeline geymir aldrei númer
          greiðslukorts á eigin þjónum. Aðeins eru geymdar dulkóðaðar tilvísanir
          („token") sem nauðsynlegar eru fyrir áskriftarendurnýjun.
        </p>
        <p>
          Greiðsla er heimiluð á greiðslustundu og bókuð þegar þjónustan er afhent eða
          áskriftartímabilið hefst. Reikningur er sendur í tölvupósti eftir hverja heppnaða
          greiðslu og er einnig aðgengilegur í aðgangi neytanda.
        </p>

        <h2>6. Áskrift, sjálfvirk endurnýjun og uppsögn</h2>
        <p>
          Áskrift endurnýjast sjálfkrafa við lok hvers tímabils á þágildandi verði þar til
          neytandi segir henni upp. Áminning um komandi endurnýjun árlegrar áskriftar er
          send í tölvupósti með að lágmarki 7 daga fyrirvara.
        </p>
        <p>
          Neytandi getur sagt áskrift upp hvenær sem er án skýringa í gegnum stillingar í
          forritinu, á <Link href="/account">lifelinehealth.is/account</Link> eða með
          tölvupósti á <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
          Uppsögn tekur gildi við lok yfirstandandi greidds tímabils — aðgangur helst
          óbreyttur til þess tíma. Hlutfallsleg endurgreiðsla á ónotuðum hluta tímabils er
          ekki veitt nema lög kveði á um annað.
        </p>

        <h2>7. Afhending þjónustu</h2>
        <p>
          Stafræn þjónusta hefst um leið og greiðsla er staðfest:
        </p>
        <ul>
          <li>
            <strong>Heilsumat (stök kaup):</strong> aðgangur að bókunarflæði og spurningalista
            opnast strax. Líkamssamsetningarmæling fer fram á samstarfsstöð á þeim tíma sem
            neytandi bókar.
          </li>
          <li>
            <strong>Áskrift:</strong> fullur aðgangur að áskriftareiginleikum opnast strax
            og áskriftartímabilið hefst á greiðsludegi.
          </li>
        </ul>

        <h2>8. Réttur til að falla frá samningi (14 daga afturköllunarréttur)</h2>
        <p>
          Samkvæmt lögum nr. 16/2016 um neytendasamninga hefur neytandi að jafnaði 14 daga
          frest til að falla frá samningi sem gerður er með fjarsölu, án skýringa, frá og
          með þeim degi sem samningur var gerður.
        </p>
        <p>
          <strong>Mikilvæg undantekning fyrir stafræna heilbrigðisþjónustu:</strong> Þar sem
          þjónustur Lifeline eru afhentar stafrænt strax eftir greiðslu og að beiðni
          neytanda, þá samþykkir neytandi á söluskjá:
        </p>
        <ul>
          <li>
            að óska eftir því að afhending þjónustunnar hefjist <em>innan</em> 14 daga
            afturköllunarfrestsins; og
          </li>
          <li>
            að hann staðfesti að rétturinn til að falla frá samningi <em>falli niður</em> um
            leið og þjónustan hefur að fullu verið innt af hendi (sbr. d-lið 1. mgr. 18. gr.
            laga nr. 16/2016).
          </li>
        </ul>
        <p>
          Í reynd þýðir þetta:
        </p>
        <ul>
          <li>
            <strong>Heilsumat (stök kaup):</strong> neytandi getur fallið frá samningi án
            skýringa þar til mat hefur farið fram. Eftir að mat hefur að fullu verið innt af
            hendi fellur afturköllunarrétturinn niður. Hafi neytandi þegar nýtt sér hluta
            þjónustunnar áður en hann fellur frá samningi, þá ber honum að greiða
            hlutfallslega fyrir þann hluta sem þegar hefur verið afhentur.
          </li>
          <li>
            <strong>Áskrift:</strong> neytandi getur fallið frá samningi innan 14 daga frá
            stofnun áskriftar. Hafi áskriftin þegar veitt aðgang að efni er heimilt að
            draga hlutfallslegan kostnað af endurgreiðslunni samkvæmt 2. mgr. 21. gr. laga
            nr. 16/2016. Sjálfvirk endurnýjun stofnar ekki nýjan afturköllunarrétt — uppsögn
            áskriftar fer fram skv. gr. 6.
          </li>
        </ul>
        <p>
          Til að nýta sér afturköllunarréttinn skal neytandi senda skýra yfirlýsingu þar að
          lútandi á <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>{" "}
          fyrir lok frestsins. Eyðublað fyrir afturköllun má finna í viðauka I við lög
          nr. 16/2016.
        </p>

        <h2>9. Endurgreiðslur</h2>
        <p>
          Endurgreiðslur sem heimilar eru samkvæmt skilmálum þessum eða ófrávíkjanlegum lögum
          eru lagðar inn á sama greiðslumáta og notaður var við upphaflega greiðslu, eigi
          síðar en innan <strong>14 daga</strong> frá því að beiðni telst gild. Engin
          umsýslugjöld eru lögð á endurgreiðslur.
        </p>

        <h2>10. Mistekist greiðsla og endurnýjun</h2>
        <p>
          Mistakist sjálfvirk endurnýjun (t.d. vegna útrunnins korts eða ófullnægjandi
          innstæðu) reynir Lifeline aftur að innheimta í allt að 7 daga og lætur neytanda
          vita í tölvupósti. Hafi greiðsla ekki borist innan þess tíma stöðvast aðgangur að
          áskriftareiginleikum sjálfkrafa. Aðgangur er endurvirkjaður um leið og greiðsla
          berst.
        </p>

        <h2>11. Endurgreiðslukröfur (chargeback) og umdeildar greiðslur</h2>
        <p>
          Telji neytandi sig hafa verið ranglega rukkaðan er hann beðinn um að hafa samband
          beint við Lifeline á{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a> áður en
          endurgreiðslukrafa er lögð fram hjá útgáfubanka. Þetta auðveldar skjóta og
          rétta úrlausn. Lifeline svarar slíkum erindum innan 5 virkra daga.
        </p>

        <h2>12. Læknisfræðilegur fyrirvari</h2>
        <p>
          <strong>Heilsumat (gr. 3.1)</strong> er heilbrigðisþjónusta og kemur ekki í stað
          sambands þíns við heimilislækni eða sérfræðing.
        </p>
        <p>
          <strong>Áskriftarþjónustan (gr. 3.2)</strong> er heilsuþjálfun og lífsstílsráðgjöf —
          ekki heilbrigðisþjónusta. Hún er viðbót við, en ekki staðganga, læknisfræðilega
          greiningu og meðferð. Innihald áskriftarinnar skal ekki nýtt til að taka klínískar
          ákvarðanir.
        </p>
        <p>
          Í neyðartilfellum skal alltaf hringja í 112. Hætta skal eða breyta lyfjameðferð
          eingöngu í samráði við lækni. Nánari ákvæði um ábyrgðartakmarkanir er að finna í
          almennum <Link href="/terms">notkunarskilmálum</Link>.
        </p>

        <h2>13. Persónuvernd</h2>
        <p>
          Vinnsla persónuupplýsinga við greiðslu og veitingu þjónustu er framkvæmd í
          samræmi við{" "}
          <Link href="/privacy">persónuverndaryfirlýsingu Lifeline</Link> og lög nr. 90/2018
          um persónuvernd og vinnslu persónuupplýsinga, ásamt reglugerð (ESB) 2016/679
          (GDPR). Straumur greiðslumiðlun ehf. starfar sem sjálfstæður ábyrgðaraðili um
          vinnslu greiðsluupplýsinga.
        </p>

        <h2>14. Kvartanir</h2>
        <p>
          Kvartanir varðandi greiðslur, þjónustu eða framkvæmd skilmálanna skal senda á{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>. Lifeline
          svarar formlega innan 14 daga frá móttöku. Náist ekki samkomulag getur neytandi
          vísað málinu til:
        </p>
        <ul>
          <li>
            <strong>Neytendastofu</strong> —{" "}
            <a href="https://www.neytendastofa.is" target="_blank" rel="noopener noreferrer">
              neytendastofa.is
            </a>
          </li>
          <li>
            <strong>Kærunefndar vöru- og þjónustukaupa</strong> —{" "}
            <a href="https://www.neytendastofa.is/kaerunefnd-voru-og-thjonustukaupa/" target="_blank" rel="noopener noreferrer">
              neytendastofa.is/kaerunefnd
            </a>
          </li>
          <li>
            <strong>Persónuverndar</strong> ef kvörtun varðar meðferð persónuupplýsinga —{" "}
            <a href="https://www.personuvernd.is" target="_blank" rel="noopener noreferrer">
              personuvernd.is
            </a>
          </li>
        </ul>

        <h2>15. Breytingar á skilmálum</h2>
        <p>
          Lifeline áskilur sér rétt til að uppfæra skilmálana. Verulegar breytingar verða
          tilkynntar í tölvupósti eða innan forritsins með að lágmarki 30 daga fyrirvara áður
          en þær taka gildi. Ávallt gildir nýjasta útgáfa sem birt er á{" "}
          <Link href="/soluskilmalar">lifelinehealth.is/soluskilmalar</Link>.
        </p>

        <h2>16. Lögsaga og varnarþing</h2>
        <p>
          Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir
          Héraðsdómi Reykjavíkur, með fyrirvara um ófrávíkjanleg ákvæði laga til verndar
          neytendum, þar með talin réttur neytanda til að höfða mál fyrir dómstóli í eigin
          lögsögu.
        </p>

        <h2>17. Tengiliður</h2>
        <ul>
          <li>Almennar fyrirspurnir og kvartanir: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
          <li>Persónuvernd: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
        </ul>

        <p className="text-xs text-gray-400 mt-12">
          Lifeline Health ehf. · kt. 590925-1440 · Langholtsvegi 111, 104 Reykjavík
        </p>
      </main>
    </div>
  );
}

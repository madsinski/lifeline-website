// Platform-level legal documents accepted by every contact person at signup.
// The EXACT string returned by the render functions is hashed and stored in
// platform_agreement_acceptances.text_hash. Any change — even whitespace —
// MUST bump the version so existing users get re-prompted to accept.

export const TOS_VERSION = "v1.1";
export const DPA_VERSION = "v1.0";
export const EMPLOYEE_TOS_VERSION = "v1.1";
export const HEALTH_CONSENT_VERSION = "v1.0";

export const TOS_KEY = "terms-of-service";
export const DPA_KEY = "data-processing-agreement";
export const EMPLOYEE_TOS_KEY = "employee-terms-of-service";
export const HEALTH_CONSENT_KEY = "health-assessment-consent";

// ─── Terms of Service (platform use) ────────────────────────
export function renderTermsOfService(): string {
  return `NOTKUNARSKILMÁLAR
Lifeline Health ehf. – Þjónustusíða fyrir vinnuveitendur
Útgáfa ${TOS_VERSION}

1. Aðilar og gildissvið
1.1 Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline Health") rekur þjónustusíðu (heilsumat.lifelinehealth.is og tengdar slóðir) sem gerir vinnuveitendum kleift að skrá starfsmenn í heilsumatsþjónustu og hafa umsjón með þátttöku þeirra.
1.2 Skilmálar þessir gilda um alla notkun þjónustusíðunnar af hálfu vinnuveitenda, tengiliða þeirra og annarra notenda sem aðgang hafa.
1.3 Með því að stofna aðgang og merkja við samþykki staðfestir notandi að hann hafi lesið og samþykki skilmála þessa fyrir hönd vinnuveitandans.

2. Aðgangur og heimild
2.1 Tengiliður vinnuveitanda ábyrgist að hann hafi heimild til að koma fram fyrir hönd fyrirtækisins og binda það með skráningum sínum.
2.2 Tengiliður ber ábyrgð á því að halda innskráningargögnum sínum öruggum og tilkynna Lifeline Health tafarlaust ef grunur leikur á misnotkun aðgangs.

3. Viðunandi notkun
3.1 Notandi skal ekki:
    a) nota þjónustusíðuna á ólöglegan hátt eða í andstöðu við almennt siðferði;
    b) reyna að trufla eða hindra rekstur síðunnar eða öryggi hennar;
    c) senda inn rangar, misvísandi eða blekkjandi upplýsingar um starfsmenn;
    d) hlaða inn persónuupplýsingum sem hann hefur ekki lögmæta heimild til að vinna með.
3.2 Lifeline Health áskilur sér rétt til að loka aðgangi sem brýtur gegn skilmálum þessum.

4. Hlutverk og takmörkun ábyrgðar
4.1 Þjónustusíðan er aðstoðartæki fyrir umsjón heilsumatsverkefna og kemur ekki í stað sjálfrar heilbrigðisþjónustunnar eða ráðgjafar lækna.
4.2 Lifeline Health leggur sig fram við að halda síðunni í rekstri en ábyrgist ekki að hún sé ávallt laus við galla, truflanir eða öryggisatvik.
4.3 Lifeline Health ber ekki ábyrgð á tjóni notanda af völdum bilana, utanaðkomandi þjónustuaðila eða vikna sem stafa af ófyrirséðum atvikum.

5. Hugverkaréttur
5.1 Allt efni þjónustusíðunnar, þar á meðal hugbúnaður, textar, myndefni, vörumerki og hönnun, er eign Lifeline Health eða samstarfsaðila þess og verndað samkvæmt höfundarréttar- og hugverkalögum.
5.2 Notanda er óheimilt að afrita, breyta, dreifa eða nýta efnið í viðskiptalegum tilgangi án skriflegs samþykkis Lifeline Health.

6. Gjaldtaka og viðskiptasamningur
6.1 Notkun þjónustusíðunnar sjálfrar er vinnuveitanda að kostnaðarlausu; gjaldtaka fyrir heilsumatsþjónustuna sjálfa fer fram á grundvelli sérstaks þjónustusamnings og innkaupapöntunar sem undirrituð er rafrænt áður en þjónusta er veitt.
6.2 Þessir skilmálar koma ekki í stað viðskiptasamnings um heilsumatsþjónustu.

7. Uppsögn
7.1 Notandi getur hvenær sem er óskað eftir því að aðgangur hans verði lokaður með tölvupósti á contact@lifelinehealth.is.
7.2 Lifeline Health getur lokað aðgangi með eðlilegum fyrirvara eða án fyrirvara ef notandi brýtur skilmálana.

8. Breytingar á skilmálum
8.1 Lifeline Health getur uppfært skilmála þessa. Við verulegar breytingar verður þess farið á leit að notandi samþykki nýja útgáfu áður en áframhaldandi notkun er heimiluð.

9. Lögsaga og varnarþing
9.1 Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

// ─── Data Processing Agreement (GDPR) ──────────────────────
export function renderDataProcessingAgreement(): string {
  return `VINNSLUSAMNINGUR UM PERSÓNUUPPLÝSINGAR
Lifeline Health ehf. – Heilsumat starfsmanna
Útgáfa ${DPA_VERSION}

1. Bakgrunnur og markmið
1.1 Vinnslusamningur þessi er gerður í samræmi við 28. gr. reglugerðar Evrópuþingsins og -ráðsins (ESB) 2016/679 (GDPR) og lög nr. 90/2018 um persónuvernd og vinnslu persónuupplýsinga.
1.2 Samningurinn gildir um alla vinnslu persónuupplýsinga sem Lifeline Health ehf. (hér eftir „vinnsluaðili") framkvæmir fyrir hönd vinnuveitanda (hér eftir „ábyrgðaraðili") í tengslum við heilsumatsþjónustu.

2. Skilgreiningar
2.1 Hugtökin í samningi þessum hafa þá merkingu sem þeim er gefin í GDPR, sbr. 4. gr. reglugerðarinnar.

3. Hlutverk aðila
3.1 Ábyrgðaraðili er vinnuveitandi starfsmannsins og ákveður tilgang og aðferðir við vinnslu þeirra starfsmannagagna sem hann miðlar til vinnsluaðila.
3.2 Vinnsluaðili vinnur persónuupplýsingarnar einungis samkvæmt skjalfestum fyrirmælum ábyrgðaraðila og í samræmi við samning þennan.
3.3 Þegar starfsmaður tekur þátt í heilsumati og veitir beint samþykki sitt verður Lifeline Health sjálfstæður ábyrgðaraðili á heilbrigðisupplýsingum þess einstaklings samkvæmt lögum nr. 34/2012 um heilbrigðisstarfsmenn og lögum nr. 55/2009 um sjúkraskrár. Sú vinnsla fellur utan þessa vinnslusamnings.

4. Eðli og tilgangur vinnslu
4.1 Tilgangur vinnslunnar er að Lifeline Health geti boðið starfsmönnum ábyrgðaraðila þátttöku í heilsumati og haldið utan um bókanir og stöðu hvers starfsmanns í ferlinu.
4.2 Eðli vinnslunnar er söfnun, geymsla, miðlun, eyðing og önnur meðferð persónuupplýsinga samkvæmt samningi þessum.

5. Tegundir persónuupplýsinga
5.1 Eftirfarandi flokkar persónuupplýsinga verða unnir fyrir hönd ábyrgðaraðila:
    a) nafn, kennitala, netfang og símanúmer starfsmanna;
    b) staða starfsmanns í boðunarferli (boð sent, bókun, þátttaka);
    c) tengsl starfsmanns við vinnuveitanda (félagakennimerki).
5.2 Viðkvæmar heilsufarsupplýsingar (sbr. 9. gr. GDPR) eru ekki unnar fyrir hönd ábyrgðaraðila. Slík vinnsla fer fram á ábyrgð Lifeline Health sem sjálfstæðs ábyrgðaraðila með beinu samþykki starfsmanns.

6. Flokkar skráðra einstaklinga
6.1 Starfsmenn ábyrgðaraðila sem skráðir eru í heilsumatsverkefni hans.

7. Geymslutími
7.1 Upplýsingar skv. 5.1 eru geymdar meðan ábyrgðaraðili er virkur viðskiptavinur Lifeline Health.
7.2 Þegar samstarfi lýkur eyðir vinnsluaðili eða afhendir upplýsingarnar skv. fyrirmælum ábyrgðaraðila, nema Lifeline Health beri skylda til að varðveita þær lengur samkvæmt lögum um sjúkraskrár.

8. Undirvinnsluaðilar
8.1 Vinnsluaðili notar eftirtalda undirvinnsluaðila við framkvæmd þjónustunnar:
    a) Medalia ehf. – hýsing sjúkraskrár skv. FHIR staðli (Ísland);
    b) Supabase Inc. – gagnagrunnur og innskráning (EES);
    c) Resend Inc. – útsending tölvupósts (EES/Bandaríki, á grundvelli staðlaðra samningsákvæða);
    d) Vercel Inc. – hýsing þjónustusíðu (EES).
8.2 Breytingar á undirvinnsluaðilum verða tilkynntar með eðlilegum fyrirvara.

9. Öryggisráðstafanir
9.1 Vinnsluaðili innleiðir viðeigandi tæknilegar og skipulagslegar öryggisráðstafanir sbr. 32. gr. GDPR, þ.m.t. dulkóðun kennitalna, aðgangsstjórnun, eftirlit með aðgerðum og reglulega yfirferð á öryggi.
9.2 Starfsmenn vinnsluaðila sem koma að vinnslunni eru bundnir þagnarskyldu.

10. Réttindi skráðra einstaklinga
10.1 Vinnsluaðili aðstoðar ábyrgðaraðila við að uppfylla skyldur sínar gagnvart skráðum einstaklingum, þ.m.t. aðgangsrétt, leiðréttingarrétt og rétt til eyðingar, eftir því sem kostur er.

11. Tilkynning um öryggisbrot
11.1 Vinnsluaðili tilkynnir ábyrgðaraðila án ótilhlýðilegrar tafar, og eigi síðar en 48 klst. eftir að hann verður var við öryggisbrot, sbr. 33. gr. GDPR.

12. Eyðing eða afhending gagna
12.1 Við lok þjónustunnar, samkvæmt fyrirmælum ábyrgðaraðila, skal vinnsluaðili eyða eða afhenda öllum persónuupplýsingum sem hann hefur unnið, nema tilvist laga komi í veg fyrir slíkt.

13. Ábyrgð
13.1 Aðilar bera ábyrgð hvor fyrir sínu hlutverki samkvæmt GDPR og lögum nr. 90/2018.

14. Lögsaga og varnarþing
14.1 Um vinnslusamning þennan gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

// ─── Employee Terms of Service (platform use) ──────────────
// Covers an employee's personal use of the Lifeline portal / app —
// distinct from the commercial TOS the contact person accepts.
export function renderEmployeeTermsOfService(): string {
  return `NOTKUNARSKILMÁLAR FYRIR STARFSMENN
Lifeline Health ehf. – Þjónustusíða og snjallforrit
Útgáfa ${EMPLOYEE_TOS_VERSION}

1. Aðilar og gildissvið
1.1 Lifeline Health ehf., kt. 590925-1440, Langholtsvegi 111, 104 Reykjavík (hér eftir „Lifeline Health") rekur þjónustusíðu og snjallforrit sem gerir þér kleift að taka þátt í heilsumati sem vinnuveitandi þinn býður þér.
1.2 Skilmálar þessir gilda um þína persónulegu notkun á þjónustunni. Þeir koma ekki í stað þeirra viðskiptaskilmála sem vinnuveitandi þinn hefur samþykkt við Lifeline Health.

2. Starfsleyfi og hlutverk Lifeline Health
2.1 Lifeline Health veitir heilsufarsþjónustu samkvæmt starfsleyfi frá Embætti landlæknis og er rekin í samræmi við lög nr. 40/2007 um heilbrigðisþjónustu og lög nr. 34/2012 um heilbrigðisstarfsmenn.
2.2 Heilbrigðisstarfsmenn Lifeline Health, þ.m.t. læknar, eru allir með tilskilin starfsleyfi frá landlækni.
2.3 Sjúkraskrárgögn þín eru varðveitt hjá Medalia ehf., viðurkenndum sjúkraskrárþjónustuaðila með leyfi til reksturs sjúkraskrár skv. lögum nr. 55/2009 um sjúkraskrár, í samræmi við FHIR staðal.

3. Aðgangur og sjálfvirk notkun
3.1 Til að nýta þjónustuna þarftu að vera 18 ára eða eldri.
3.2 Þú skuldbindur þig til að halda innskráningargögnum þínum öruggum og tilkynna Lifeline Health tafarlaust ef grunur leikur á misnotkun.
3.3 Þú notar þjónustuna á eigin ábyrgð og skuldbindur þig til að veita réttar upplýsingar í spurningalistum og mælingum.

4. Þátttaka er valfrjáls
4.1 Þátttaka í heilsumati er algjörlega valfrjáls. Þú getur hafnað þátttöku, hætt við hvenær sem er eða hætt að nota þjónustuna án afleiðinga fyrir starfssamband þitt.
4.2 Lifeline Health miðlar ekki upplýsingum um ákvörðun þína til vinnuveitanda án samþykkis þíns, sbr. skilmála um persónuvernd.

5. Aðgangur að niðurstöðum
5.1 Niðurstöður heilsumats þíns verða aðgengilegar í sjúkraskrákerfinu Medalia. Læknir Lifeline Health túlkar niðurstöður og veitir þér ráðgjöf.
5.2 Vinnuveitandi fær engar persónugreinanlegar heilsufarsupplýsingar um þig.

6. Hugverkaréttur
6.1 Allt efni þjónustusíðunnar og snjallforritsins, þ.m.t. hugbúnaður, textar, myndefni og hönnun, er eign Lifeline Health eða samstarfsaðila þess og verndað samkvæmt höfundarréttar- og hugverkalögum.

7. Ábyrgðartakmörkun
7.1 Lifeline Health leggur sig fram við að halda þjónustunni í rekstri en ábyrgist ekki að hún sé ávallt laus við galla eða truflanir.
7.2 Ráðleggingar byggðar á heilsumati eru almennar leiðbeiningar og koma ekki í stað bráðameðferðar eða heimsóknar á heilsugæslu þegar þörf krefur.

8. Uppsögn aðgangs
8.1 Þú getur hvenær sem er óskað eftir því að aðgangur þinn verði lokaður með tölvupósti á contact@lifelinehealth.is.
8.2 Lifeline Health getur lokað aðgangi með eðlilegum fyrirvara eða án fyrirvara ef notandi brýtur skilmálana.

9. Breytingar á skilmálum
9.1 Lifeline Health getur uppfært skilmála þessa. Við verulegar breytingar verður þess farið á leit að þú samþykkir nýja útgáfu áður en áframhaldandi notkun er heimiluð.

10. Lögsaga og varnarþing
10.1 Um skilmála þessa gilda íslensk lög. Rísi ágreiningur skal hann rekinn fyrir Héraðsdómi Reykjaness.`;
}

// ─── Informed consent for health assessment ────────────────
// Explicit consent under GDPR Art. 9(2)(a) for special-category
// health data AND informed consent under lög nr. 74/1997 um
// réttindi sjúklinga. Separate from the TOS so the two can be
// audited + presented independently.
export function renderHealthAssessmentConsent(): string {
  return `UPPLÝST SAMÞYKKI FYRIR HEILSUMAT
Lifeline Health ehf. – Heilsumatsþjónusta
Útgáfa ${HEALTH_CONSENT_VERSION}

1. Um samþykkið
1.1 Með því að merkja við þetta samþykki staðfestir þú að þú hafir lesið og skilið upplýsingarnar hér að neðan og veitir upplýst samþykki fyrir vinnslu heilsufarsupplýsinga þinna í tengslum við heilsumat á vegum Lifeline Health ehf., kt. 590925-1440 (hér eftir „Lifeline Health").
1.2 Samþykki þetta er veitt samkvæmt 9. gr. reglugerðar (ESB) 2016/679 (GDPR) og 11. gr. laga nr. 90/2018 um vinnslu viðkvæmra persónuupplýsinga, auk laga nr. 74/1997 um réttindi sjúklinga.

2. Hver framkvæmir heilsumatið?
2.1 Lifeline Health framkvæmir heilsumatið samkvæmt starfsleyfi frá Embætti landlæknis og í samræmi við lög nr. 40/2007 um heilbrigðisþjónustu.
2.2 Læknar og annað heilbrigðisstarfsfólk Lifeline Health hafa tilskilin starfsleyfi frá landlækni, sbr. lög nr. 34/2012 um heilbrigðisstarfsmenn, og eru bundin þagnarskyldu skv. 17. gr. þeirra laga.

3. Hver varðveitir sjúkraskrárgögnin?
3.1 Sjúkraskrárgögn þín eru skráð og varðveitt í sjúkraskrárkerfinu Medalia sem rekið er af Medalia ehf., viðurkenndum sjúkraskrárþjónustuaðila með leyfi til reksturs sjúkraskrár skv. lögum nr. 55/2009 um sjúkraskrár.
3.2 Gögnin eru varðveitt í samræmi við FHIR staðal og uppfylla kröfur persónuverndarlaga og sjúkraskrárlaga varðandi öryggi og aðgangsstýringu.
3.3 Lifeline Health og Medalia bera sameiginlega ábyrgð á vinnslu gagna þinna, hvor um sitt hlutverk skv. 26. gr. GDPR.

4. Hvaða upplýsingar verða unnar?
4.1 Svör þín við spurningalistum um lífsstíl, heilsufar, fjölskyldusögu og fyrri veikindi.
4.2 Líkamlegar mælingar: hæð, þyngd, blóðþrýstingur, líkamssamsetning (mæld með Biody tæki).
4.3 Blóðprufuniðurstöður frá Sameind eða sambærilegri viðurkenndri rannsóknarstofu.
4.4 Klínísk niðurstaða og áhættumat læknis, t.d. á grundvelli SCORE2 reiknirits.
4.5 Samskipti þín við heilbrigðisstarfsfólk Lifeline Health í gegnum þjónustusíðuna.

5. Í hvaða tilgangi?
5.1 Að framkvæma klínískt heilsumat og áhættumat á þér.
5.2 Að veita þér einstaklingsbundnar ráðleggingar og heilsueflingaráætlun.
5.3 Að halda utan um sjúkraskrá þína til að tryggja samfellu í þjónustu.
5.4 Að fylgja eftir niðurstöðum með þér í gegnum þjónustusíðuna.

6. Lagaheimildir
6.1 Fyrir sjálfa vinnslu heilbrigðisupplýsinga í sjúkraskrá: 1. mgr. 13. gr. laga nr. 55/2009 um sjúkraskrár og h-liður 2. mgr. 9. gr. GDPR (nauðsynlegt vegna heilbrigðisþjónustu).
6.2 Fyrir aðra vinnslu (t.d. samskipti í gegnum þjónustusíðuna): a-liður 1. mgr. 9. gr. GDPR (sérstakt samþykki þitt, sem þú veitir hér).

7. Hver fær aðgang að gögnunum?
7.1 Heilbrigðisstarfsfólk Lifeline Health sem kemur að heilsumati þínu.
7.2 Þú sjálf(ur) — þú hefur aðgang að eigin gögnum í gegnum þjónustusíðu Lifeline Health og í sjúklingaeftirlit Medalia.
7.3 Vinnuveitandi þinn fær EKKI persónugreinanlegar heilsufarsupplýsingar um þig. Hann fær aðeins staðfestingu á mætingu eða ópersónugreinanlegar samanteknar upplýsingar.
7.4 Þriðji aðili fær ekki aðgang nema að þínu sérstaka samþykki eða samkvæmt lagaskyldu.

8. Geymslutími
8.1 Sjúkraskrárgögn eru varðveitt samkvæmt lögum nr. 55/2009 um sjúkraskrár, sem kveða á um lágmarksvarðveislutíma sjúkraskráa.
8.2 Aðrar persónuupplýsingar eru varðveittar svo lengi sem þú ert virkur notandi þjónustunnar og eyddar innan hæfilegs tíma eftir að þú hættir notkun, nema lagaskylda kveði á um annað.

9. Réttindi þín
9.1 Þú hefur rétt á að:
    a) fá aðgang að upplýsingum um sjálfa(n) þig;
    b) fá upplýsingar leiðréttar ef þær eru rangar;
    c) fá upplýsingum eytt þar sem því verður við komið samkvæmt lögum;
    d) takmarka vinnslu eða andmæla henni;
    e) flytja gögn þín til annars þjónustuveitanda;
    f) draga samþykki þitt til baka hvenær sem er án áhrifa á starfssamband þitt.
9.2 Þú hefur jafnframt rétt á að leggja fram kvörtun hjá Persónuvernd (personuvernd.is) ef þú telur að farið hafi verið með persónuupplýsingar þínar á óviðeigandi hátt.

10. Afturköllun samþykkis
10.1 Þú getur dregið samþykki þitt til baka hvenær sem er með tölvupósti á contact@lifelinehealth.is.
10.2 Afturköllun hefur ekki áhrif á lögmæti vinnslu sem fram fer á grundvelli samþykkis fyrir afturköllun, né á þá vinnslu sem byggir á öðrum lagaheimildum (t.d. lögum nr. 55/2009 um sjúkraskrár).

11. Áhætta og takmarkanir þjónustunnar
11.1 Heilsumat Lifeline Health er skimun og áhættumat og kemur ekki í stað læknisfræðilegrar greiningar eða meðferðar hjá heilsugæslu eða sérfræðilækni.
11.2 Niðurstöður endurspegla heilsufar þitt á þeim tíma sem skoðun fer fram og geta breyst.
11.3 Ef þú færð niðurstöður sem vekja áhyggjur skaltu leita frekari aðstoðar hjá heilsugæslu eða sérfræðilækni.

12. Samþykki
12.1 Með því að merkja við samþykkiskassann staðfestir þú að:
    a) þú hafir fengið fullnægjandi upplýsingar um tilgang og eðli vinnslunnar;
    b) þú veitir upplýst og beint samþykki fyrir vinnslu heilsufarsupplýsinga þinna;
    c) þú skiljir að þú getir dregið samþykkið til baka hvenær sem er;
    d) þú sért 18 ára eða eldri.`;
}

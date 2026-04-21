// Platform-level legal documents accepted by every contact person at signup.
// The EXACT string returned by the render functions is hashed and stored in
// platform_agreement_acceptances.text_hash. Any change — even whitespace —
// MUST bump the version so existing users get re-prompted to accept.

export const TOS_VERSION = "v1.0";
export const DPA_VERSION = "v1.0";

export const TOS_KEY = "terms-of-service";
export const DPA_KEY = "data-processing-agreement";

// ─── Terms of Service (platform use) ────────────────────────
export function renderTermsOfService(): string {
  return `NOTKUNARSKILMÁLAR
Lifeline Health ehf. – Þjónustusíða fyrir vinnuveitendur
Útgáfa ${TOS_VERSION}

1. Aðilar og gildissvið
1.1 Lifeline Health ehf., kt. 590925-1440, Þrastarási 71, 221 Hafnarfjörður (hér eftir „Lifeline Health") rekur þjónustusíðu (heilsumat.lifelinehealth.is og tengdar slóðir) sem gerir vinnuveitendum kleift að skrá starfsmenn í heilsumatsþjónustu og hafa umsjón með þátttöku þeirra.
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

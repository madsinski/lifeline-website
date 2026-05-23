// Canonical text for the Lifeline Beta Tester Agreement.
//
// Server is the source of truth. When the RN app posts an acceptance
// the server re-renders this text, computes its sha256, and stores
// the hash on the row — that's how we prove which exact text the
// tester saw at the moment they signed.
//
// Bump VERSION when the text changes. Old acceptances stay valid for
// the old version; new sessions must accept the new version. Never
// edit existing language inside a published version — append a new
// version constant + render function instead.

export const BETA_NDA_KEY = "beta-tester-agreement";
export const BETA_NDA_VERSION = "1.0";
export const BETA_NDA_LAST_UPDATED = "2026-05-23";

const COMPANY = "Lifeline Health ehf. (kt. 590925-1440)";

/** Plain English NDA — the language the RN modal shows to testers. */
export function renderBetaNdaEn(): string {
  return [
    `LIFELINE BETA TESTER AGREEMENT — Version ${BETA_NDA_VERSION}`,
    `Last updated: ${BETA_NDA_LAST_UPDATED}`,
    ``,
    `This agreement is between ${COMPANY} ("Lifeline") and you, the beta tester ("Tester"). By tapping "I agree and sign" inside the Lifeline mobile app you agree to the following terms for as long as you have access to a pre-release ("beta") build of the app.`,
    ``,
    `1. Confidentiality.`,
    `You agree to keep features, screens, screenshots, performance numbers, bugs, copy, designs, branding work in progress, AI behavior, pricing experiments, business plans, partners, and any other non-public information you encounter through the beta ("Confidential Information") private until Lifeline makes that information public. You may tell other people that you are a Lifeline beta tester; you may NOT post screenshots, screen recordings, demos, or feature descriptions on social media, in blog posts, in podcasts, or in public forums.`,
    ``,
    `Confidentiality survives termination of this agreement and lasts until Lifeline publishes the relevant feature or information, or for two (2) years from the date you accept this agreement, whichever comes first.`,
    ``,
    `2. No reverse engineering.`,
    `You agree not to decompile, disassemble, intercept network traffic, or otherwise attempt to extract source code, API contracts, model weights, prompts, or proprietary algorithms from the beta app, except where local law expressly forbids waiving this right.`,
    ``,
    `3. Bug reports and feedback.`,
    `Feedback you submit through the in-app floating feedback button, by email, in person, or via any other channel may be reviewed and used by Lifeline without obligation, attribution, or compensation. You grant Lifeline a perpetual, worldwide, royalty-free license to use, modify, and incorporate your feedback into the product. You are not required to submit feedback; you may stop at any time.`,
    ``,
    `4. Beta data is real but the service is not finished.`,
    `Any health data you enter or import during the beta (body composition, blood work, training logs, food logs, sleep, wearable data, AI conversations, messages) is real data and remains yours. Lifeline processes it under the privacy policy and data processing agreement that apply to all Lifeline users. However the beta service is provided "as is" and "as available", may contain bugs that affect AI recommendations, may lose recently logged data during a deploy, and is not certified as a medical device. Do not rely on the beta for medical decisions; consult a qualified clinician for anything clinical.`,
    ``,
    `5. No warranty, no liability.`,
    `To the maximum extent permitted by Icelandic law and the EU Consumer Rights Directive, Lifeline disclaims all warranties for the beta build, including merchantability, fitness for a particular purpose, and non-infringement. Lifeline is not liable for any indirect, incidental, or consequential damages arising from your use of the beta. Nothing in this clause limits liability for gross negligence, intentional misconduct, death, or personal injury where local law forbids such limits.`,
    ``,
    `6. Withdrawal.`,
    `You may stop testing at any time by deleting the app from your device. You may also ask Lifeline at contact@lifelinehealth.is to revoke this agreement, delete your beta data, and remove your tester account. Withdrawal does not affect the confidentiality obligations in section 1, which survive.`,
    ``,
    `7. Term.`,
    `This agreement begins when you accept it inside the app and ends (a) automatically when Lifeline launches the relevant feature publicly, (b) twelve (12) months after acceptance, or (c) when either party terminates in writing — whichever comes first. Sections 1, 2, 3, 5, and 8 survive termination.`,
    ``,
    `8. Governing law and jurisdiction.`,
    `This agreement is governed by Icelandic law. Disputes arising from this agreement are settled in the District Court of Reykjavík (Héraðsdómur Reykjavíkur), unless local consumer-protection law requires another forum.`,
    ``,
    `9. Electronic signature.`,
    `By typing your full name as your signature and tapping "I agree and sign", you confirm that (a) you have read and understood this agreement, (b) you are at least 18 years old, (c) your typed name is your electronic signature under Icelandic Act No. 28/2001 on electronic signatures, and (d) this agreement is binding on you as if you had signed it on paper. Lifeline will email you a PDF copy of this agreement with the audit trail (timestamp, IP address, document hash) for your records.`,
    ``,
    `Contact: contact@lifelinehealth.is`,
    `${COMPANY}`,
  ].join("\n");
}

/** Icelandic version — same legal content for IS-speaking testers. */
export function renderBetaNdaIs(): string {
  return [
    `SAMNINGUR UM BETA-PRÓFUN LIFELINE — Útgáfa ${BETA_NDA_VERSION}`,
    `Síðast uppfært: ${BETA_NDA_LAST_UPDATED}`,
    ``,
    `Þessi samningur er milli ${COMPANY} ("Lifeline") og þín, sem beta-prófar appið ("Prófandi"). Með því að ýta á "Ég samþykki og undirrita" inni í Lifeline-appinu samþykkir þú eftirfarandi skilmála á meðan þú hefur aðgang að beta-útgáfu appsins.`,
    ``,
    `1. Trúnaður.`,
    `Þú lofar að halda eiginleikum, skjámyndum, frammistöðutölum, villum, texta, hönnun, vörumerkjavinnu, AI-hegðun, verðlagningu og öðrum upplýsingum sem þú kynnist í gegnum betað ("Trúnaðarupplýsingar") leyndum þangað til Lifeline birtir þær opinberlega. Þú mátt segja öðrum að þú sért beta-prófandi Lifeline; þú mátt EKKI birta skjámyndir, myndbönd, kynningar eða lýsingar á eiginleikum á samfélagsmiðlum, bloggi, hlaðvörpum eða opinberum vettvangi.`,
    ``,
    `Trúnaðarskyldan helst eftir að samningnum lýkur og varir þangað til Lifeline birtir viðkomandi eiginleika eða upplýsingar opinberlega, eða í tvö (2) ár frá þeim degi sem þú samþykkir samninginn — hvort sem fyrr verður.`,
    ``,
    `2. Engin endurhönnun.`,
    `Þú lofar að reyna ekki að afkóða, hluta sundur, hleruna netumferð eða ná á annan hátt í frumkóða, API-samninga, líkanaþyngdir, leiðbeiningar eða eignarréttarverndaða reiknirit úr beta-appinu, nema þar sem landslög banna afsal slíkra réttinda.`,
    ``,
    `3. Villuskýrslur og endurgjöf.`,
    `Endurgjöf sem þú sendir í gegnum fljótandi endurgjafarhnappinn í appinu, með tölvupósti, í eigin persónu eða um aðra leið er Lifeline heimilt að nota og endurnýta án skuldbindingar, eignunar eða greiðslu. Þú veitir Lifeline ótímabundið, heimsbundið og endurgjaldslaust leyfi til að nota, breyta og fella endurgjöfina inn í vöruna. Þér er ekki skylt að senda endurgjöf og getur hætt hvenær sem er.`,
    ``,
    `4. Beta-gögnin eru raunveruleg en þjónustan ófullbúin.`,
    `Þau heilsugögn sem þú skráir eða flytur inn meðan á betað stendur (líkamssamsetning, blóðprufur, æfingaskráningar, mataræði, svefn, gögn úr klæðanlegum mælum, samtöl við AI, skilaboð) eru raunveruleg gögn og þín eign. Lifeline vinnur þau samkvæmt persónuverndarstefnu og vinnslusamningi sem gildir um alla Lifeline-notendur. Beta-þjónustan er hins vegar veitt "eins og hún er" og "eins og hún er tiltæk", getur innihaldið villur sem hafa áhrif á AI-tillögur, getur tapað nýlega skráðum gögnum við uppfærslur, og er ekki vottuð sem læknisfræðilegt tæki. Treystu ekki betað í læknisfræðilegum ákvörðunum; ráðfærðu þig við hæfan heilbrigðisstarfsmann um allt sem snýr að meðferð.`,
    ``,
    `5. Engin ábyrgð, takmörkun skaðabóta.`,
    `Eftir því sem íslensk lög og neytendaverndartilskipun ESB heimila, afsalar Lifeline sér öllum ábyrgðum vegna beta-útgáfunnar, þar á meðal um seljanleika, hæfi til ákveðins tilgangs og brot á réttindum þriðja aðila. Lifeline ber ekki ábyrgð á neinu óbeinu, tilfallandi eða afleiddu tjóni sem hlýst af notkun þinni á betað. Ekkert í þessari grein takmarkar ábyrgð vegna stórkostlegs gáleysis, ásetnings, dauða eða líkamstjóns þar sem lög banna slíkar takmarkanir.`,
    ``,
    `6. Afturköllun.`,
    `Þú getur hætt prófuninni hvenær sem er með því að eyða appinu af tækinu þínu. Þú getur einnig beðið Lifeline á contact@lifelinehealth.is um að afturkalla samninginn, eyða beta-gögnum þínum og fjarlægja prófandareikning þinn. Afturköllun hefur ekki áhrif á trúnaðarskyldur í grein 1, sem haldast.`,
    ``,
    `7. Gildistími.`,
    `Samningurinn tekur gildi þegar þú samþykkir hann í appinu og fellur úr gildi (a) sjálfkrafa þegar Lifeline kynnir viðkomandi eiginleika opinberlega, (b) tólf (12) mánuðum eftir samþykki eða (c) þegar annar hvor aðili segir honum upp skriflega — hvort sem fyrst verður. Greinar 1, 2, 3, 5 og 8 halda gildi sínu eftir uppsögn.`,
    ``,
    `8. Gildandi lög og lögsaga.`,
    `Samningurinn lýtur íslenskum lögum. Ágreining sem rís út af samningnum skal leysa fyrir Héraðsdómi Reykjavíkur, nema neytendaverndarlög krefjist annars vettvangs.`,
    ``,
    `9. Rafræn undirskrift.`,
    `Með því að rita fullt nafn þitt sem undirskrift og ýta á "Ég samþykki og undirrita" staðfestir þú að (a) þú hafir lesið og skilið samninginn, (b) þú sért orðin/n 18 ára, (c) ritað nafn þitt sé rafræn undirskrift þín skv. lögum nr. 28/2001 um rafrænar undirskriftir, og (d) samningurinn sé bindandi fyrir þig eins og þú hefðir undirritað hann á pappír. Lifeline sendir þér PDF-afrit af samningnum með rafrænni sönnun (tímastimpill, IP-tala, hashvirði) til varðveislu.`,
    ``,
    `Hafðu samband: contact@lifelinehealth.is`,
    `${COMPANY}`,
  ].join("\n");
}

/** Default render — English. Bilingual PDF would be a future enhancement;
 * for v1 we ship English as the primary language since beta testers
 * are technical / mixed audience and EN is the more universal tester
 * language. IS speakers can request a copy in Icelandic via email. */
export function renderBetaNda(): string {
  return renderBetaNdaEn();
}

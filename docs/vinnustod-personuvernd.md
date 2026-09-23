# Vinnustöðin: persónuvernd og regluverk

Mat á gagnaflæðinu eins og það er í dag (2026-09-23), eftir að skýrslulesturinn
fór í loftið. Skrifað fyrir DPO/CTO og til undirbúnings fyrir lögmann.

Þetta skjal metur **vinnustöðina sem tæki**: skýrsla úr Medalia er flutt inn,
hjúkrunarfræðingur les hana með skjólstæðingi og býr til lífsstílsáætlun.

---

## 1. Hvað gerist í raun (staðfest í kóða)

| Skref | Hvar unnið | Hvað er geymt | Fer út úr EES? |
|---|---|---|---|
| PDF sleppt í vinnustöðina | Vercel (EES/USA, SCC) | **Ekkert** — skráin er lesin í minni og aldrei vistuð | Nei |
| Lestur á Lifeline-skýrslu | Okkar eigin vél (`unpdf` + `grunnheilsa.ts`) | Gildin + skýrslan sem JSON í `hc_reports` | **Nei** |
| Lestur á öðru skjali (varaleið) | **OpenAI (USA)** | Sama | **Já — allt skjalið** |
| Tillaga að áætlun | **OpenAI (USA)** | Áætlunin í okkar gagnagrunni | Já — gildi, aldur, kyn, viðtalsnótur |
| Skoðun skýrslu/áætlunar | Supabase (Þýskaland) | — | Nei |

Tvennt skiptir mestu og er rétt eins og það er:

- **Skjalið sjálft er aldrei geymt.** Engin `storage.upload` í leiðinni.
- **Medalia er áfram sjúkraskráin.** Það er þegar skjalfest í
  `security-posture.ts` §5 og er hornsteinn alls sem á eftir kemur.

---

## 2. Samanburðurinn við Apple Health heldur ekki

Þetta er mikilvægasta leiðréttingin, því forsendan ber restina.

Þegar einstaklingur hleður sinni eigin heilsufarsskrá inn í Apple Health fellur
sú vinnsla **utan GDPR** — 2. gr. 2. mgr. c-liður undanskilur vinnslu einstaklings
á eigin gögnum í persónulegum tilgangi. Enginn ábyrgðaraðili, engar skyldur.

Vinnustöðin er á hinum endanum:

- það er **starfsmaður okkar**, ekki skjólstæðingurinn, sem hleður upp skránni;
- gögnin eru um **annan einstakling**;
- tilgangurinn er **heilbrigðisþjónusta í atvinnuskyni**, ekki persónulegur.

Við erum því ábyrgðaraðili (og sameiginlegur ábyrgðaraðili með Medalia skv.
26. gr., þegar skjalfest). Full þyngd 9. gr. GDPR á við. Það er engin
„þetta er bara tæki“-undanþága til í reglugerðinni.

Það breytir ekki því að hönnunin er góð — lágmörkun gagna er raunveruleg og
Medalia er áfram skráin. En hún stenst ekki af því að hún líkist Apple Health,
heldur af því að hún uppfyllir 9. gr.

**Rétta heimildin: 9. gr. 2. mgr. h-liður** — vinnsla vegna heilbrigðisþjónustu,
af heilbrigðisstarfsmanni bundnum þagnarskyldu, ásamt 6. gr. 1. mgr. b-lið.
**Ekki samþykki.** Samþykki er veikt í meðferðarsambandi (valdaójafnvægi,
afturkallanlegt hvenær sem er) og myndi þýða að áætlunin félli niður ef það
væri dregið til baka. h-liður er bæði réttari og traustari.

---

## 3. Er vinnustöðin lækningatæki (MDR)?

Röksemdin „hjúkrunarfræðingurinn ræður, tækið stingur bara upp á“ er rétt og
skiptir máli — en hún **dugar ekki ein og sér**. MDCG 2019-11 er skýrt um að
það er *ætlaður tilgangur* sem ræður flokkun, ekki hvort maður les yfir.

Það sem heldur okkur utan MDR er annað:

- ætlaður tilgangur er **lífsstílsráðgjöf** (svefn, næring, hreyfing, andleg
  líðan), ekki greining eða meðferð;
- kerfið reiknar hvorki sjúkdómsgreiningu né skammt;
- klíníska matið og skýrslan sjálf verða til í Medalia, hjá lækni.

Tvennt þarf að passa upp á:

1. **Skrifa ætlaðan tilgang niður.** Óskrifaður ætlaður tilgangur er enginn
   ætlaður tilgangur þegar á reynir. Stutt yfirlýsing sem segir hvað kerfið
   gerir og hvað það gerir ekki, geymd með `docs/MDR-README.md`.
2. **Umferðarljósin eru næst línunni.** Frá og með deginum í dag nota þau
   *okkar* viðmið og geta því **ósammála Medalia** — t.d. 120/80 í blóðþrýstingi,
   sem Medalia kallar „Gott“ en okkar bil setur í gult. Um leið og við merkjum
   gildi sem skýrslan merkti ekki, erum við farin að leggja til nýjar
   klínískar upplýsingar fremur en að endurbirta skýrsluna.
   Mótvægið er þegar í viðmótinu: bæði gildin sjást („skýrslan segir „Gott““).
   Það á að vera þar áfram og það á að vera meðvituð ákvörðun, ekki tilviljun.

---

## 4. Stóra opna spurningin: er þetta sjúkraskrá?

`security-posture.ts` §5 segir að Medalia sé sjúkraskrárkerfið. Það er rétta
afstaðan og sú ódýra. En vinnustöðin er farin að toga í hina áttina:

- viðtalsnótur hjúkrunarfræðings,
- **„Mat læknis“** — læknir sem staðfestir niðurstöður inni hjá okkur,
- skýrslan sjálf geymd sem JSON í `hc_reports`.

Ef þetta telst sjúkraskrárfærsla skv. **lögum nr. 55/2009** fylgja kröfur um
vörslu í 30 ár, aðgangsskráningu, eftirlit Landlæknis og formlegar kröfur til
sjúkraskrárkerfa.

Tveir kostir, og það þarf að velja:

- **(a) Halda öllu klínísku í Medalia.** Vinnustöðin geymir aðeins afleidda
  lífsstílsáætlun. Ódýrt, samræmist því sem þegar er skjalfest. Kostar að
  „Mat læknis“ og viðtalsnótur færast til Medalia eða hverfa.
- **(b) Lýsa vinnustöðinni sem sjúkraskrárkerfi** og uppfylla kröfurnar.
  Dýrt, og kallar á samtal við Landlækni.

Mitt mat: **(a)**, og að „Mat læknis“ verði endurskoðað í því ljósi.
Þetta er ákvörðun sem lögmaður/Landlæknir á að staðfesta, ekki tæknileg.

---

## 5. Gloppur sem þarf að loka (raðað eftir því hvað er brýnast)

1. **OpenAI er ekki á vinnsluaðilalistanum.** `security-posture.ts` §10 telur
   Aminogram, Supabase, Vercel og Resend. OpenAI vantar — en heilsufarsgögn
   fara þangað. Það er gat í 30. gr. skránni og í fræðslunni skv. 13. gr.
   Þarf: vinnslusamning (OpenAI býður hann), SCC eða ESB-hýsingu, og færslu
   í §5 og §10 með útgáfuhækkun.
2. **Varaleiðin sendir allt skjalið.** Þegar skjalið þekkist ekki fer það
   **í heilu lagi** til OpenAI — nafn, kennitala, sími, öll gildin. Verra:
   það gerðist **þegjandi**. Ein af tveimur raunverulegum tilvísunarskýrslum
   fór þá leið þar til í dag, eingöngu af því að dálkaheitin voru á ensku.
   Þarf: hjúkrunarfræðingur samþykki hverja sendingu með skýrri viðvörun, og
   að nafn/kennitala séu fjarlægð úr textanum áður en hann fer.
3. **Engin varðveislustefna á `hc_reports`.** Taflan var búin til með
   RLS „block all“ en engri eyðingarreglu og engri aðgangsskráningu.
4. **Zero data retention hjá OpenAI.** Sjálfgefið geymir OpenAI beiðnir í
   30 daga vegna misnotkunareftirlits. ZDR þarf að sækja um sérstaklega.
5. **Ætlaður tilgangur óskrifaður** (sjá §3).
6. **Sjúkraskrárspurningin óákveðin** (sjá §4).

---

## 6. Væri betra að sleppa OpenAI alveg?

Að hluta — og við erum nú þegar komin lengra en það hljómar.

Aðalleiðin er **þegar án AI**: `grunnheilsa.ts` les Lifeline-skýrsluna
staðdeterminískt á okkar eigin vél. Ekkert fer út. Það nær yfir allar
Grunnheilsa-skýrslur, nú á báðum dálkaheitaafbrigðum.

Eftir standa tvö not:

- **varaleiðin** fyrir skönnuð skjöl og aðrar rannsóknarstofur — hér er
  lausnin ekki annað líkan heldur að senda minna og spyrja fyrst (gloppa 2);
- **tillaga að áætlun** — hér fer texti út, en engin bein auðkenni.

Fyrir hvort tveggja er raunhæfasta skrefið **ESB-hýst líkan** (Azure OpenAI í
Svíþjóð/Hollandi, eða Mistral í Frakklandi) fremur en að hýsa sjálf. Það leysir
flutningsspurninguna alveg í stað þess að reiða sig á SCC.

*(TypeSafe AI / „Jev“, sem kom til skoðunar fyrr, leysir þetta ekki: pakkinn
gerir aðeins typaða flokkun og gefur engar upplýsingar um hýsingu eða
gagnavörslu. Hann kemur hvorki í stað skjalalesturs né textasmíði.)*

---

## 7. Niðurstaða

Vinnuflæðið er verjanlegt og hönnunin er á réttri leið: skjalið er aldrei
geymt, aðalleiðin er algjörlega staðbundin, Medalia er áfram skráin og
maður tekur ákvörðunina.

Það stenst hins vegar **ekki** á þeim rökum að þetta sé eins og að hlaða eigin
gögnum í Apple Health. Það stenst af því að vinnslan á heimild í 9. gr. 2. mgr.
h-lið, af því að gögnum er haldið í lágmarki, og af því að klíníska ábyrgðin
liggur hjá heilbrigðisstarfsmanni.

Til að það haldi þarf að loka gloppu 1 og 2 áður en fleiri raunverulegir
skjólstæðingar fara í gegn, og taka ákvörðun um §4.

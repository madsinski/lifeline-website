// The three Fjarlækningar print documents for the HSU pilot, each rendered as a
// single A4 portrait page (`.a4`). Icelandic, patient- / staff-facing. Copy is
// drawn from the Fjarlækningar site + the investor/showcase decks and framed on
// the HSU pilot's asynchronous questionnaire model (pick a concern → focused
// questionnaire + home test where useful → a doctor reviews and prescribes).
//
// Shared brand styling lives in collateral-css.ts; the cyan Fjarlækningar
// wordmark comes from the `#fjar-logo` symbol in <DeckDefs>.

export type DocId = "poster" | "referral" | "advert";

export const DOC_META: { id: DocId; name: string; sub: string }[] = [
  { id: "poster", name: "Veggspjald", sub: "Fyrir móttöku HSU — fyrir sjúklinga" },
  { id: "referral", name: "Tilvísunarleiðbeiningar", sub: "A4 — fyrir heilbrigðisstarfsfólk" },
  { id: "advert", name: "Blaðaauglýsing", sub: "A4 — dagblaðsauglýsing" },
];

// The nine services from the Medalia menu „Hvernig getum við aðstoðað þig?“.
// `icon` maps to /public/fjarlaekningar-icons/<icon>.tile.svg (copied from the
// repo-root fjarlaekningar-icons set).
const SERVICES: { icon: string; label: string }[] = [
  { icon: "kvef-hosti-halsbolga", label: "Kvef, hósti og hálsbólga" },
  { icon: "thvagfaera-leggangasykingar", label: "Þvagfæra- og leggangasýkingar" },
  { icon: "frunsa", label: "Frunsa (áblástur)" },
  { icon: "ristill", label: "Ristill" },
  { icon: "frjokornaofnaemi", label: "Frjókornaofnæmi" },
  { icon: "getnadarvorn", label: "Getnaðarvörn" },
  { icon: "risvandamal", label: "Risvandamál" },
  { icon: "njalgur", label: "Njálgur" },
  { icon: "lyfjuendurnyjun", label: "Endurnýjun lyfseðils" },
];

function ico(icon: string) {
  return `/fjarlaekningar-icons/${icon}.tile.svg`;
}

function FjarLogo({ onDark = false }: { onDark?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="fjar-logo"
      src={onDark ? "/fjarlaekningar-logo-white.svg" : "/fjarlaekningar-logo.svg"}
      alt="Fjarlækningar"
    />
  );
}

// ── 1. Reception poster ──────────────────────────────────────────────────
function Poster() {
  return (
    <div className="a4">
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11mm 14mm 6mm" }}>
        <FjarLogo />
        <span className="pill tint dot">Í samstarfi við HSU</span>
      </div>

      {/* hero */}
      <div className="hero" style={{ padding: "12mm 14mm 13mm", margin: "0 14mm", borderRadius: "6mm" }}>
        <div className="eyebrow" style={{ marginBottom: "4mm" }}>Fjarlæknaþjónusta</div>
        <h1 style={{ fontSize: "40px", maxWidth: "150mm" }}>
          Þarftu að hitta lækni?<br />Þú getur gert það <span style={{ color: "#5fe0ff" }}>heiman frá þér.</span>
        </h1>
        <p style={{ marginTop: "5mm", fontSize: "14px", lineHeight: 1.5, maxWidth: "150mm" }}>
          Fjarlækningar er íslensk fjarlæknaþjónusta. Þú velur vandamálið, svarar stuttum
          spurningalista og læknir metur málið og ávísar réttri meðferð — án þess að þú þurfir að mæta.
        </p>
      </div>

      {/* services */}
      <div style={{ padding: "10mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "5mm" }}>Við getum meðal annars aðstoðað með:</h2>
        <div className="svc-grid">
          {SERVICES.map((s) => (
            <div className="svc" key={s.icon}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ico(s.icon)} alt="" />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* how it works */}
      <div style={{ padding: "9mm 14mm 0" }}>
        <h2 style={{ fontSize: "15px", marginBottom: "5mm" }}>Svona virkar það</h2>
        <div className="steps row">
          <div className="step">
            <div className="n">1</div>
            <h3>Skráðu þig inn</h3>
            <p>Á fjarlaekningar.is með rafrænum skilríkjum — í tölvu eða síma.</p>
          </div>
          <div className="step">
            <div className="n">2</div>
            <h3>Veldu vandamál</h3>
            <p>Svaraðu stuttum spurningalista. Heimapróf fylgja þar sem þau hjálpa.</p>
          </div>
          <div className="step">
            <div className="n">3</div>
            <h3>Fáðu meðferð</h3>
            <p>Læknir metur og ávísar meðferð. Lyfseðill fer beint í apótek.</p>
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ marginTop: "auto", padding: "9mm 14mm 11mm" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8mm", borderTop: "1px solid var(--line)", paddingTop: "6mm" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: "2mm" }}>Byrjaðu hér</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--ink)" }} className="grad-text">fjarlaekningar.is</div>
            <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2mm" }}>
              Í samstarfi við Lyfju — lyf og heimapróf send heim að dyrum.
            </p>
          </div>
          <div className="safety" style={{ textAlign: "right", justifyContent: "flex-end" }}>
            <span><b>Neyðartilfelli?</b> Hringdu í 112 eða leitaðu á bráðamóttöku.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 2. Internal referral guide (for HSU staff) ───────────────────────────
function Referral() {
  return (
    <div className="a4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11mm 14mm 5mm" }}>
        <FjarLogo />
        <span className="pill solid">Innanhússleiðbeiningar</span>
      </div>

      <div style={{ padding: "0 14mm" }}>
        <div className="eyebrow" style={{ marginBottom: "3mm" }}>Fyrir heilbrigðisstarfsfólk HSU</div>
        <h1 style={{ fontSize: "27px", maxWidth: "165mm" }}>
          Að vísa sjúklingi í <span className="grad-text">Fjarlækningar</span>
        </h1>
        <p style={{ marginTop: "3.5mm", fontSize: "12px", lineHeight: 1.5, color: "var(--body)", maxWidth: "170mm" }}>
          Fjarlækningar er íslensk fjarlæknaþjónusta fyrir almenna heilsugæslu, nú í tilraunasamstarfi
          við Heilbrigðisstofnun Suðurlands. Sjúklingur velur afmarkað vandamál, svarar spurningalista
          — með heimaprófi þar sem það á við (þvagstrimill, hálsstrok, CRP) — og læknir metur og ávísar
          meðferð. Þjónustan léttir álagi af móttöku fyrir væg, algeng erindi.
        </p>
      </div>

      <div style={{ padding: "7mm 14mm 0" }}>
        <div className="cols2">
          <div className="panel yes">
            <h3>Hentar vel fyrir</h3>
            <ul className="ticklist">
              <li>Kvef, hósti og hálsbólga</li>
              <li>Þvagfæra- og leggangasýkingar</li>
              <li>Frunsa, ristill og frjókornaofnæmi</li>
              <li>Getnaðarvörn og risvandamál</li>
              <li>Njálgur</li>
              <li>Endurnýjun lyfseðils og veikindavottorð</li>
            </ul>
          </div>
          <div className="panel no">
            <h3>Vísaðu ekki í fjarþjónustu</h3>
            <ul className="ticklist">
              <li>Bráð eða alvarleg einkenni — hringdu í 112</li>
              <li>Erindi sem krefjast skoðunar eða áþreifingar</li>
              <li>Ung börn og flókin fjölveikindi</li>
              <li>Óstöðugir langvinnir sjúkdómar</li>
              <li>Grunur um alvarlega undirliggjandi orsök</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ padding: "7mm 14mm 0" }}>
        <h2 style={{ fontSize: "14px", marginBottom: "4mm" }}>Hvernig þú vísar sjúklingi</h2>
        <div className="steps row">
          <div className="step">
            <div className="n">1</div>
            <h3>Beindu á gáttina</h3>
            <p>Bentu sjúklingi á fjarlaekningar.is — innskráning með rafrænum skilríkjum.</p>
          </div>
          <div className="step">
            <div className="n">2</div>
            <h3>Sjúklingur velur erindi</h3>
            <p>Velur vandamál, svarar spurningalista og tekur heimapróf ef við á.</p>
          </div>
          <div className="step">
            <div className="n">3</div>
            <h3>Læknir lýkur máli</h3>
            <p>Metur svörin, ávísar meðferð og gefur vottorð eða tilvísun eftir þörfum.</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "7mm 14mm 0" }}>
        <h2 style={{ fontSize: "14px", marginBottom: "4mm" }}>Hvað gerist svo</h2>
        <div className="rows">
          <div className="rowitem"><span className="k">Rx</span><span className="t"><b>Lyfseðill fer rafrænt í lyfjagátt</b> og er tilbúinn í apóteki að vali sjúklings.</span></div>
          <div className="rowitem"><span className="k">🏠</span><span className="t"><b>Lyfja sendir heim.</b> Lyf og heimapróf má fá send heim að dyrum — yfir 40 apótek um land allt.</span></div>
          <div className="rowitem"><span className="k">↩︎</span><span className="t"><b>Tilvísun til baka.</b> Þurfi sjúklingur skoðun eða frekari rannsókn vísar læknir aftur í hefðbundna þjónustu HSU.</span></div>
          <div className="rowitem"><span className="k">🔒</span><span className="t"><b>Öruggt.</b> Öll samskipti fara um sjúklingagátt Medalia — dulkóðuð og eingöngu aðgengileg sjúklingi og lækni.</span></div>
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "8mm 14mm 11mm" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8mm", borderTop: "1px solid var(--line)", paddingTop: "5mm" }}>
          <div className="safety"><span><b>Neyðartilfelli:</b> Fjarlækningar eru ekki fyrir bráðaþjónustu. Hringdu í 112.</span></div>
          <div style={{ fontSize: "11px", color: "var(--muted)", textAlign: "right" }}>
            Spurningar? <b style={{ color: "var(--ink)" }}>info@fjarlaekningar.is</b>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3. Newspaper advert ──────────────────────────────────────────────────
function Advert() {
  return (
    <div className="a4">
      {/* top hero */}
      <div className="hero" style={{ padding: "16mm 16mm 15mm" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12mm" }}>
          <FjarLogo onDark />
          <span className="pill" style={{ background: "rgba(255,255,255,.14)", color: "#eafaff" }}>Ný þjónusta á Íslandi</span>
        </div>
        <h1 style={{ fontSize: "46px", color: "#fff", maxWidth: "165mm" }}>
          Læknishjálp —<br /><span style={{ color: "#5fe0ff" }}>heiman frá þér.</span>
        </h1>
        <p style={{ marginTop: "6mm", fontSize: "15px", lineHeight: 1.5, maxWidth: "160mm" }}>
          Veldu vandamálið, svaraðu stuttum spurningalista og læknir ávísar réttri meðferð.
          Engin biðstofa, engin bið — læknir Fjarlækninga metur málið samdægurs.
        </p>
      </div>

      {/* services chips */}
      <div style={{ padding: "11mm 16mm 0" }}>
        <div className="eyebrow" style={{ marginBottom: "4mm" }}>Við aðstoðum meðal annars með</div>
        <div className="svc-chips">
          {SERVICES.map((s) => (
            <span className="chip" key={s.icon}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ico(s.icon)} alt="" />{s.label}
            </span>
          ))}
        </div>
      </div>

      {/* steps */}
      <div style={{ padding: "11mm 16mm 0" }}>
        <div className="steps row">
          <div className="step">
            <div className="n">1</div>
            <h3>Skráðu þig inn</h3>
            <p>Með rafrænum skilríkjum á fjarlaekningar.is.</p>
          </div>
          <div className="step">
            <div className="n">2</div>
            <h3>Veldu vandamál</h3>
            <p>Svaraðu spurningalista — heimapróf þar sem við á.</p>
          </div>
          <div className="step">
            <div className="n">3</div>
            <h3>Fáðu meðferð</h3>
            <p>Læknir ávísar; lyfseðill fer beint í apótek.</p>
          </div>
        </div>
      </div>

      {/* CTA footer */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ margin: "0 16mm 6mm", padding: "8mm 9mm", borderRadius: "5mm", background: "var(--wash)", border: "1px solid #cdeef7", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8mm" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: "2mm" }}>Byrjaðu í dag</div>
            <div className="grad-text" style={{ fontSize: "32px", fontWeight: 800 }}>fjarlaekningar.is</div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--body)", maxWidth: "70mm", textAlign: "right" }}>
            Í samstarfi við <b style={{ color: "var(--ink)" }}>Lyfju</b> og <b style={{ color: "var(--ink)" }}>HSU</b>.
            Lyf og heimapróf send heim að dyrum.
          </p>
        </div>
        <div style={{ padding: "0 16mm 13mm" }}>
          <div className="safety"><span><b>Neyðartilfelli:</b> Hringdu í 112. Fjarlækningar eru ekki ætlaðar fyrir bráðaþjónustu.</span></div>
        </div>
      </div>
    </div>
  );
}

export function CollateralDoc({ doc }: { doc: DocId }) {
  if (doc === "referral") return <Referral />;
  if (doc === "advert") return <Advert />;
  return <Poster />;
}

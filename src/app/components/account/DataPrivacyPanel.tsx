"use client";

// Data & privacy: the Biody-import consent switch and data-subject requests
// (access, rectification, erasure, …). Used on the classic account page and on
// "Aðgangur" in the heilsuferð.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, SavedNote, Switch, accountInput, accountInset, friendlyError, useDialog, useFlash } from "./ui";

// ── Data & privacy panel (Settings) ──────────────────────────────────────

const BIODY_CONSENT_KEY = "biody-import-v1";

const DSR_OPTIONS = (t: (k: string, f?: string) => string) =>
  [
  {
    value: "access",
    label: t("comp.dp.access", "Fá afrit af öllum gögnum mínum"),
    help: t("comp.dp.accessdesc", "Við tökum saman skrá með öllu sem við geymum um þig í þessu kerfi og sendum hana innan 30 daga. (Sjúkraskráin er í Medalia og um hana gilda sérstakar reglur.)"),
  },
  {
    value: "rectification",
    label: t("comp.dp.rectify", "Leiðrétta rangar upplýsingar"),
    help: t("comp.dp.rectifydesc", "Nafni, síma og heimilisfangi getur þú breytt sjálf(ur) undir „Persónuupplýsingar“ hér að ofan. Notaðu þennan valkost ef eitthvað annað þarf að laga og lýstu því hér fyrir neðan."),
  },
  {
    value: "erasure",
    label: t("comp.dp.erase", "Eyða aðgangi og gögnum"),
    help: t("comp.dp.erasedesc", "Eyðir aðganginum þínum og þeim gögnum sem við höfum safnað. Fljótlegast er að nota „Eyða aðgangi“ hér fyrir neðan. Sjúkraskráin í Medalia fylgir eigin varðveislureglum (lög nr. 55/2009)."),
  },
  {
    value: "restriction",
    label: t("comp.dp.restrict", "Stöðva vinnslu á meðan mál er skoðað"),
    help: t("comp.dp.restrictdesc", "Við hættum að nota gögnin þín í nýjum tilgangi á meðan við förum yfir athugasemd þína. Aðgangurinn helst opinn."),
  },
  {
    value: "portability",
    label: t("comp.dp.portability", "Flytja gögnin mín annað"),
    help: t("comp.dp.portabilitydesc", "Eins og afrit, en á tölvulesanlegu sniði sem hentar til að flytja í aðra þjónustu."),
  },
  {
    value: "objection",
    label: t("comp.dp.object", "Hætta notkun gagna í tilteknum tilgangi"),
    help: t("comp.dp.objectdesc", "Til dæmis markpóstur eða ópersónugreinanlegar rannsóknir. Segðu okkur nákvæmlega hvað á að stöðva."),
  },
  {
    value: "withdraw_consent",
    label: t("comp.dp.withdraw", "Draga samþykki til baka"),
    help: t("comp.dp.withdrawdesc", "Ef þú vilt afturkalla samþykki sem þú gafst. Biody-rofinn hér að ofan er algengasta dæmið. Notaðu þetta fyrir allt sem þú getur ekki breytt sjálf(ur)."),
  },
];

export default function DataPrivacyPanel({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { alert } = useDialog();
  const [biodyConsent, setBiodyConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentLoadFailed, setConsentLoadFailed] = useState(false);
  const [consentSaved, flashConsentSaved] = useFlash(3000);
  const [dsrType, setDsrType] = useState("");
  const [dsrDetails, setDsrDetails] = useState("");
  const [dsrSending, setDsrSending] = useState(false);
  const [dsrMsg, setDsrMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const dsrSelected = useMemo(() => DSR_OPTIONS(t).find((o) => o.value === dsrType) || null, [dsrType, t]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("client_consents")
        .select("granted, revoked_at")
        .eq("client_id", userId)
        .eq("consent_key", BIODY_CONSENT_KEY)
        .is("revoked_at", null)
        .maybeSingle();
      // A failed read must not look like "off": the switch would then offer
      // to grant a consent that may already exist.
      if (error) { setConsentLoadFailed(true); return; }
      setBiodyConsent(!!data && data.granted === true);
    })();
  }, [userId]);

  const toggleBiodyConsent = async () => {
    setSavingConsent(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("no_session");
      const action = biodyConsent ? "revoke" : "grant";
      const res = await fetch("/api/account/consent/biody-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || (res.status === 401 ? "unauthorized" : ""));
      setBiodyConsent(action === "grant");
      flashConsentSaved(action === "grant" ? t("comp.dp.on", "Kveikt — vistað") : t("comp.dp.off", "Slökkt — vistað"));
    } catch (e) {
      void alert({ title: t("comp.dp.savefailed-title", "Ekki tókst að vista valið"), body: friendlyError(e, t("comp.dp.consentfailed", "Ekki tókst að vista samþykkið")) });
    } finally {
      setSavingConsent(false);
    }
  };

  const submitDsr = async () => {
    setDsrSending(true);
    setDsrMsg(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("no_session");
      const res = await fetch("/api/account/data-subject-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: dsrType, details: dsrDetails }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || (res.status === 401 ? "unauthorized" : ""));
      setDsrMsg({
        type: "ok",
        text: t("comp.dp.received", "Beiðnin er móttekin. Persónuverndarfulltrúi svarar innan 30 daga."),
      });
      setDsrDetails("");
    } catch (e) {
      setDsrMsg({ type: "err", text: friendlyError(e, t("comp.dp.reqfailed", "Beiðnin mistókst. Reyndu aftur eða sendu póst á contact@lifelinehealth.is.")) });
    } finally {
      setDsrSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-hc-ink-2">{t("comp.dp.subtitle", "Stjórnaðu hvernig heilsufarsgögnin þín eru notuð hér")}</p>

      {/* Biody import consent */}
      <div id="privacy-biody" className={`${accountInset} scroll-mt-28 p-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-hc-ink">{t("comp.dp.showbiody2", "Sýna líkamssamsetningu (Biody) hér")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-hc-ink-2">
              {t("comp.dp.biodydesc2", "Sækir niðurstöður líkamssamsetningarmælinga frá Biody, samstarfsaðila okkar, inn á síðuna. Slökkt sjálfgefið. Sjúkraskráin í sjúklingagáttinni breytist ekki.")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Switch checked={!!biodyConsent} onChange={toggleBiodyConsent} disabled={savingConsent || biodyConsent === null}
              label={t("comp.dp.biodytoggle", "Kveikja eða slökkva á Biody-gögnum")} />
            {savingConsent && <span className="text-xs text-hc-ink-3">{t("acc.common.saving", "Vista…")}</span>}
            {!savingConsent && <SavedNote msg={consentSaved} className="text-xs" />}
          </div>
        </div>
        {consentLoadFailed && (
          <Alert tone="bad" compact className="mt-3">{t("comp.dp.loadfailed", "Tókst ekki að sækja stöðuna á þessari stillingu. Endurhlaððu síðuna til að reyna aftur.")}</Alert>
        )}
      </div>

      {/* Privacy request — plain-language menu */}
      <div className={`${accountInset} p-4`}>
        <p className="mb-1 text-sm font-semibold text-hc-ink">{t("comp.dp.requesttitle", "Beiðni um gögnin þín")}</p>
        <p className="mb-3 text-xs leading-relaxed text-hc-ink-2">
          {t("comp.dp.rights", "Samkvæmt persónuverndarlögum átt þú rétt á afriti af gögnunum þínum, leiðréttingu, eyðingu og fleiru. Flest getur þú gert sjálf(ur) hér. Fyrir annað skaltu velja valkost hér fyrir neðan og við svörum innan 30 daga.")}
        </p>
        <div className="space-y-3">
          <select
            value={dsrType}
            onChange={(e) => { setDsrType(e.target.value); setDsrMsg(null); }}
            aria-label={t("comp.dp.choose", "Veldu beiðni")}
            className={accountInput}
          >
            <option value="">{t("comp.dp.choose", "Veldu beiðni")}</option>
            {DSR_OPTIONS(t).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {dsrSelected && (
            <div className="rounded-hc-element bg-hc-surface px-3 py-2.5 text-xs leading-relaxed text-hc-ink-2 ring-1 ring-hc-hairline">
              {dsrSelected.help}
            </div>
          )}
          {dsrType && (
            <textarea
              value={dsrDetails}
              onChange={(e) => setDsrDetails(e.target.value)}
              placeholder={t("comp.dp.anything", "Eitthvað sem við ættum að vita? (valfrjálst)")}
              rows={2}
              aria-label={t("comp.dp.anything", "Eitthvað sem við ættum að vita? (valfrjálst)")}
              className={`${accountInput} resize-y`}
              maxLength={4000}
            />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={submitDsr} busy={dsrSending} disabled={!dsrType}>
            {dsrSending ? t("comp.dp.sending", "Sendi…") : t("comp.dp.send", "Senda beiðni")}
          </Button>
          {dsrMsg && <Alert tone={dsrMsg.type === "ok" ? "ok" : "bad"} compact>{dsrMsg.text}</Alert>}
        </div>
      </div>
    </div>
  );
}


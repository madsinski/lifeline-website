"use client";

// Data & privacy: the Biody-import consent switch and data-subject requests
// (access, rectification, erasure, …). Used on the classic account page and on
// "Aðgangur" in the heilsuferð.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Data & privacy panel (Settings) ──────────────────────────────────────

const BIODY_CONSENT_KEY = "biody-import-v1";

const DSR_OPTIONS: Array<{ value: string; label: string; help: string }> = [
  {
    value: "access",
    label: "Fá afrit af öllum gögnum mínum",
    help: "Við tökum saman skrá með öllu sem við geymum um þig í þessu kerfi og sendum hana innan 30 daga. (Sjúkraskráin er í Medalia og um hana gilda sérstakar reglur.)",
  },
  {
    value: "rectification",
    label: "Leiðrétta rangar upplýsingar",
    help: "Nafni, síma og heimilisfangi getur þú breytt sjálf(ur) undir „Persónuupplýsingar“ hér að ofan. Notaðu þennan valkost ef eitthvað annað þarf að laga og lýstu því hér fyrir neðan.",
  },
  {
    value: "erasure",
    label: "Eyða aðgangi og gögnum",
    help: "Eyðir aðganginum þínum og þeim gögnum sem við höfum safnað. Fljótlegast er að nota „Eyða aðgangi“ hér fyrir neðan. Sjúkraskráin í Medalia fylgir eigin varðveislureglum (lög nr. 55/2009).",
  },
  {
    value: "restriction",
    label: "Stöðva vinnslu á meðan mál er skoðað",
    help: "Við hættum að nota gögnin þín í nýjum tilgangi á meðan við förum yfir athugasemd þína. Aðgangurinn helst opinn.",
  },
  {
    value: "portability",
    label: "Flytja gögnin mín annað",
    help: "Eins og afrit, en á tölvulesanlegu sniði sem hentar til að flytja í aðra þjónustu.",
  },
  {
    value: "objection",
    label: "Hætta notkun gagna í tilteknum tilgangi",
    help: "Til dæmis markpóstur eða ópersónugreinanlegar rannsóknir. Segðu okkur nákvæmlega hvað á að stöðva.",
  },
  {
    value: "withdraw_consent",
    label: "Draga samþykki til baka",
    help: "Ef þú vilt afturkalla samþykki sem þú gafst. Biody-rofinn hér að ofan er algengasta dæmið. Notaðu þetta fyrir allt sem þú getur ekki breytt sjálf(ur).",
  },
];

export default function DataPrivacyPanel({ userId }: { userId: string }) {
  const [biodyConsent, setBiodyConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);
  const [dsrType, setDsrType] = useState("");
  const [dsrDetails, setDsrDetails] = useState("");
  const [dsrSending, setDsrSending] = useState(false);
  const [dsrMsg, setDsrMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const dsrSelected = useMemo(() => DSR_OPTIONS.find((o) => o.value === dsrType) || null, [dsrType]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("client_consents")
        .select("granted, revoked_at")
        .eq("client_id", userId)
        .eq("consent_key", BIODY_CONSENT_KEY)
        .is("revoked_at", null)
        .maybeSingle();
      setBiodyConsent(!!data && data.granted === true);
    })();
  }, [userId]);

  const toggleBiodyConsent = async () => {
    setSavingConsent(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Ekki innskráð(ur)");
      const action = biodyConsent ? "revoke" : "grant";
      const res = await fetch("/api/account/consent/biody-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Ekki tókst að vista samþykkið");
      setBiodyConsent(action === "grant");
    } catch (e) {
      alert("Ekki tókst að vista valið: " + (e as Error).message);
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
      if (!token) throw new Error("Ekki innskráð(ur)");
      const res = await fetch("/api/account/data-subject-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: dsrType, details: dsrDetails }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Beiðnin mistókst");
      setDsrMsg({
        type: "ok",
        text: "Beiðnin er móttekin. Persónuverndarfulltrúi svarar innan 30 daga.",
      });
      setDsrDetails("");
    } catch (e) {
      setDsrMsg({ type: "err", text: (e as Error).message });
    } finally {
      setDsrSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-[#1F2937]">Gögn og persónuvernd</p>
        <p className="text-xs text-[#6B7280]">Stjórnaðu hvernig heilsufarsgögnin þín eru notuð hér</p>
      </div>

      {/* Biody import consent */}
      <div className="bg-[#F9FAFB] rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-[#1F2937]">Sýna Biody-líkamssamsetningu hér</p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Sækir niðurstöður Biody-mælinga inn á þetta yfirlit. Slökkt sjálfgefið.
              Sjúkraskráin í Medalia breytist ekki.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleBiodyConsent}
            disabled={savingConsent || biodyConsent === null}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              biodyConsent ? "bg-[#10B981]" : "bg-gray-300"
            } ${savingConsent || biodyConsent === null ? "opacity-60" : ""}`}
            aria-pressed={!!biodyConsent}
            aria-label="Kveikja eða slökkva á Biody-gögnum"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                biodyConsent ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Privacy request — plain-language menu */}
      <div className="bg-[#F9FAFB] rounded-xl p-4">
        <p className="text-sm font-medium text-[#1F2937] mb-1">Beiðni um gögnin þín</p>
        <p className="text-xs text-[#6B7280] mb-3 leading-relaxed">
          Samkvæmt persónuverndarlögum átt þú rétt á afriti af gögnunum þínum, leiðréttingu,
          eyðingu og fleiru. Flest getur þú gert sjálf(ur) hér. Fyrir annað skaltu velja
          valkost hér fyrir neðan og við svörum innan 30 daga.
        </p>
        <div className="space-y-3">
          <select
            value={dsrType}
            onChange={(e) => { setDsrType(e.target.value); setDsrMsg(null); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
          >
            <option value="">Veldu beiðni</option>
            {DSR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {dsrSelected && (
            <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5 text-xs text-[#4B5563] leading-relaxed">
              {dsrSelected.help}
            </div>
          )}
          {dsrType && (
            <textarea
              value={dsrDetails}
              onChange={(e) => setDsrDetails(e.target.value)}
              placeholder="Eitthvað sem við ættum að vita? (valfrjálst)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y"
              maxLength={4000}
            />
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={submitDsr}
            disabled={dsrSending || !dsrType}
            className="px-4 py-2 bg-[#10B981] text-white text-sm font-semibold rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dsrSending ? "Sendi…" : "Senda beiðni"}
          </button>
          {dsrMsg && (
            <p className={`text-xs ${dsrMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {dsrMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

// Public employment-contract signing page. The `token` in the URL is
// the auth — no session is required. We fetch the contract text via the
// public /api/employment-contract?token= endpoint, show it, and let the
// candidate sign electronically (typed name + optional kennitala +
// explicit agreement). The server captures the signature, renders the
// PDF, archives it, and emails a copy.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Contract {
  candidate_name: string;
  status: "sent" | "signed" | "void";
  contract_version: string;
  signed_at: string | null;
  signatory_name: string | null;
  contract_text: string;
}

export default function SignEmploymentContractPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [kennitala, setKennitala] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/employment-contract?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          if (!cancelled) setLoadError(res.status === 404 ? "Samningur fannst ekki." : "Villa kom upp við að sækja samning.");
          return;
        }
        const j = await res.json();
        if (!cancelled) {
          setContract(j.contract);
          setName(j.contract?.candidate_name ?? "");
        }
      } catch {
        if (!cancelled) setLoadError("Villa kom upp við að sækja samning.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const submit = async () => {
    if (!name.trim() || !agree) return;
    setSubmitting(true);
    setSignError(null);
    try {
      const res = await fetch("/api/employment-contract/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatory_name: name.trim(), signatory_kennitala: kennitala.trim() || undefined, agree: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const map: Record<string, string> = {
          already_signed: "Þessi samningur hefur þegar verið undirritaður.",
          not_signable: "Þennan samning er ekki hægt að undirrita.",
          terms_changed: "Skilmálar hafa breyst. Hafðu samband við Lifeline.",
          must_agree: "Þú þarft að samþykkja samninginn.",
          pdf_render_failed: "Ekki tókst að útbúa PDF. Reyndu aftur.",
        };
        setSignError(map[j.error] ?? "Undirritun mistókst. Reyndu aftur.");
        return;
      }
      setDone(true);
    } catch {
      setSignError("Undirritun mistókst. Reyndu aftur.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Shell><p className="text-gray-500 text-center py-20">Hleð samningi…</p></Shell>;
  }
  if (loadError || !contract) {
    return <Shell><p className="text-red-600 text-center py-20">{loadError ?? "Samningur fannst ekki."}</p></Shell>;
  }

  const alreadySigned = contract.status === "signed" || done;

  return (
    <Shell>
      <div className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lifeline-logo-rebrand.svg" alt="Lifeline" className="h-7 w-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Ráðningarsamningur</h1>
        <p className="text-gray-500 mt-1">Til rafrænnar undirritunar · {contract.candidate_name}</p>
      </div>

      {/* Contract text */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800 max-h-[55vh] overflow-y-auto">
        {contract.contract_text}
      </div>

      {alreadySigned ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
          <p className="text-emerald-800 font-semibold text-lg">Samningur undirritaður.</p>
          <p className="text-emerald-700 text-sm mt-2">
            Afrit hefur verið sent á netfangið þitt. Takk fyrir{contract.signatory_name ? `, ${contract.signatory_name.split(" ")[0]}` : ""}.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Rafræn undirritun</h2>
          <label className="block mb-3">
            <span className="block text-sm text-gray-600 mb-1">Fullt nafn</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
              placeholder="Nafn þitt"
            />
          </label>
          <label className="block mb-4">
            <span className="block text-sm text-gray-600 mb-1">Kennitala <span className="text-gray-400">(valfrjálst)</span></span>
            <input
              value={kennitala}
              onChange={(e) => setKennitala(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
              placeholder="000000-0000"
              inputMode="numeric"
            />
          </label>
          <label className="flex items-start gap-3 mb-5 cursor-pointer">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" />
            <span className="text-sm text-gray-700">
              Ég hef lesið samninginn að ofan og staðfesti með rafrænni undirritun að ég samþykki hann. Undirritunin er
              bindandi og jafngild rituðu undirritun, sbr. lög nr. 28/2001 um rafrænar undirskriftir.
            </span>
          </label>
          {signError && <p className="text-red-600 text-sm mb-3">{signError}</p>}
          <button
            type="button"
            disabled={!name.trim() || !agree || submitting}
            onClick={submit}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-md hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Undirrita…" : "Undirrita samning"}
          </button>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-6">
        Lifeline Health ehf. · kt. 590925-1440 · Útgáfa {contract.contract_version}
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}

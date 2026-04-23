"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  TOS_VERSION, renderTermsOfService,
  DPA_VERSION, renderDataProcessingAgreement,
} from "@/lib/platform-terms-content";

// Contact-person claim page for admin-created companies. Consumes the
// single-use claim token, collects password + signing info, records
// the ToS + DPA acceptances via /api/business/claim/[token]/complete
// and activates the company.

type Preview = {
  ok: true;
  company_name: string;
  contact_draft_name: string | null;
  contact_draft_email: string | null;
  contact_draft_role: string | null;
  is_sub: boolean;
  parent_name: string | null;
};

export default function ClaimPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadErr, setLoadErr] = useState("");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryRole, setSignatoryRole] = useState("");
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // Session-mismatch guard — if the user is signed in as some OTHER
  // account (common when they clicked the invite link in a browser
  // tab while another Lifeline session was already open), we block
  // the form and force them to choose: sign out, or go back.
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/business/claim/${token}/complete`);
        const j = await res.json();
        if (!res.ok || !j?.ok) {
          const msg = j?.error === "expired" ? "Hlekkurinn er útrunninn. Hafðu samband við Lifeline-teymið til að fá nýjan."
            : j?.error === "already_claimed" ? "Þessi aðgangur hefur þegar verið tekinn yfir. Skráðu þig inn í staðinn."
            : j?.error === "invalid_or_consumed" ? "Ógildur hlekkur — hann hefur verið notaður eða rennt út."
            : "Gat ekki sótt boðið.";
          setLoadErr(msg);
          return;
        }
        const p: Preview = j;
        setPreview(p);
        setSignatoryName(p.contact_draft_name || "");
        setSignatoryEmail(p.contact_draft_email || "");
        setSignatoryRole(p.contact_draft_role || "");
        // Note any existing session so we can warn if it's for a
        // different email (e.g. admin tested while logged in elsewhere).
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentEmail(user?.email || null);
      } catch (e) {
        setLoadErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) { setErr("Lykilorðið verður að vera að minnsta kosti 8 stafir."); return; }
    if (password !== password2) { setErr("Lykilorðin eru ekki eins."); return; }
    if (!signatoryName.trim()) { setErr("Nafn undirritanda vantar."); return; }
    if (!preview?.is_sub && (!acceptTos || !acceptDpa)) {
      setErr("Samþykktu bæði þjónustuskilmála og gagnavinnslusamning.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/business/claim/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          signatory_name: signatoryName.trim(),
          signatory_role: signatoryRole.trim(),
          signatory_email: signatoryEmail.trim().toLowerCase(),
          accept_tos: !!preview?.is_sub ? false : true,
          accept_dpa: !!preview?.is_sub ? false : true,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setErr(j?.detail || j?.error || "Skráning mistókst.");
        return;
      }
      // Success — send them to business login so they can sign in.
      router.push(`/business/login?email=${encodeURIComponent(j.signed_in_email || signatoryEmail)}&claimed=1`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Sæki…</div>;
  }
  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-100 rounded-2xl p-8 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900">Ógilt boð</h1>
          <p className="text-sm text-gray-600 mt-2">{loadErr}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Aftur á Lifelinehealth.is</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <main className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-6">
        <header className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Tengiliðarboð</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
            Velkomin, {preview.company_name}
          </h1>
          {preview.is_sub && preview.parent_name ? (
            <p className="text-sm text-[#475569] mt-2 leading-relaxed max-w-xl mx-auto">
              Lifeline Health-teymið hefur stofnað aðgang fyrir <strong>{preview.company_name}</strong>, sem er undireining hjá <strong>{preview.parent_name}</strong>.
              Móðurfyrirtækið hefur þegar samþykkt þjónustuskilmála og gagnavinnslusamning fyrir hönd allra eininga —
              þú þarft aðeins að velja lykilorð til að taka við þessum aðgangi.
            </p>
          ) : (
            <p className="text-sm text-[#475569] mt-2 leading-relaxed max-w-xl mx-auto">
              Lifeline Health-teymið hefur stofnað aðgang fyrir fyrirtækið ykkar. Til að taka við umsjón
              þarft þú að velja lykilorð og samþykkja þjónustuskilmála og gagnavinnslusamninginn. Þú færð PDF-staðfestingu í tölvupósti eftir undirritun.
            </p>
          )}
        </header>

        {(() => {
          const expected = (preview.contact_draft_email || "").toLowerCase();
          const current = (currentEmail || "").toLowerCase();
          if (!current || !expected || current === expected) return null;
          return (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.929 19h14.142a2 2 0 001.78-2.924L13.78 4.924a2 2 0 00-3.56 0L3.15 16.076A2 2 0 004.929 19z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-amber-900 mb-1">Ertu skráð/ur inn sem rétti notandi?</div>
                  <p className="text-sm text-amber-900/90 leading-relaxed">
                    Þessi boðshlekkur var sendur á <strong className="font-mono">{preview.contact_draft_email}</strong>,
                    en þú ert núna skráð/ur inn sem <strong className="font-mono">{currentEmail}</strong>. Ef þú heldur áfram mun aðgangurinn
                    festast á rangan notanda. Skráðu þig út fyrst og opnaðu hlekkinn aftur í hreinum glugga.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setSigningOut(true);
                        await supabase.auth.signOut();
                        setCurrentEmail(null);
                        setSigningOut(false);
                      }}
                      disabled={signingOut}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60"
                    >
                      {signingOut ? "Skráir út…" : `Skrá út ${currentEmail}`}
                    </button>
                    <Link href="/" className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 text-amber-900 bg-white hover:bg-amber-50">
                      Hætta við
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <form onSubmit={submit} className={`space-y-5 ${currentEmail && preview.contact_draft_email && currentEmail.toLowerCase() !== preview.contact_draft_email.toLowerCase() ? "opacity-40 pointer-events-none" : ""}`}>
          {/* Account */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">1. Aðgangur tengiliðs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fullt nafn" required>
                <input type="text" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)}
                  required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </Field>
              <Field label="Starfsheiti">
                <input type="text" value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)}
                  placeholder="t.d. Mannauðsstjóri"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </Field>
              <Field label="Netfang" required>
                <input type="email" value={signatoryEmail} disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
                <p className="text-[11px] text-gray-500 mt-1">Þetta netfang varð fyrir valinu í boðinu. Hafðu samband ef þarft að breyta því.</p>
              </Field>
              <Field label="Lykilorð" required>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  minLength={8} required autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <p className="text-[11px] text-gray-500 mt-1">Að lágmarki 8 stafir.</p>
              </Field>
              <Field label="Lykilorð (staðfesta)" required>
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                  minLength={8} required autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </Field>
            </div>
          </section>

          {/* ToS + DPA shown only at parent-level claims. Sub-company contacts
              inherit the parent's legal signature and never see these sections. */}
          {!preview.is_sub && (
            <>
              <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">2. Notkunarskilmálar ({TOS_VERSION})</h2>
                <pre className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 text-[12px] leading-relaxed text-gray-800 bg-gray-50 whitespace-pre-wrap font-sans">
{renderTermsOfService()}
                </pre>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={acceptTos} onChange={(e) => setAcceptTos(e.target.checked)} className="mt-1" />
                  <span className="text-sm text-gray-700">
                    Ég hef lesið og samþykki Notkunarskilmála Lifeline Health ({TOS_VERSION}) fyrir hönd <strong>{preview.company_name}</strong>.
                  </span>
                </label>
              </section>

              <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">3. Gagnavinnslusamningur (DPA, {DPA_VERSION})</h2>
                <pre className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 text-[12px] leading-relaxed text-gray-800 bg-gray-50 whitespace-pre-wrap font-sans">
{renderDataProcessingAgreement()}
                </pre>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={acceptDpa} onChange={(e) => setAcceptDpa(e.target.checked)} className="mt-1" />
                  <span className="text-sm text-gray-700">
                    Ég samþykki gagnavinnslusamning Lifeline Health ({DPA_VERSION}) fyrir hönd <strong>{preview.company_name}</strong>.
                  </span>
                </label>
              </section>
            </>
          )}

          {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

          <div className="flex items-center justify-end">
            <button type="submit" disabled={submitting || (!preview.is_sub && (!acceptTos || !acceptDpa))}
              className="px-6 py-2.5 rounded-full text-white text-sm font-semibold bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50 hover:opacity-95">
              {submitting ? "Vistar…" : preview.is_sub ? "Taka við aðganginum" : "Samþykkja og taka við"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

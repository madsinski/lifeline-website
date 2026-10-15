"use client";

// Workstation invite / reset link. Step 1: choose a password (rules shown up
// front, show/hide, live match check). Step 2 on the same page: choose a PIN
// for this device, or skip. Then into /vinnustod.

import { useEffect, useId, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import AuthShell from "@/app/components/AuthShell";
import { Alert, Button, ButtonLink, accountLabel } from "@/app/components/account/ui";
import { PasswordInput, PinSetup } from "@/app/vinnustod/_ws/Login";

type Who = { name: string; email: string; kind: "invite" | "reset" };

// The same rules as passwordProblem() in src/lib/hc/secrets.ts.
const RULES: { label: string; ok: (pw: string) => boolean }[] = [
  { label: "Minnst 10 stafir", ok: (pw) => pw.length >= 10 && pw.length <= 200 },
  { label: "Bókstafir", ok: (pw) => /[A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö]/.test(pw) },
  { label: "Tölustafir", ok: (pw) => /[0-9]/.test(pw) },
];

export default function ActivateWorker() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [who, setWho] = useState<Who | null>(null);
  const [expired, setExpired] = useState("");
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const ids = { pw: useId(), pw2: useId(), rules: useId(), match: useId() };

  useEffect(() => {
    fetch(`/api/vinnustod/auth/activate?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) setWho({ name: j.name, email: j.email, kind: j.kind === "reset" ? "reset" : "invite" });
        else setExpired(j.error || "Hlekkurinn er útrunninn eða hefur þegar verið notaður.");
      })
      .catch(() => setExpired("Engin tenging. Athugaðu netið og reyndu aftur."));
  }, [token]);

  const allOk = RULES.every((r) => r.ok(pw));
  const mismatch = pw2.length > 0 && pw !== pw2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allOk) { setError("Lykilorðið uppfyllir ekki skilyrðin hér fyrir ofan."); return; }
    if (pw !== pw2) { setError("Lykilorðin stemma ekki."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/vinnustod/auth/activate", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) { setExpired(j.error || "Hlekkurinn er útrunninn eða hefur þegar verið notaður."); return; }
      // "forbidden" (same-origin check) is a code, not a sentence.
      if (!r.ok) { setError(typeof j.error === "string" && j.error.includes(" ") ? j.error : "Ekki tókst að vista lykilorðið. Reyndu aftur."); return; }
      setStep(2);
    } catch {
      setError("Engin tenging. Athugaðu netið og reyndu aftur.");
    } finally {
      setBusy(false);
    }
  };

  const enter = () => router.replace("/vinnustod");
  const kicker = <p className="text-xs font-bold uppercase tracking-[0.2em] text-hc-brand-text">Vinnustöð</p>;

  if (expired) {
    return (
      <AuthShell>
        {kicker}
        <h1 className="mt-2 text-xl font-bold text-hc-ink">Hlekkurinn virkar ekki</h1>
        <Alert tone="warn" compact className="mt-4">{expired}</Alert>
        <p className="mt-4 text-sm leading-relaxed text-hc-ink-2">
          Hafðu samband við stjórnanda til að fá nýjan hlekk. Ef þú ert þegar með lykilorð getur þú skráð þig inn, eða beðið um nýtt lykilorð þar.
        </p>
        <ButtonLink href="/vinnustod" className="mt-5 w-full">Fara á innskráningu</ButtonLink>
      </AuthShell>
    );
  }

  if (!who) {
    return (
      <AuthShell>
        {kicker}
        <p className="mt-3 text-sm text-hc-ink-2" role="status">Augnablik…</p>
      </AuthShell>
    );
  }

  const reset = who.kind === "reset";

  if (step === 2) {
    return (
      <AuthShell step={{ n: 2, of: 2 }}>
        {kicker}
        <h1 className="mt-2 text-xl font-bold text-hc-ink">Veldu PIN-númer</h1>
        <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
          {reset ? "Nýja lykilorðið er vistað og öll önnur tæki hafa verið skráð út. " : "Aðgangurinn er virkur. "}
          Með PIN-númeri skráir þú þig inn á þessu tæki án lykilorðs. Sama PIN-númer gildir á öllum tækjum sem þú lætur muna eftir þér.
        </p>
        <div className="mt-6">
          <PinSetup onDone={enter} onSkip={enter} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell step={{ n: 1, of: 2 }}>
      {kicker}
      <h1 className="mt-2 text-xl font-bold text-hc-ink">{reset ? "Veldu nýtt lykilorð" : "Virkja aðgang að vinnustöð"}</h1>
      <p className="mt-1 text-sm text-hc-ink-2">{who.name} · {who.email}</p>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {/* Lets password managers file the new password under the right account. */}
        <input type="email" value={who.email} autoComplete="username" readOnly hidden />
        <div>
          <label htmlFor={ids.pw} className={accountLabel}>{reset ? "Nýtt lykilorð" : "Lykilorð"}</label>
          <PasswordInput id={ids.pw} value={pw} onChange={setPw} show={show} onToggle={() => setShow((s) => !s)}
            autoComplete="new-password" describedBy={ids.rules} />
          <ul id={ids.rules} className="mt-2 space-y-1 text-sm" aria-label="Skilyrði fyrir lykilorð">
            {RULES.map((r) => {
              const ok = r.ok(pw);
              return (
                <li key={r.label} className={`flex items-center gap-2 ${ok ? "text-hc-ok-ink" : "text-hc-ink-2"}`}>
                  {ok ? <Check className="h-4 w-4" aria-hidden /> : <span className="inline-block h-4 w-4 text-center leading-4" aria-hidden>·</span>}
                  {r.label}<span className="sr-only">{ok ? " – uppfyllt" : " – vantar"}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <label htmlFor={ids.pw2} className={accountLabel}>Endurtaktu lykilorðið</label>
          <PasswordInput id={ids.pw2} value={pw2} onChange={setPw2} show={show} onToggle={() => setShow((s) => !s)}
            autoComplete="new-password" describedBy={ids.match} invalid={mismatch} />
          <p id={ids.match} aria-live="polite" className="mt-1.5 min-h-5 text-sm">
            {pw2.length > 0 && (mismatch
              ? <span className="inline-flex items-center gap-1.5 text-hc-bad-ink"><X className="h-4 w-4" aria-hidden />Lykilorðin stemma ekki</span>
              : <span className="inline-flex items-center gap-1.5 text-hc-ok-ink"><Check className="h-4 w-4" aria-hidden />Lykilorðin stemma</span>)}
          </p>
        </div>
        {error && <Alert tone="bad" compact>{error}</Alert>}
        <Button type="submit" busy={busy} disabled={!allOk || mismatch || !pw2} className="w-full">
          {reset ? "Vista nýtt lykilorð" : "Virkja aðgang"}
        </Button>
      </form>
    </AuthShell>
  );
}

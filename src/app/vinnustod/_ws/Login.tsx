"use client";

// Workstation sign-in, PIN setup and "Gleymt lykilorð?".
//
//   Login     password (+ "Muna þetta tæki"), or the PIN pad on a device that
//             is remembered and whose worker has a PIN. After a password
//             sign-in on a remembered device without a PIN, it offers to set
//             one before entering the workstation.
//   PinModal  set / change the PIN from inside the workstation.
//   PinSetup  the enter + confirm pad both use (and /vinnustod/virkja).
//
// The PIN belongs to the worker, not the device: the same PIN works on every
// device they have chosen to remember.

import { useEffect, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "@/app/components/AuthShell";
import PinPad from "@/app/components/hc/PinPad";
import { cookieApi as ws } from "@/app/components/hc/ws-api";
import { Alert, Button, Modal, accountInput, accountLabel } from "@/app/components/account/ui";

type Mode = "loading" | "pin" | "password" | "forgot" | "setPin";

const firstName = (n: string) => n.split(" ")[0] || n;

async function body(r: Response): Promise<Record<string, unknown>> {
  return r.json().catch(() => ({}));
}

// ── Login ──────────────────────────────────────────────────────────────────

export function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [trusted, setTrusted] = useState<{ name: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const ids = { email: useId(), pw: useId(), remember: useId(), forgot: useId() };

  useEffect(() => {
    ws("/api/vinnustod/auth/pin")
      .then((r) => r.json())
      .then((j) => {
        if (j.trusted) { setTrusted({ name: String(j.name || "") }); setMode("pin"); }
        else setMode("password");
      })
      .catch(() => setMode("password"));
  }, []);

  const go = (m: Mode) => { setError(""); setNotice(""); setMode(m); };

  const loginPin = async (v: string) => {
    setBusy(true); setError("");
    try {
      const r = await ws("/api/vinnustod/auth/pin", { method: "POST", body: JSON.stringify({ pin: v }) });
      const j = await body(r);
      if (!r.ok) {
        setPin("");
        setError(String(j.error || "Innskráning tókst ekki. Reyndu aftur."));
        if (j.locked) { setTrusted(null); setMode("password"); }
        return;
      }
      onDone();
    } catch {
      setPin(""); setError("Engin tenging. Athugaðu netið og reyndu aftur.");
    } finally {
      setBusy(false);
    }
  };

  const loginPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await ws("/api/vinnustod/auth/login", { method: "POST", body: JSON.stringify({ email, password, trust_device: remember }) });
      const j = await body(r);
      if (!r.ok) { setError(String(j.error || "Innskráning tókst ekki. Reyndu aftur.")); return; }
      // A remembered device is only quicker next time if there is a PIN.
      if (remember && !j.has_pin) { setMode("setPin"); return; }
      onDone();
    } catch {
      setError("Engin tenging. Athugaðu netið og reyndu aftur.");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await ws("/api/vinnustod/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      const j = await body(r);
      if (!r.ok) { setError(String(j.error || "Tókst ekki. Reyndu aftur.")); return; }
      setNotice(String(j.message || ""));
    } catch {
      setError("Engin tenging. Athugaðu netið og reyndu aftur.");
    } finally {
      setBusy(false);
    }
  };

  // "Ekki <nafn>?": forget this device so the next person starts clean.
  const someoneElse = async () => {
    await ws("/api/vinnustod/auth/pin", { method: "DELETE" }).catch(() => {});
    setTrusted(null); setPin(""); setEmail(""); setPassword("");
    go("password");
  };

  const kicker = <p className="text-xs font-bold uppercase tracking-[0.2em] text-hc-brand-text">Vinnustöð</p>;

  if (mode === "loading") {
    return (
      <AuthShell>
        {kicker}
        <p className="mt-3 text-sm text-hc-ink-2" role="status">Augnablik…</p>
      </AuthShell>
    );
  }

  if (mode === "setPin") {
    return (
      <AuthShell>
        {kicker}
        <h1 className="mt-2 text-xl font-bold text-hc-ink">Veldu PIN-númer</h1>
        <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
          Með PIN-númeri skráir þú þig inn á þessu tæki án lykilorðs. Sama PIN-númer gildir á öllum tækjum sem þú lætur muna eftir þér.
        </p>
        <div className="mt-6">
          <PinSetup onDone={onDone} onSkip={onDone} />
        </div>
      </AuthShell>
    );
  }

  if (mode === "pin" && trusted) {
    const first = firstName(trusted.name);
    return (
      <AuthShell
        footer={
          <span>
            Ekki {first}?{" "}
            <button type="button" onClick={someoneElse} className="font-semibold text-hc-brand-text underline-offset-2 hover:underline">
              Skrá inn sem annar
            </button>
          </span>
        }
      >
        {kicker}
        <h1 className="mt-2 text-xl font-bold text-hc-ink">Hæ {first}</h1>
        <p className="mt-1 text-sm text-hc-ink-2">Sláðu inn PIN-númerið þitt.</p>
        <div className="mt-6">
          <PinPad value={pin} onChange={(v) => { setPin(v); if (error) setError(""); }} onComplete={loginPin} disabled={busy} error={!!error} label="PIN-númer" />
        </div>
        {error && <Alert tone="bad" compact className="mt-5">{error}</Alert>}
        <div className="mt-5 text-center">
          <Button variant="link" onClick={() => go("password")}>Nota lykilorð í staðinn</Button>
        </div>
      </AuthShell>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthShell back={() => go("password")}>
        {kicker}
        <h1 className="mt-2 text-xl font-bold text-hc-ink">Gleymt lykilorð</h1>
        <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
          Sláðu inn netfangið sem þú notar í vinnustöðinni. Við sendum þér hlekk til að velja nýtt lykilorð.
        </p>
        {notice ? (
          <>
            <Alert tone="ok" compact className="mt-5">{notice}</Alert>
            <Button variant="secondary" className="mt-5 w-full" onClick={() => go("password")}>Aftur í innskráningu</Button>
          </>
        ) : (
          <form onSubmit={forgot} className="mt-5 space-y-4">
            <div>
              <label htmlFor={ids.forgot} className={accountLabel}>Netfang</label>
              <input id={ids.forgot} type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="username" inputMode="email" className={`${accountInput} mt-1 min-h-11 text-base`} />
            </div>
            {error && <Alert tone="bad" compact>{error}</Alert>}
            <Button type="submit" busy={busy} className="w-full">Senda hlekk</Button>
          </form>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {kicker}
      <h1 className="mt-2 text-xl font-bold text-hc-ink">Innskráning</h1>
      <form onSubmit={loginPw} className="mt-5 space-y-4">
        <div>
          <label htmlFor={ids.email} className={accountLabel}>Netfang</label>
          <input id={ids.email} type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username" inputMode="email" className={`${accountInput} mt-1 min-h-11 text-base`} />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={ids.pw} className={accountLabel}>Lykilorð</label>
            <button type="button" onClick={() => go("forgot")} className="text-sm font-semibold text-hc-brand-text underline-offset-2 hover:underline">
              Gleymt lykilorð?
            </button>
          </div>
          <PasswordInput id={ids.pw} value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} autoComplete="current-password" />
        </div>
        <div className="flex items-start gap-2">
          <input id={ids.remember} type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-hc-brand-dark" aria-describedby={`${ids.remember}-hint`} />
          <div>
            <label htmlFor={ids.remember} className="text-sm font-medium text-hc-ink">Muna þetta tæki</label>
            <p id={`${ids.remember}-hint`} className="text-xs text-hc-ink-3">Þá getur þú skráð þig inn með PIN-númeri næst. Ekki á sameiginlegum tölvum.</p>
          </div>
        </div>
        {error && <Alert tone="bad" compact>{error}</Alert>}
        <Button type="submit" busy={busy} className="w-full">{busy ? "Augnablik…" : "Skrá inn"}</Button>
      </form>
    </AuthShell>
  );
}

// ── Shared pieces ──────────────────────────────────────────────────────────

export function PasswordInput({ id, value, onChange, show, onToggle, autoComplete, describedBy, invalid }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative mt-1">
      <input id={id} type={show ? "text" : "password"} required value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} aria-describedby={describedBy} aria-invalid={invalid || undefined}
        className={`${accountInput} min-h-11 pr-12 text-base`} />
      <button type="button" onClick={onToggle} aria-label={show ? "Fela lykilorð" : "Sýna lykilorð"} aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-hc-element text-hc-ink-3 hover:text-hc-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand-dark">
        {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}

// Mirrors pinProblem() in src/lib/hc/secrets.ts so an obvious PIN is caught
// before the second entry; the server still has the last word.
function pinHint(pin: string): string | null {
  if (/^(\d)\1{3}$/.test(pin) || ["1234", "4321", "0123", "9876"].includes(pin)) return "Veldu PIN-númer sem er ekki augljóst.";
  return null;
}

/** Enter a four-digit PIN, enter it again, save it (PUT /api/vinnustod/auth/pin). */
export function PinSetup({ onDone, onSkip, skipLabel = "Sleppa" }: { onDone: () => void; onSkip?: () => void; skipLabel?: string }) {
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const complete = async (v: string) => {
    if (first === null) {
      const hint = pinHint(v);
      if (hint) { setError(hint); setPin(""); return; }
      setFirst(v); setPin(""); setError("");
      return;
    }
    if (v !== first) {
      setError("PIN-númerin stemma ekki. Byrjaðu aftur.");
      setFirst(null); setPin("");
      return;
    }
    setBusy(true);
    try {
      const r = await ws("/api/vinnustod/auth/pin", { method: "PUT", body: JSON.stringify({ pin: v }) });
      if (!r.ok) {
        setError(String((await body(r)).error || "Tókst ekki að vista PIN-númerið."));
        setFirst(null); setPin("");
        return;
      }
      onDone();
    } catch {
      setError("Engin tenging. Athugaðu netið og reyndu aftur.");
      setFirst(null); setPin("");
    } finally {
      setBusy(false);
    }
  };

  const step = first === null ? "Veldu fjögurra stafa PIN-númer" : "Sláðu PIN-númerið inn aftur til staðfestingar";
  return (
    <div>
      <p className="mb-4 text-center text-sm font-semibold text-hc-ink" aria-live="polite">{step}</p>
      <PinPad value={pin} onChange={(v) => { setPin(v); if (error && v) setError(""); }} onComplete={complete} disabled={busy} error={!!error} label={step} />
      {error && <Alert tone="bad" compact className="mt-4">{error}</Alert>}
      {(first !== null || onSkip) && (
        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {first !== null && <Button variant="link" onClick={() => { setFirst(null); setPin(""); setError(""); }}>Byrja upp á nýtt</Button>}
          {onSkip && <Button variant="link" onClick={onSkip}>{skipLabel}</Button>}
        </div>
      )}
    </div>
  );
}

// ── PinModal ───────────────────────────────────────────────────────────────

export function PinModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  return (
    <Modal size="sm" title="PIN-númer" onClose={onClose}
      description="Sama PIN-númer gildir á öllum tækjum sem þú lætur muna eftir þér."
      footer={<Button variant="secondary" onClick={onClose}>Hætta við</Button>}>
      <PinSetup onDone={onDone} />
    </Modal>
  );
}

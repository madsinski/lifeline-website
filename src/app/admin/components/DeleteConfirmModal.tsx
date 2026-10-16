"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Modal, Button, Alert, accountInput, accountLabel } from "@/app/components/account/ui";

interface Props {
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Checks the signed-in staff member's password on the server
 * (POST /api/admin/reauth). Never signs in from the browser: a client-side
 * signInWithPassword replaces the AAL2 session with an AAL1 one and every
 * MFA-gated admin API after it fails. Returns null on success, otherwise an
 * Icelandic reason.
 */
export async function verifyAdminPassword(password: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return "Innskráningin er útrunnin. Skráðu þig inn aftur.";
    const res = await fetch("/api/admin/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return null;
    const j = await res.json().catch(() => ({}));
    if (res.status === 401 && j?.error === "unauthorized") return "Innskráningin er útrunnin. Skráðu þig inn aftur.";
    if (j?.error === "mfa_required") return "Staðfestu tvíþætta auðkenningu aftur og reyndu svo.";
    if (j?.error === "forbidden") return "Þú hefur ekki heimild til að eyða.";
    return typeof j?.error === "string" ? j.error : "Ekki tókst að staðfesta lykilorðið.";
  } catch {
    return "Engin tenging við netþjóninn. Reyndu aftur.";
  }
}

/**
 * Three-step delete confirmation:
 * 1. Warning with description
 * 2. Type „eyða“ (or "delete") to proceed
 * 3. Password, checked server-side without touching the browser session
 */
export default function DeleteConfirmModal({ title, description, onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<"warn" | "type" | "password">("warn");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const word = typed.trim().toLowerCase();
  const typedOk = word === "eyða" || word === "delete";

  const handlePasswordConfirm = async () => {
    setBusy(true);
    setError("");
    const problem = await verifyAdminPassword(password);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message || "Ekki tókst að eyða.");
    }
    setBusy(false);
  };

  const footer =
    step === "warn" ? (
      <>
        <Button variant="secondary" data-autofocus onClick={onCancel}>Hætta við</Button>
        <Button variant="danger" onClick={() => setStep("type")}>Ég skil, halda áfram</Button>
      </>
    ) : step === "type" ? (
      <>
        <Button variant="secondary" onClick={onCancel}>Hætta við</Button>
        <Button variant="danger" disabled={!typedOk} onClick={() => { setError(""); setStep("password"); }}>Áfram</Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Hætta við</Button>
        <Button variant="danger" busy={busy} disabled={busy || !password} onClick={handlePasswordConfirm}>
          {busy ? "Eyði…" : "Eyða endanlega"}
        </Button>
      </>
    );

  return (
    <Modal size="sm" title={title} description="Ekki er hægt að afturkalla þessa aðgerð." onClose={onCancel} dismissable={!busy} footer={footer}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "type" && typedOk) { setError(""); setStep("password"); }
          else if (step === "password" && password && !busy) void handlePasswordConfirm();
        }}
      >
        <p className="text-sm leading-relaxed text-hc-ink-2">{description}</p>

        {step === "type" && (
          <div>
            <label htmlFor="delete-confirm-word" className={accountLabel}>
              Skrifaðu <span className="font-mono font-bold text-hc-bad-ink">eyða</span> til að staðfesta
            </label>
            <input
              id="delete-confirm-word"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="eyða"
              autoComplete="off"
              data-autofocus
              autoFocus
              className={`${accountInput} mt-1`}
            />
          </div>
        )}

        {step === "password" && (
          <div>
            <label htmlFor="delete-confirm-password" className={accountLabel}>
              Sláðu inn lykilorðið þitt til að staðfesta
            </label>
            <input
              id="delete-confirm-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              data-autofocus
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "delete-confirm-error" : undefined}
              className={`${accountInput} mt-1`}
            />
          </div>
        )}

        {error && (
          <div id="delete-confirm-error">
            <Alert tone="bad" compact>{error}</Alert>
          </div>
        )}
      </form>
    </Modal>
  );
}

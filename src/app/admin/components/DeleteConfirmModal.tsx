"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Three-step delete confirmation:
 * 1. Shows warning with description
 * 2. User must type "delete" to proceed
 * 3. User must enter their password to confirm
 */
export default function DeleteConfirmModal({ title, description, onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<"warn" | "type" | "password">("warn");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handlePasswordConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      // Verify password by attempting sign-in with current user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setError("Could not verify identity."); setBusy(false); return; }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (authErr) {
        setError("Incorrect password.");
        setBusy(false);
        return;
      }

      await onConfirm();
    } catch (e) {
      setError((e as Error).message || "Delete failed.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">{title}</h3>
              <p className="text-sm text-red-700 mt-0.5">This action cannot be undone.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">{description}</p>

          {/* Step 1: Warning — proceed */}
          {step === "warn" && (
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={() => setStep("type")} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">
                I understand, continue
              </button>
            </div>
          )}

          {/* Step 2: Type "delete" */}
          {step === "type" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-mono font-bold text-red-600">delete</span> to confirm
                </label>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="delete"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-300 outline-none box-border"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  onClick={() => { setError(""); setStep("password"); }}
                  disabled={typed.toLowerCase() !== "delete"}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* Step 3: Enter password */}
          {step === "password" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your admin password"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-red-300 outline-none box-border"
                />
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  onClick={handlePasswordConfirm}
                  disabled={busy || !password}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40"
                >
                  {busy ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BusinessHeader from "../BusinessHeader";

// Co-admins arrive here from the magic-link invite. They set a password and
// their details (name, role, phone) before entering the company portal. All of
// it lives on the auth user (user_metadata + password) — no schema change.
export default function CoAdminSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) { router.replace("/business/login?next=/business/co-admin-setup"); return; }
      if (u.user_metadata?.coadmin_setup_complete === true) { router.replace("/business"); return; }
      const meta = (u.user_metadata || {}) as Record<string, unknown>;
      if (typeof meta.full_name === "string") setFullName(meta.full_name);
      if (typeof meta.position === "string") setPosition(meta.position);
      if (typeof meta.phone === "string") setPhone(meta.phone);
      setLoading(false);
    });
  }, [router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !position.trim() || !phone.trim()) {
      setError("Please fill in your name, role and phone."); return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters."); return;
    }
    if (password !== confirm) {
      setError("The passwords don't match."); return;
    }
    setSaving(true);
    const { error: e1 } = await supabase.auth.updateUser({
      password,
      data: {
        full_name: fullName.trim(),
        position: position.trim(),
        phone: phone.trim(),
        coadmin_setup_complete: true,
      },
    });
    setSaving(false);
    if (e1) { setError(e1.message); return; }
    router.replace("/business");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <BusinessHeader crumbs={[{ label: "Co-admin setup" }]} />
      <main className="max-w-md mx-auto px-6 py-12">
        <section className="bg-white rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Finish setting up your access</h1>
          <p className="text-sm text-gray-600 mt-1 mb-6">
            You&apos;ve been added as a co-admin. Set a password and your details so you can log in and help manage the company.
          </p>
          <form onSubmit={save} className="space-y-4">
            <Field label="Full name">
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jón Jónsson" required />
            </Field>
            <Field label="Your role / position">
              <input className="input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. HR Manager" required />
            </Field>
            <Field label="Phone">
              <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XXXX" required />
            </Field>
            <Field label="Set a password">
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" required />
            </Field>
            <Field label="Confirm password">
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
            </Field>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Saving…" : "Save & continue"}
            </button>
          </form>
        </section>
      </main>

      <style jsx global>{`
        .input { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; outline: none; transition: border-color .15s, box-shadow .15s; }
        .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
        .btn-primary { background: linear-gradient(135deg,#3b82f6,#10b981); color: white; padding: 0.75rem 1rem; border-radius: 0.75rem; font-weight: 600; transition: opacity .15s; }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

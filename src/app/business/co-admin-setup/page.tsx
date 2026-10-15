"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AuthShell, { authInput, authLabel, authPrimary } from "@/app/components/AuthShell";
import { authErrorIs } from "@/lib/auth-errors-is";
import { cleanKennitala, formatKennitala, isValidKennitala } from "@/lib/kennitala";
import PasswordField, { B2B_MIN_PW } from "../PasswordField";

// Co-admins arrive here from the magic-link invite. They set a password and
// their details (name, role, phone, kennitala) before entering the company
// portal — the same identifying details the primary contact gives at signup.
// Name/role/phone live on the auth user (user_metadata); phone/position +
// the encrypted kennitala are also persisted to company_admins via
// /api/business/co-admin-profile so they show up in the company dashboard.
//
// Order matters: the profile is saved first and the password +
// coadmin_setup_complete flag last. The other way round, a failed profile
// save left the flag set (so a reload skipped this page) and a retry hit
// Supabase's "new password must differ" error.
export default function CoAdminSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [kennitala, setKennitala] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) { router.replace("/business/login?next=/business/co-admin-setup"); return; }
      if (u.user_metadata?.coadmin_setup_complete === true) { router.replace("/business/account"); return; }
      const meta = (u.user_metadata || {}) as Record<string, unknown>;
      if (typeof meta.full_name === "string") setFullName(meta.full_name);
      if (typeof meta.position === "string") setPosition(meta.position);
      if (typeof meta.phone === "string") setPhone(meta.phone);
      setLoading(false);
    });
  }, [router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!fullName.trim() || !position.trim() || !phone.trim()) {
      setError("Fylltu út nafn, starfsheiti og símanúmer."); return;
    }
    if (!isValidKennitala(kennitala)) {
      setError("Kennitalan er ekki gild. Hún á að vera 10 tölustafir."); return;
    }
    if (password.length < B2B_MIN_PW) {
      setError(`Lykilorðið þarf að vera minnst ${B2B_MIN_PW} stafir.`); return;
    }
    if (password !== confirm) {
      setError("Lykilorðin stemma ekki."); return;
    }
    setSaving(true);

    // 1. Phone/position + encrypted kennitala onto company_admins, so the
    //    company dashboard shows the same details it shows for the primary.
    const { data: s } = await supabase.auth.getSession();
    const tok = s.session?.access_token;
    const res = await fetch("/api/business/co-admin-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify({ phone: phone.trim(), position: position.trim(), kennitala: cleanKennitala(kennitala) }),
    }).catch(() => null);
    if (!res) { setSaving(false); setError("Engin tenging. Athugaðu netið og reyndu aftur."); return; }
    if (!res.ok) {
      setSaving(false);
      setError(res.status === 401
        ? "Innskráningin er útrunnin. Opnaðu hlekkinn úr boðspóstinum aftur."
        : res.status === 400
          ? "Athugaðu símanúmer, starfsheiti og kennitölu og reyndu aftur."
          : "Ekki tókst að vista upplýsingarnar. Reyndu aftur.");
      return;
    }

    // 2. Password + name, and the flag that this page is done.
    const { error: e1 } = await supabase.auth.updateUser({
      password,
      data: {
        full_name: fullName.trim(),
        position: position.trim(),
        phone: phone.trim(),
        coadmin_setup_complete: true,
      },
    });
    if (e1) { setSaving(false); setError(authErrorIs(e1)); return; }

    // Stays "Vista…" until the account page takes over.
    router.replace("/business/account");
  };

  if (loading) {
    return (
      <AuthShell>
        <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-hc-ink-2">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Hleð…
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-hc-ink">Ljúktu uppsetningu aðgangsins</h1>
      <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
        Þér hefur verið bætt við sem stjórnanda fyrirtækisins. Veldu lykilorð og fylltu út upplýsingarnar
        þínar svo þú getir skráð þig inn og haldið utan um verkefnið með öðrum stjórnendum.
      </p>
      <form onSubmit={save} className="mt-6 space-y-4" noValidate>
        <label className="block">
          <span className={authLabel}>Fullt nafn</span>
          <input className={authInput} value={fullName} onChange={(e) => setFullName(e.target.value)}
            autoComplete="name" placeholder="Jón Jónsson" required />
        </label>
        <label className="block">
          <span className={authLabel}>Starfsheiti</span>
          <input className={authInput} value={position} onChange={(e) => setPosition(e.target.value)}
            autoComplete="organization-title" placeholder="t.d. mannauðsstjóri" required />
        </label>
        <label className="block">
          <span className={authLabel}>Símanúmer</span>
          <input className={authInput} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel" placeholder="000 0000" required />
        </label>
        <label className="block">
          <span className={authLabel}>Kennitala</span>
          <input className={authInput} inputMode="numeric" value={kennitala}
            onChange={(e) => setKennitala(e.target.value)}
            onBlur={() => setKennitala((v) => formatKennitala(v))}
            placeholder="000000-0000" maxLength={11} required />
          <span className="mt-1 block text-xs text-hc-ink-3">10 tölustafir. Geymd dulkóðuð.</span>
        </label>
        <PasswordField
          label="Veldu lykilorð"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={B2B_MIN_PW}
          hint={`Minnst ${B2B_MIN_PW} stafir`}
        />
        <PasswordField
          label="Endurtaktu lykilorðið"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={B2B_MIN_PW}
        />
        {error && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{error}</p>}
        <button type="submit" disabled={saving} aria-busy={saving} className={authPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {saving ? "Vista…" : "Vista og halda áfram"}
        </button>
      </form>
    </AuthShell>
  );
}

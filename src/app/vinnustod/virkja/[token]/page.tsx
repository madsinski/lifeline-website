"use client";

// Workstation invite / reset: choose a password, then straight in.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LifelineLogo from "@/app/components/LifelineLogo";

export default function ActivateWorker() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [who, setWho] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/vinnustod/auth/activate?token=${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? setWho(await r.json()) : setError((await r.json()).error || "Hlekkurinn er ógildur.")))
      .catch(() => setError("Villa kom upp."));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setError("Lykilorðin stemma ekki."); return; }
    setBusy(true); setError("");
    const r = await fetch("/api/vinnustod/auth/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error || "Tókst ekki."); return; }
    router.replace("/vinnustod");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm">
        <LifelineLogo size="lg" />
        <h1 className="mt-6 text-xl font-bold">Virkja aðgang að vinnustöð</h1>
        {who ? (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">{who.name} · {who.email}</p>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nýtt lykilorð (minnst 10 stafir)" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Endurtaktu lykilorðið" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-[#10B981] py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Augnablik…" : "Virkja"}</button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-600">{error || "Hleð…"}</p>
        )}
      </div>
    </div>
  );
}

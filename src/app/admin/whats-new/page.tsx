"use client";

// Editor for the homepage "What's new" (Nýtt hjá Lifeline) carousel.
// Loads/saves the singleton blob via /api/admin/whats-new (staff read,
// admin+AAL2 write). Auto-saves ~1s after edits. The homepage reads the
// public /api/whats-new. Model: src/lib/whats-new.ts.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  mergeWhatsNew,
  DEFAULT_WHATS_NEW,
  blankCard,
  VARIANT_ORDER,
  VARIANTS,
  type Lang,
  type WhatsNewCard,
} from "@/lib/whats-new";
import { CardView } from "@/app/components/WhatsNew";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

type Status = "idle" | "saving" | "saved" | "error";
const EMPTY_L = { is: "", en: "" };

/** Two-language labelled single-line inputs. */
function LocInp({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: { is: string; en: string } | undefined;
  onChange: (v: { is: string; en: string }) => void;
  placeholder?: string;
}) {
  const v = value ?? EMPTY_L;
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={v.is}
          onChange={(e) => onChange({ ...v, is: e.target.value })}
          placeholder={placeholder ? `${placeholder} (IS)` : "Íslenska"}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          value={v.en}
          onChange={(e) => onChange({ ...v, en: e.target.value })}
          placeholder={placeholder ? `${placeholder} (EN)` : "English"}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
    </div>
  );
}

/** Two-language labelled multi-line inputs. */
function LocTxt({
  label, value, onChange, hint, rows = 2,
}: {
  label: string;
  value: { is: string; en: string };
  onChange: (v: { is: string; en: string }) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}{hint ? <span className="ml-2 font-normal normal-case text-gray-400">{hint}</span> : null}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <textarea
          value={value.is}
          rows={rows}
          onChange={(e) => onChange({ ...value, is: e.target.value })}
          placeholder="Íslenska"
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <textarea
          value={value.en}
          rows={rows}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
          placeholder="English"
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
    </div>
  );
}

function Inp({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}

export default function WhatsNewAdminPage() {
  const [cards, setCards] = useState<WhatsNewCard[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [previewLang, setPreviewLang] = useState<Lang>("is");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/whats-new", { headers: await authHeaders() });
        const j = res.ok ? await res.json() : null;
        if (!cancel) setCards(mergeWhatsNew(j?.data).cards);
      } catch {
        if (!cancel) setCards(DEFAULT_WHATS_NEW.cards);
      }
    })();
    return () => {
      cancel = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Edits flow through mutate() so loading never triggers a save.
  function mutate(next: WhatsNewCard[]) {
    setCards(next);
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/whats-new", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ data: { cards: next } }),
        });
        setStatus(res.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    }, 1000);
  }

  if (!cards) return <p className="mx-auto max-w-5xl px-4 py-10 text-sm text-gray-400">Hleð efni…</p>;

  const set = (i: number, patch: Partial<WhatsNewCard>) =>
    mutate(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    const next = [...cards];
    [next[i], next[j]] = [next[j], next[i]];
    mutate(next);
  };
  const remove = (i: number) => mutate(cards.filter((_, idx) => idx !== i));
  const add = () => mutate([...cards, blankCard()]);

  const statusLabel =
    status === "saving" ? "Vista…" : status === "saved" ? "Vistað ✓" : status === "error" ? "Villa við vistun" : "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-emerald-700 hover:underline">← Admin</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Nýtt hjá Lifeline</h1>
          <p className="text-sm text-gray-500">
            Spjöldin í „What&apos;s new“ rennunni á forsíðunni. Breytingar vistast sjálfkrafa og birtast á forsíðunni.
          </p>
        </div>
        <span
          className={`text-sm font-medium ${
            status === "error" ? "text-red-500" : status === "saved" ? "text-emerald-600" : "text-gray-400"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Live preview — reuses the exact homepage card, updates as you type */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Forskoðun (eins og á forsíðu)</span>
          <div className="flex overflow-hidden rounded-full border border-gray-300 text-xs font-semibold">
            {(["is", "en"] as Lang[]).map((lng) => (
              <button
                key={lng}
                onClick={() => setPreviewLang(lng)}
                className={`px-3 py-1 ${previewLang === lng ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {cards.filter((c) => c.enabled).length === 0 && (
            <p className="py-8 text-sm text-gray-400">Engin virk spjöld til að forskoða.</p>
          )}
          {cards.map((c, i) =>
            c.enabled ? (
              <div key={c.key + i} className="w-[300px] shrink-0">
                <div className="pointer-events-none">
                  <CardView card={c} lang={previewLang} />
                </div>
              </div>
            ) : null,
          )}
        </div>
      </div>

      <div className="space-y-5">
        {cards.map((c, i) => (
          <div
            key={c.key + i}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${c.enabled ? "border-gray-200" : "border-dashed border-gray-300 opacity-70"}`}
          >
            <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => set(i, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Virkt
              </label>
              <span className="truncate text-sm font-semibold text-gray-900">
                {c.title.is || c.title.en || c.key}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Færa upp"
                  className="rounded-md border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >↑</button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === cards.length - 1}
                  title="Færa niður"
                  className="rounded-md border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >↓</button>
                <button
                  onClick={() => remove(i)}
                  title="Eyða spjaldi"
                  className="ml-1 rounded-md border border-red-200 px-2.5 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                >Eyða</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Útlit</label>
                <div className="flex flex-wrap gap-2">
                  {VARIANT_ORDER.map((vr) => (
                    <button
                      key={vr}
                      onClick={() => set(i, { variant: vr })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        c.variant === vr
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500"
                          : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {VARIANTS[vr].label}
                    </button>
                  ))}
                </div>
              </div>
              <LocInp label="Merki (badge)" value={c.badge} onChange={(v) => set(i, { badge: v })} placeholder="NÝTT" />
              <LocInp label="Hnappur (CTA)" value={c.cta} onChange={(v) => set(i, { cta: v })} placeholder="Skoða" />
              <div className="md:col-span-2">
                <LocInp label="Teaser-lykilorð" value={c.tag} onChange={(v) => set(i, { tag: v })} placeholder="t.d. Heilsumat" />
              </div>

              <div className="md:col-span-2">
                <LocInp label="Titill" value={c.title} onChange={(v) => set(i, { title: v })} />
              </div>
              <div className="md:col-span-2">
                <LocTxt label="Lýsing" value={c.desc} onChange={(v) => set(i, { desc: v })} rows={2} />
              </div>
              <div className="md:col-span-2">
                <LocTxt
                  label="Punktar"
                  hint="ein lína = einn punktur"
                  rows={4}
                  value={{ is: c.bullets.is.join("\n"), en: c.bullets.en.join("\n") }}
                  onChange={(v) => set(i, { bullets: { is: v.is.split("\n"), en: v.en.split("\n") } })}
                />
              </div>

              <LocInp label="Samstarfsaðili — valfrjálst" value={c.partner} onChange={(v) => set(i, { partner: v })} placeholder="Í samstarfi við…" />
              <LocInp label="Verð — valfrjálst" value={c.price} onChange={(v) => set(i, { price: v })} placeholder="49.990 kr." />

              <Inp label="Hlekkur (href)" value={c.href} onChange={(v) => set(i, { href: v })} placeholder="/coaching eða https://…" />
              <Inp label="QR-slóð — valfrjálst" value={c.qrUrl ?? ""} onChange={(v) => set(i, { qrUrl: v })} placeholder="https://…" />
              <div className="md:col-span-2">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!c.emailCapture}
                    onChange={(e) => set(i, { emailCapture: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Netfangssöfnun (early access) — hnappurinn verður að netfangsreit. Áskriftir fara í{" "}
                    <span className="font-medium">Email list</span> (merkt <code className="rounded bg-gray-100 px-1">whatsnew-{c.key}</code>). Hlekkur og QR eru þá óvirk.
                  </span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-emerald-300 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
      >
        + Bæta við spjaldi
      </button>

      <p className="mt-6 text-xs text-gray-400">
        Skildu eftir tómt í „Samstarfsaðili“, „Verð“ eða „QR-slóð“ til að fela þau á spjaldinu.
        Slökktu á „Virkt“ til að fela spjald án þess að eyða því.
      </p>
    </div>
  );
}

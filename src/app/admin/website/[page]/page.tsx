"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDialog } from "@/app/components/account/ui";
import { supabase } from "@/lib/supabase";
import { getMyStaffRole } from "@/lib/staff-role";
import HomeView from "@/app/HomeView";
import CoachingView from "@/app/coaching/CoachingView";
import AssessmentView from "@/app/assessment/AssessmentView";
import BusinessView from "@/app/business/BusinessView";
import ContactView from "@/app/contact/ContactView";
import ImageUploadCrop from "../ImageUploadCrop";
import { getSitePage, resolveContent, resolveSections } from "@/lib/site-content/registry";
import type { Locale, SiteContentBlob, SiteField } from "@/lib/site-content/types";

// pending = edited, waiting out the debounce; saving = PUT in flight.
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function Preview({ pageKey, blob, locale }: { pageKey: string; blob: SiteContentBlob; locale: Locale }) {
  const c = resolveContent(pageKey, blob, locale);
  const order = resolveSections(pageKey, blob);
  if (pageKey === "home") {
    return <HomeView c={c} order={order} hidden={blob.hidden ?? []} locale={locale} />;
  }
  if (pageKey === "coaching") {
    return <CoachingView c={c} order={order} hidden={blob.hidden ?? []} locale={locale} />;
  }
  if (pageKey === "assessment") {
    return <AssessmentView c={c} order={order} hidden={blob.hidden ?? []} locale={locale} />;
  }
  if (pageKey === "business") {
    return <BusinessView c={c} order={order} hidden={blob.hidden ?? []} locale={locale} />;
  }
  if (pageKey === "contact") {
    return <ContactView c={c} locale={locale} />;
  }
  return null;
}

// Split a pipe-string into a grid of trimmed cells, padded to `cols` per row.
function toGrid(value: string, cols: number): string[][] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split("|").map((c) => c.trim());
      while (cells.length < cols) cells.push("");
      return cells;
    });
}
const joinGrid = (grid: string[][]) => grid.map((cells) => cells.join(" | ")).join("\n");

// List editor for a "list" field (team members, partners, trust chips). Text
// columns are edited per locale; asset/url columns are locale-independent and
// kept in sync across both languages.
function ListEditor({
  field,
  isStr,
  enStr,
  disabled,
  onChange,
}: {
  field: SiteField;
  isStr: string;
  enStr: string;
  disabled: boolean;
  onChange: (nextIs: string, nextEn: string) => void;
}) {
  const cols = field.columns ?? [{ key: "value", label: "Gildi", kind: "text" as const }];
  const gis = toGrid(isStr, cols.length);
  const gen = toGrid(enStr, cols.length);
  const rowCount = Math.max(gis.length, gen.length);
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    is: gis[i] ?? cols.map(() => ""),
    en: gen[i] ?? gis[i] ?? cols.map(() => ""),
  }));

  const write = (nextRows: { is: string[]; en: string[] }[]) =>
    onChange(joinGrid(nextRows.map((r) => r.is)), joinGrid(nextRows.map((r) => r.en)));

  const setCell = (row: number, col: number, loc: Locale, val: string) => {
    const next = rows.map((r) => ({ is: [...r.is], en: [...r.en] }));
    const kind = cols[col].kind ?? "text";
    if (kind === "text") {
      next[row][loc][col] = val;
    } else {
      // Asset/URL columns are the same in every language.
      next[row].is[col] = val;
      next[row].en[col] = val;
    }
    write(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };
  const dup = (i: number) => write([...rows.slice(0, i + 1), { is: [...rows[i].is], en: [...rows[i].en] }, ...rows.slice(i + 1)]);
  const del = (i: number) => write(rows.filter((_, j) => j !== i));
  const add = () => write([...rows, { is: cols.map(() => ""), en: cols.map(() => "") }]);

  const singleTextCol = cols.length === 1 && (cols[0].kind ?? "text") === "text";

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-500">Lína {i + 1}</span>
            {!disabled && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Færa upp">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Færa niður">↓</button>
                <button type="button" onClick={() => dup(i)} className="rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100">Afrita</button>
                <button type="button" onClick={() => del(i)} className="rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50">Eyða</button>
              </div>
            )}
          </div>
          {cols.map((col, ci) => {
            const kind = col.kind ?? "text";
            if (kind !== "text") {
              return (
                <label key={col.key} className="block">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">{col.label}</span>
                  <input
                    value={r.is[ci] ?? ""}
                    disabled={disabled}
                    onChange={(e) => setCell(i, ci, "is", e.target.value)}
                    placeholder={kind === "url" ? "https://…" : "/mynd.png eða https://…"}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-emerald-200 outline-none disabled:bg-gray-50"
                  />
                </label>
              );
            }
            return (
              <div key={col.key}>
                {!singleTextCol && <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{col.label}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(["is", "en"] as Locale[]).map((loc) => (
                    <label key={loc} className="block">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">{loc}</span>
                      <input
                        value={r[loc][ci] ?? ""}
                        disabled={disabled}
                        onChange={(e) => setCell(i, ci, loc, e.target.value)}
                        placeholder={loc === "en" ? "(þýðing)" : ""}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-200 outline-none disabled:bg-gray-50"
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
          + Bæta við línu
        </button>
      )}
    </div>
  );
}

function errorText(code: unknown, status: number): string {
  if (code === "mfa_required") return "krefst tveggja þrepa auðkenningar (MFA) – skráðu þig inn aftur með MFA.";
  if (code === "forbidden") return "þú hefur ekki heimild til þess.";
  if (code === "unauthorized") return "innskráning er útrunnin – skráðu þig inn aftur.";
  if (typeof code === "string" && code) return code;
  return `villa ${status}`;
}

export default function SiteContentEditor() {
  const params = useParams<{ page: string }>();
  const pageKey = params?.page ?? "home";
  const page = getSitePage(pageKey);
  const router = useRouter();
  const dialog = useDialog();

  const [draft, setDraft] = useState<SiteContentBlob>({ is: {}, en: {} });
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<Locale>("is");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The draft as the server last confirmed it (JSON). Autosave compares the
  // live draft against it, so a draft that came from the server (load,
  // translate) is never PUT back, and "dirty" means exactly "not on the
  // server yet".
  const savedJson = useRef<string | null>(null);
  const draftRef = useRef(draft);
  const inflight = useRef<Promise<boolean> | null>(null);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = await getMyStaffRole(user.email);
        setIsAdmin(role === "admin");
      }
      const res = await fetch(`/api/admin/site-content/${pageKey}`, { headers: await authHeaders() });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        const d = (j.content?.draft as SiteContentBlob) ?? {};
        const next: SiteContentBlob = { is: d.is ?? {}, en: d.en ?? {}, order: d.order, hidden: d.hidden };
        savedJson.current = JSON.stringify(next);
        draftRef.current = next;
        setDraft(next);
        setPublishedAt(j.content?.published_at ?? null);
        setSaveState("idle");
      } else {
        // Never fall back to an empty draft: the first keystroke would
        // autosave it over the real one.
        setLoadError(errorText(j.error, res.status));
      }
    } catch {
      setLoadError("Netvilla – tókst ekki að sækja drögin.");
    }
    setLoading(false);
  }, [pageKey]);

  // PUT the current draft unless the server already has it. Serialised: a
  // save that starts while one is in flight waits for it, then sends the
  // newest draft. Resolves true when the server has the draft as it is now.
  const saveNow = useCallback(async (): Promise<boolean> => {
    clearTimeout(saveTimer.current);
    if (inflight.current) await inflight.current.catch(() => false);
    const snapshot = draftRef.current;
    const json = JSON.stringify(snapshot);
    if (json === savedJson.current) {
      setSaveState((s) => (s === "idle" ? "idle" : "saved"));
      return true;
    }
    setSaveState("saving");
    const run = (async () => {
      try {
        const res = await fetch(`/api/admin/site-content/${pageKey}`, {
          method: "PUT",
          headers: await authHeaders(),
          body: JSON.stringify({ draft: snapshot }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.ok === false) {
          setSaveError(errorText(j.error, res.status));
          setSaveState("error");
          return false;
        }
        savedJson.current = json;
        setSaveError(null);
        // Edited again while this was in flight: the debounce has it.
        setSaveState(JSON.stringify(draftRef.current) === json ? "saved" : "pending");
        return true;
      } catch {
        setSaveError("Netvilla – drögin vistuðust ekki.");
        setSaveState("error");
        return false;
      }
    })();
    inflight.current = run;
    const ok = await run;
    if (inflight.current === run) inflight.current = null;
    return ok && JSON.stringify(draftRef.current) === json;
  }, [pageKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced autosave of the draft (admin only).
  useEffect(() => {
    draftRef.current = draft;
    if (loading || !isAdmin || savedJson.current === null) return;
    if (JSON.stringify(draft) === savedJson.current) return;
    setSaveState((s) => (s === "saving" ? s : "pending"));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveNow(); }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [draft, loading, isAdmin, saveNow]);

  const unsaved = saveState === "pending" || saveState === "saving" || saveState === "error";

  // Leaving with edits the server does not have yet loses them.
  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  const setField = (locale: Locale, key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? {}), [key]: value } }));
  };
  // Crop aspect for a mockup screenshot field: follows the sibling device
  // selector (phone = tall, laptop = 16:10) so the crop matches the frame.
  const imageAspect = (key: string): number => {
    const deviceKey = key.replace(/_screenshot$/, "_device");
    const device = draft.is?.[deviceKey] ?? page?.defaultsIs[deviceKey];
    return device === "laptop" ? 16 / 10 : 1440 / 2988;
  };

  const setListField = (key: string, nextIs: string, nextEn: string) => {
    setDraft((prev) => ({
      ...prev,
      is: { ...(prev.is ?? {}), [key]: nextIs },
      en: { ...(prev.en ?? {}), [key]: nextEn },
    }));
  };

  const sectionOrder = useMemo(() => resolveSections(pageKey, draft), [pageKey, draft]);
  const hiddenSet = useMemo(() => new Set(draft.hidden ?? []), [draft.hidden]);
  const sectionLabel = (id: string) => page?.sections.find((s) => s.id === id)?.label ?? id;

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= sectionOrder.length) return;
    const next = [...sectionOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraft((prev) => ({ ...prev, order: next }));
  };
  const toggleHidden = (id: string) => {
    setDraft((prev) => {
      const set = new Set(prev.hidden ?? []);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...prev, hidden: Array.from(set) };
    });
  };
  const resetOrder = () => setDraft((prev) => ({ ...prev, order: page?.sections.map((s) => s.id), hidden: [] }));
  const isCustom =
    (!!draft.order?.length && JSON.stringify(sectionOrder) !== JSON.stringify(page?.sections.map((s) => s.id))) ||
    hiddenSet.size > 0;

  // Plain derivation, not useMemo: `page` comes from the stable registry, and
  // the React Compiler can't preserve manual memoization keyed on it. It
  // memoizes this for us.
  const groups = (() => {
    if (!page) return [];
    const visible = page.fields.filter((f) => f.type !== "internal");
    const seen: string[] = [];
    for (const f of visible) if (!seen.includes(f.group)) seen.push(f.group);
    return seen.map((g) => ({ group: g, fields: visible.filter((f) => f.group === g) }));
  })();

  // Publish copies the server's draft live, so the server must have the
  // draft on screen first: flush any pending autosave and stop if it fails.
  const publish = async () => {
    setBusy("publish");
    setMsg(null);
    try {
      if (!(await saveNow())) {
        setMsg({ type: "err", text: "Ekki birt: nýjustu breytingarnar vistuðust ekki. Reyndu að vista aftur og birtu svo." });
        return;
      }
      const res = await fetch(`/api/admin/site-content/${pageKey}/publish`, { method: "POST", headers: await authHeaders() });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setPublishedAt(j.published_at);
        setMsg({ type: "ok", text: "Birt! Breytingar eru nú í loftinu." });
      } else setMsg({ type: "err", text: `Ekki tókst að birta: ${errorText(j.error, res.status)}` });
    } catch {
      setMsg({ type: "err", text: "Netvilla – ekki tókst að birta." });
    } finally {
      setBusy(null);
    }
  };

  const translate = async (from: Locale, to: Locale) => {
    setBusy(`tr-${to}`);
    setMsg(null);
    try {
      // The server translates its own copy of the draft: send ours first.
      if (!(await saveNow())) {
        setMsg({ type: "err", text: "Ekki þýtt: nýjustu breytingarnar vistuðust ekki. Reyndu að vista aftur." });
        return;
      }
      const res = await fetch(`/api/admin/site-content/${pageKey}/translate`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ from, to }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        const prev = draftRef.current;
        const next: SiteContentBlob = { is: j.draft.is ?? {}, en: j.draft.en ?? {}, order: j.draft.order ?? prev.order, hidden: j.draft.hidden ?? prev.hidden };
        savedJson.current = JSON.stringify(next); // server already saved it
        draftRef.current = next;
        setDraft(next);
        setSaveState("saved");
        setMsg({ type: "ok", text: `Þýddi ${j.count} reiti → ${to === "en" ? "ensku" : "íslensku"}.` });
      } else {
        setMsg({ type: "err", text: `Þýðing mistókst: ${errorText(j.error, res.status)}` });
      }
    } catch {
      setMsg({ type: "err", text: "Netvilla – þýðing mistókst." });
    } finally {
      setBusy(null);
    }
  };

  // In-app navigation does not fire beforeunload: save first, and ask
  // before leaving if the save fails.
  const leave = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!unsaved) return;
    e.preventDefault();
    if (await saveNow()) { router.push("/admin/website"); return; }
    const ok = await dialog.confirm({
      title: "Fara án þess að vista?",
      body: "Nýjustu breytingarnar á drögunum vistuðust ekki og tapast ef þú ferð.",
      confirmLabel: "Fara samt", cancelLabel: "Vera áfram", tone: "danger",
    });
    if (ok) router.push("/admin/website");
  };

  if (!page) {
    return (
      <div className="p-8">
        <Link href="/admin/website" className="text-sm text-gray-500 hover:text-gray-700">← Vefsíða</Link>
        <p className="mt-3 text-sm text-gray-500">Þessi síða fannst ekki í efnisskránni.</p>
      </div>
    );
  }
  if (loading) return <div className="p-8 text-sm text-gray-500">Hleð…</div>;
  if (loadError) {
    return (
      <div className="p-8">
        <Link href="/admin/website" className="text-sm text-gray-500 hover:text-gray-700">← Vefsíða</Link>
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Ekki tókst að sækja drögin: {loadError}</p>
          <button onClick={() => void load()} className="mt-2 font-semibold underline">Reyna aftur</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <Link href="/admin/website" onClick={leave} className="text-sm text-gray-500 hover:text-gray-700">← Vefsíða</Link>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 mt-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{page.label}</h1>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span aria-live="polite" className="contents">
              {saveState === "pending" && <span>Óvistaðar breytingar…</span>}
              {saveState === "saving" && <span>Vistar…</span>}
              {saveState === "saved" && <span className="text-emerald-600">✓ Vistað (drög)</span>}
              {saveState === "error" && (
                <span className="text-red-600">
                  Vistun mistókst{saveError ? `: ${saveError}` : ""}{" "}
                  <button onClick={() => void saveNow()} className="font-semibold underline">Reyna aftur</button>
                </span>
              )}
            </span>
            {publishedAt && <span>· Síðast birt {new Date(publishedAt).toLocaleString("is-IS")}</span>}
            <a href={`${page.path}?preview=lifelinepreview2026`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:text-emerald-900">Skoða síðuna ↗</a>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => translate("is", "en")} disabled={!!busy} className="py-2 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {busy === "tr-en" ? "Þýði…" : "Þýða → enska"}
            </button>
            <button onClick={() => translate("en", "is")} disabled={!!busy} className="py-2 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {busy === "tr-is" ? "Þýði…" : "Þýða → íslenska"}
            </button>
            <button onClick={publish} disabled={!!busy || saveState === "saving" || saveState === "error"}
              title={saveState === "error" ? "Vistaðu drögin fyrst" : saveState === "saving" ? "Bíð eftir vistun" : undefined}
              className="py-2 px-4 rounded-lg bg-[#10B981] hover:bg-[#047857] text-white text-sm font-semibold disabled:opacity-50">
              {busy === "publish" ? "Birti…" : saveState === "saving" ? "Vistar…" : "Birta"}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg border p-3 text-xs ${msg.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}
      {!isAdmin && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">Þú hefur lesaðgang. Aðeins stjórnendur geta breytt og birt.</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fields */}
        <div className="space-y-6 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
          {/* Section order + visibility */}
          {page.sections.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#047857]">Röð kafla</h2>
              {isCustom && (
                <button onClick={resetOrder} disabled={!isAdmin} className="text-[11px] text-gray-500 hover:text-gray-700 disabled:opacity-50">↺ Sjálfgefin röð</button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mb-3">Færðu kafla upp eða niður eða feldu þá. Bakgrunnur skiptist sjálfkrafa á milli hvíts og grás. Hetjan er alltaf efst.</p>
            <ol className="space-y-1.5">
              {sectionOrder.map((id, i) => {
                const hidden = hiddenSet.has(id);
                return (
                  <li key={id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${hidden ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-gray-50/60"}`}>
                    <span className="w-5 text-[11px] font-semibold text-gray-400">{i + 1}</span>
                    <span className={`flex-1 text-sm ${hidden ? "text-gray-400 line-through" : "text-gray-700"}`}>{sectionLabel(id)}</span>
                    <button onClick={() => toggleHidden(id)} disabled={!isAdmin} title={hidden ? "Sýna" : "Fela"} aria-label={hidden ? `Sýna ${sectionLabel(id)}` : `Fela ${sectionLabel(id)}`} className="rounded-md p-1 text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-25">
                      {hidden ? "🙈" : "👁"}
                    </button>
                    <button onClick={() => moveSection(i, i - 1)} disabled={!isAdmin || i === 0} aria-label="Færa upp" className="rounded-md p-1 text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-25">↑</button>
                    <button onClick={() => moveSection(i, i + 1)} disabled={!isAdmin || i === sectionOrder.length - 1} aria-label="Færa niður" className="rounded-md p-1 text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-25">↓</button>
                  </li>
                );
              })}
            </ol>
          </section>
          )}

          {groups.map((g) => (
            <section key={g.group} className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#047857] mb-3">{g.group}</h2>
              <div className="space-y-4">
                {g.fields.map((f) => (
                  <div key={f.key}>
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {f.label}
                      {f.type === "heading" && <span className="ml-2 font-normal text-gray-400">Notaðu ==orð== til að lita orð grænt</span>}
                    </div>
                    {f.help && <p className="text-[11px] text-gray-400 mb-1.5 -mt-0.5">{f.help}</p>}

                    {f.type === "list" ? (
                      <ListEditor
                        field={f}
                        isStr={draft.is?.[f.key] ?? page.defaultsIs[f.key] ?? ""}
                        enStr={draft.en?.[f.key] ?? page.defaultsEn[f.key] ?? ""}
                        disabled={!isAdmin}
                        onChange={(ni, ne) => setListField(f.key, ni, ne)}
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={draft.is?.[f.key] ?? page.defaultsIs[f.key] ?? (f.options?.[0]?.value ?? "")}
                        disabled={!isAdmin}
                        onChange={(e) => setField("is", f.key, e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-200 outline-none disabled:bg-gray-50 bg-white"
                      >
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : f.type === "image" ? (
                      <ImageUploadCrop
                        value={draft.is?.[f.key] ?? ""}
                        fallback={page.defaultsIs[f.key] ?? ""}
                        aspect={imageAspect(f.key)}
                        disabled={!isAdmin}
                        onChange={(v) => setField("is", f.key, v)}
                      />
                    ) : f.type === "link" ? (
                      <input
                        value={draft.is?.[f.key] ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => setField("is", f.key, e.target.value)}
                        placeholder={page.defaultsIs[f.key] || "https://… eða /slod eða #kafli"}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-200 outline-none disabled:bg-gray-50"
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(["is", "en"] as Locale[]).map((loc) => {
                          const val = draft[loc]?.[f.key] ?? "";
                          const placeholder = loc === "is" ? page.defaultsIs[f.key] : "(þýðing)";
                          return (
                            <label key={loc} className="block">
                              <span className="text-[10px] uppercase tracking-wide text-gray-400">{loc}</span>
                              {f.type === "textarea" ? (
                                <textarea value={val} onChange={(e) => setField(loc, f.key, e.target.value)} disabled={!isAdmin} rows={3} placeholder={placeholder} className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-200 outline-none disabled:bg-gray-50" />
                              ) : (
                                <input value={val} onChange={(e) => setField(loc, f.key, e.target.value)} disabled={!isAdmin} placeholder={placeholder} className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-200 outline-none disabled:bg-gray-50" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p className="text-xs text-gray-400">Íslenskur reitur sem er tómur notar sjálfgefna textann. Enskur reitur sem er tómur sýnir íslenska textann þangað til hann er þýddur.</p>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 self-start">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Forskoðun (drög)</div>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {(["is", "en"] as Locale[]).map((loc) => (
                <button key={loc} onClick={() => setPreviewLocale(loc)} className={`px-2.5 py-1 ${previewLocale === loc ? "bg-[#10B981] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
            <div className="overflow-auto h-full">
              <div style={{ width: "200%", transform: "scale(0.5)", transformOrigin: "top left" }}>
                <Preview pageKey={pageKey} blob={draft} locale={previewLocale} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

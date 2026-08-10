"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyStaffRole } from "@/lib/staff-role";
import HomeView from "@/app/HomeView";
import CoachingView from "@/app/coaching/CoachingView";
import AssessmentView from "@/app/assessment/AssessmentView";
import { getSitePage, resolveContent, resolveSections } from "@/lib/site-content/registry";
import type { Locale, SiteContentBlob, SiteField } from "@/lib/site-content/types";

type SaveState = "idle" | "saving" | "saved" | "error";

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

export default function SiteContentEditor() {
  const params = useParams<{ page: string }>();
  const pageKey = params?.page ?? "home";
  const page = getSitePage(pageKey);

  const [draft, setDraft] = useState<SiteContentBlob>({ is: {}, en: {} });
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<Locale>("is");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipSave = useRef(true);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const role = await getMyStaffRole(user.email);
      setIsAdmin(role === "admin");
    }
    const res = await fetch(`/api/admin/site-content/${pageKey}`, { headers: await authHeaders() });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      const d = (j.content?.draft as SiteContentBlob) ?? {};
      setDraft({ is: d.is ?? {}, en: d.en ?? {}, order: d.order, hidden: d.hidden });
      setPublishedAt(j.content?.published_at ?? null);
    } else {
      setDraft({ is: {}, en: {} });
    }
    skipSave.current = true;
    setLoading(false);
  }, [pageKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Debounced autosave of the draft (admin only).
  useEffect(() => {
    if (loading || !isAdmin) return;
    if (skipSave.current) { skipSave.current = false; return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/site-content/${pageKey}`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ draft }),
      });
      setSaveState(res.ok ? "saved" : "error");
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [draft, loading, isAdmin, pageKey]);

  const setField = (locale: Locale, key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? {}), [key]: value } }));
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

  const publish = async () => {
    setBusy("publish");
    setMsg(null);
    const res = await fetch(`/api/admin/site-content/${pageKey}/publish`, { method: "POST", headers: await authHeaders() });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok && j.ok) {
      setPublishedAt(j.published_at);
      setMsg({ type: "ok", text: "Birt! Breytingar eru nú í loftinu." });
    } else setMsg({ type: "err", text: j.error || "Ekki tókst að birta." });
  };

  const translate = async (from: Locale, to: Locale) => {
    setBusy(`tr-${to}`);
    setMsg(null);
    const res = await fetch(`/api/admin/site-content/${pageKey}/translate`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ from, to }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok && j.ok) {
      skipSave.current = true; // server already saved
      setDraft((prev) => ({ is: j.draft.is ?? {}, en: j.draft.en ?? {}, order: j.draft.order ?? prev.order, hidden: j.draft.hidden ?? prev.hidden }));
      setMsg({ type: "ok", text: `Þýddi ${j.count} reiti → ${to === "en" ? "ensku" : "íslensku"}.` });
    } else {
      setMsg({ type: "err", text: j.error === "mfa_required" ? "Þýðing krefst MFA (tveggja þrepa auðkenningar)." : j.error || "Þýðing mistókst." });
    }
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

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <Link href="/admin/website" className="text-sm text-gray-500 hover:text-gray-700">← Vefsíða</Link>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 mt-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{page.label}</h1>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {saveState === "saving" && <span>Vistar…</span>}
            {saveState === "saved" && <span className="text-emerald-600">✓ Vistað (drög)</span>}
            {saveState === "error" && <span className="text-red-600">Vistun mistókst</span>}
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
            <button onClick={publish} disabled={!!busy} className="py-2 px-4 rounded-lg bg-[#10B981] hover:bg-[#047857] text-white text-sm font-semibold disabled:opacity-50">
              {busy === "publish" ? "Birti…" : "Birta"}
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
                    ) : f.type === "image" || f.type === "link" ? (
                      <input
                        value={draft.is?.[f.key] ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => setField("is", f.key, e.target.value)}
                        placeholder={page.defaultsIs[f.key] || (f.type === "link" ? "https://… eða /slod eða #kafli" : "/mynd.png eða https://…")}
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

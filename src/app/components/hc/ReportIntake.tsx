"use client";

// Step 1 of the nurse's day: drop the report in.
//
// The file is read, the person on it is found (or created), and the
// workspace opens with the values already recorded. The document itself is
// never stored — only the values, after the nurse has looked at them.

import { useRef, useState } from "react";
import { FileUp, Loader2, Send, UserPlus, Check, ShieldAlert } from "lucide-react";
import { hcBtn, hcInput } from "./ui";
import { badgeClass } from "./Badge";
import { INVITE_TEMPLATES, fillName, inviteTemplate } from "@/lib/hc/invite-templates";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** Mirrors ReadMethod in src/lib/hc/report-local.ts. */
type ReadMethod = "local" | "ai-text" | "ai-document" | "needs-consent";

const METHOD_BADGE: Record<ReadMethod, { label: string; title: string; className: string }> = {
  local: { label: "Lesið hjá okkur", title: "Lesið á okkar eigin vél — skráin fór hvergi.", className: "bg-hc-ok-surface text-hc-ok-ink" },
  "ai-text": { label: "AI-lestur á texta", title: "Textinn úr skjalinu var sendur í AI-lestur án kennitölu, netfangs og símanúmers.", className: "bg-hc-warn-surface text-hc-warn-ink" },
  "ai-document": { label: "AI-lestur á skjali", title: "Skjalið sjálft var sent í AI-lestur.", className: "bg-hc-warn-surface text-hc-warn-ink ring-1 ring-hc-warn-ink/40" },
  "needs-consent": { label: "Bíður samþykkis", title: "Skjalið var ekki lesið hér.", className: "bg-hc-sunken-2 text-hc-ink-2" },
};

interface Identity { name: string | null; kennitala: string | null; kennitala_last4: string | null; sex?: "m" | "f" | null; email?: string | null; phone?: string | null }
interface Match { client_id: string; full_name: string | null; email: string | null; kennitala_last4: string | null; journey_id: string | null; confident: boolean }
interface Value { slug: string | null; code: string; label: string; value: number; unit: string; confidence: "high" | "medium" | "low"; converted_from?: string }

export default function ReportIntake({ api, onOpen, narrow = false, expanded = false }: {
  api: Api;
  /**
   * Rendered in a narrow column rather than across a page.
   *
   * Tailwind's sm: cannot answer this — it reads the viewport, and the
   * workstation puts this in a 340px aside on a wide screen. The caller
   * knows how much room it gave.
   */
  narrow?: boolean;
  /** Invite form open from the start — for the Skjólstæðingar section,
      where adding somebody is the reason you are looking at it. */
  expanded?: boolean;
  /** Open the client's workspace once the report has landed. */
  onOpen: (journeyId: string) => void;
}) {
  const [over, setOver] = useState(false);
  /* The invite half. Separate state from the dropzone's, because the two
     paths fail differently and a shared `msg` would show a parse error
     under an invite form. */
  const [invite, setInvite] = useState(expanded);
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iPhone, setIPhone] = useState("");
  const [iTpl, setITpl] = useState(INVITE_TEMPLATES[0].key);
  const [iSms, setISms] = useState(false);
  const [iBusy, setIBusy] = useState(false);
  const [iMsg, setIMsg] = useState("");

  const sendInvite = async () => {
    setIBusy(true); setIMsg("");
    const r = await api("/api/vinnustod/invite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: iName.trim(), email: iEmail.trim(), phone: iPhone.trim() || undefined,
        template: iTpl,
        channels: iSms && iPhone.trim() ? ["email", "sms"] : ["email"],
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setIBusy(false);
    if (!r?.ok) { setIMsg(j.error || "Tókst ekki að senda boð."); return; }
    /* What actually left, not what was asked for: a phone number with no
       Twilio behind it would otherwise look like a text that was sent. */
    const bits: string[] = [];
    if (j.sent?.includes("email")) bits.push("tölvupósti");
    if (j.sent?.includes("sms")) bits.push("SMS");
    setIMsg(bits.length
      ? `Boð sent í ${bits.join(" og ")}.`
      : iPhone.trim() && !j.smsConfigured
        ? "Aðgangur stofnaður, en SMS er ekki uppsett — boðið fór ekki út."
        : "Aðgangur stofnaður, en boðið fór ekki út.");
    if (bits.length) { setIName(""); setIEmail(""); setIPhone(""); }
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<{ method?: ReadMethod; identity: Identity; report: { date_iso: string | null }; grunnheilsa?: unknown; values: Value[]; warnings: string[]; matches: Match[] } | null>(null);
  const [take, setTake] = useState<Record<number, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", kennitala: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const read = async (files: FileList | File[], allowAi = false) => {
    const list = Array.from(files).slice(0, 8);
    setBusy(true); setMsg(""); setResult(null);
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    if (allowAi) fd.append("allow_ai", "true");
    const r = await api("/api/vinnustod/intake", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Lesturinn mistókst."); return; }
    // Held only so the nurse can agree to send them; never written anywhere.
    setPending(list);
    setResult(j);
    if (j.method === "needs-consent") return;
    setTake(Object.fromEntries((j.values as Value[]).map((v, i) => [i, v.confidence !== "low"])));
    setForm({
      full_name: j.identity?.name ?? "",
      email: j.identity?.email ?? "",
      phone: j.identity?.phone ?? "",
      kennitala: j.identity?.kennitala ?? "",
    });
    setCreating(!j.matches?.length);
  };

  const commit = async (clientId: string | null) => {
    if (!result) return;
    setBusy(true); setMsg("");
    const values = result.values.filter((_, i) => take[i]).map((v) => ({
      marker: v.slug ?? `x:${v.code}`, value: v.value, unit: v.unit, note: v.slug ? null : v.label,
    }));
    const r = await api("/api/vinnustod/intake/commit", {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        create: clientId ? undefined : form,
        values,
        measured_at: result.report?.date_iso ?? null,
        grunnheilsa: result.grunnheilsa ?? null,
        method: result.method ?? "local",
        sex: result.identity?.sex ?? null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tókst ekki að opna skjólstæðing."); return; }
    setResult(null);
    onOpen(j.journey_id);
  };

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) void read(e.dataTransfer.files); }}
      className={`rounded-hc-hero border-2 border-dashed p-5 transition ${over ? "border-hc-brand-dark bg-hc-ok-surface" : "border-hc-control bg-hc-surface"}`}
    >
      {/* Stacked or in a row, decided by the caller.
          My first attempt used sm:, which reads the viewport — and the
          workstation renders this in a 340px aside on a 1280px screen, so
          every sm: rule applied and nothing stacked. The screenshot showed
          the body text wrapping to ten lines in the strip between the icon
          and the button. A container query would do it; a prop is certain,
          and the caller is the only thing that knows how much room it
          gave. */}
      {/* The card is "new client", and the report is one of two ways in.
          It read as a file dropper that happened to create people, so the
          only way to take somebody on was to already have their report —
          fine when the report arrived first, useless after a phone call. */}
      {!result && (
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
          Nýr skjólstæðingur
        </h2>
      )}

      {!result && (
        <div className={narrow
          ? "flex flex-col gap-3"
          : "flex flex-wrap items-center gap-4"}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-hc-element bg-hc-ok-surface text-hc-ok-ink">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
          </span>
          <div className={narrow ? "min-w-0" : "min-w-0 flex-1"}>
            <p className="font-bold text-hc-ink">{busy ? "Les skýrsluna…" : "Dragðu heilsufarsskýrslu hingað"}</p>
            <p className="text-sm text-hc-ink-2">
              PDF frá Medalia, blóðprufusvar eða myndir af þeim. Við finnum skjólstæðinginn — eða stofnum hann — og opnum vinnusvæðið hans.
            </p>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) void read(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className={`${hcBtn.primary} ${narrow ? "w-full" : ""}`}>
            Velja skrá
          </button>
        </div>
      )}

      {/* The other door. Collapsed by default so the card still reads as
          one thing: dropping a report is the common case and should not
          have to share the first screen with a form. */}
      {!result && (
        <div className="mt-4 border-t border-hc-hairline pt-3">
          {!invite ? (
            <button type="button" onClick={() => setInvite(true)}
              className={`${hcBtn.ghost} w-full`}>
              <UserPlus className="h-4 w-4" aria-hidden /> Bjóða skjólstæðingi — engin skýrsla enn
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-hc-ink">Bjóða skjólstæðingi</p>
              <input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Nafn"
                aria-label="Nafn" className={hcInput} />
              <input value={iEmail} onChange={(e) => setIEmail(e.target.value)} placeholder="Netfang" type="email"
                aria-label="Netfang" className={hcInput} />
              <input value={iPhone} onChange={(e) => setIPhone(e.target.value)} placeholder="Símanúmer (valfrjálst)" type="tel"
                aria-label="Símanúmer" className={hcInput} />

              {/* The message is chosen, not written.
                  The same first contact should read the same way every
                  time, and SMS to Icelandic numbers is filtered on content
                  as well as sender — free text is what gets caught, and a
                  filtered message looks delivered until the carrier says
                  otherwise. */}
              <label className="block text-xs font-semibold text-hc-ink-2">Skilaboð
                <select value={iTpl} onChange={(e) => setITpl(e.target.value)}
                  className={`mt-1 font-normal ${hcInput}`}>
                  {INVITE_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label} — {t.hint}</option>)}
                </select>
              </label>

              {/* Shown, not described: a coach about to send something to a
                  stranger should be able to read it first. */}
              <p className="rounded-hc-element bg-hc-sunken px-3 py-2 text-xs leading-snug text-hc-ink-2">
                {inviteTemplate(iTpl).email}
              </p>

              <label className="flex items-start gap-2 text-sm text-hc-ink">
                <input type="checkbox" checked={iSms} onChange={(e) => setISms(e.target.checked)}
                  disabled={!iPhone.trim()} className="mt-0.5 h-5 w-5 rounded border-hc-control accent-hc-brand-dark disabled:opacity-40" />
                <span>
                  Senda líka í SMS
                  {iSms && iPhone.trim() && (
                    <span className="mt-1 block rounded-lg bg-hc-sunken px-2 py-1 font-mono text-[11px] text-hc-ink-2">
                      {fillName(inviteTemplate(iTpl).sms, iName)} …
                    </span>
                  )}
                </span>
              </label>

              <p className="text-xs text-hc-ink-3">
                Netfang þarf til að búa til aðgang.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void sendInvite()} disabled={iBusy || !iName.trim() || !iEmail.trim()}
                  className={`${hcBtn.primary} flex-1`}>
                  {iBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                  Senda boð
                </button>
                <button type="button" onClick={() => { setInvite(false); setIMsg(""); }}
                  className={hcBtn.ghost}>
                  Hætta við
                </button>
              </div>
              {iMsg && <p className="text-sm text-hc-ink-2">{iMsg}</p>}
            </div>
          )}
        </div>
      )}

      {msg && <p role="alert" className="mt-2 text-sm text-hc-bad-ink">{msg}</p>}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-hc-ink">
              {result.identity.name || "Nafn fannst ekki í skýrslunni"}
              {result.identity.kennitala_last4 && <span className="ml-2 font-normal text-hc-ink-2">···{result.identity.kennitala_last4}</span>}
            </p>
            <span className={badgeClass("neutral", "md")}>
              {result.values.length} gildi{result.report?.date_iso ? ` · ${result.report.date_iso}` : ""}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold leading-none ${METHOD_BADGE[result.method ?? "local"].className}`}
              title={METHOD_BADGE[result.method ?? "local"].title}>
              {METHOD_BADGE[result.method ?? "local"].label}
            </span>
            <span className="flex-1" />
            <button type="button" onClick={() => setResult(null)} className={hcBtn.ghost}>Hætta við</button>
          </div>

          {result.method === "needs-consent" && (
            <div className="rounded-hc-card bg-hc-warn-surface p-4 ring-1 ring-hc-warn-ink/30">
              <p className="flex items-center gap-2 font-bold text-hc-warn-ink">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden /> Við gátum ekki lesið þetta skjal hér
              </p>
              {result.warnings.map((w, i) => (
                <p key={i} className="mt-1 text-sm leading-relaxed text-hc-warn-ink">{w}</p>
              ))}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" disabled={busy || !pending.length} onClick={() => void read(pending, true)}
                  /* amber-900 on purpose: sending a document out is a
                     different act from every brand-coloured button, and
                     white on it is 10:1 in either theme. */
                  className={`${hcBtn.base} bg-amber-900 text-white hover:bg-amber-800`}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Senda í AI-lestur
                </button>
                <button type="button" onClick={() => { setResult(null); setPending([]); }}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-hc-warn-ink hover:underline">Nei, ég skrái gildin sjálf</button>
              </div>
            </div>
          )}

          {/* Who is this? */}
          {result.matches.length > 0 && !creating && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-3">Er þetta sami skjólstæðingur?</p>
              <ul className="space-y-1.5">
                {result.matches.map((m) => (
                  <li key={m.client_id} className="flex flex-wrap items-center gap-3 rounded-hc-element border border-hc-border p-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-hc-ink">
                        {m.full_name}
                        {m.confident && <span className={`ml-2 ${badgeClass("ok")}`}>kennitala stemmir</span>}
                      </span>
                      <span className="block text-xs text-hc-ink-2">
                        {[m.email, m.kennitala_last4 ? `···${m.kennitala_last4}` : null, m.journey_id ? "á heilsuferð í gangi" : "engin heilsuferð"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <button type="button" onClick={() => commit(m.client_id)} disabled={busy}
                      className={hcBtn.primary}>
                      <Check className="h-4 w-4" aria-hidden /> Já, opna
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setCreating(true)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-hc-ink-2 hover:underline">
                <UserPlus className="h-4 w-4" aria-hidden /> Enginn þeirra — stofna nýjan
              </button>
            </div>
          )}

          {creating && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-3">Nýr skjólstæðingur</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-hc-ink-2">Nafn</span>
                  <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className={`mt-0.5 ${hcInput}`} />
                </label>
                <label className="text-sm">
                  <span className="text-hc-ink-2">Netfang</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="nafn@daemi.is" className={`mt-0.5 ${hcInput}`} />
                </label>
                <label className="text-sm">
                  <span className="text-hc-ink-2">Kennitala</span>
                  <input value={form.kennitala} onChange={(e) => setForm({ ...form, kennitala: e.target.value })}
                    inputMode="numeric" className={`mt-0.5 ${hcInput}`} />
                </label>
                <label className="text-sm">
                  <span className="text-hc-ink-2">Sími</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    inputMode="tel" className={`mt-0.5 ${hcInput}`} />
                </label>
              </div>
              <p className="mt-1 text-xs text-hc-ink-2">Skjólstæðingurinn fær boð í tölvupósti og kemst þá inn á aðganginn sinn.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => commit(null)} disabled={busy || !form.full_name.trim() || !form.email.trim()}
                  className={hcBtn.primary}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />} Stofna og opna vinnusvæði
                </button>
                {result.matches.length > 0 && (
                  <button type="button" onClick={() => setCreating(false)} className={hcBtn.ghost}>Til baka í leitarniðurstöður</button>
                )}
              </div>
            </div>
          )}

          {/* The values we are about to keep */}
          {result.values.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-3">Gildi úr skýrslunni</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {result.values.map((v, i) => (
                <li key={`${v.code}-${i}`}>
                  {/* The whole row is the hit area, not the 16px box. */}
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm ring-1 ring-hc-hairline hover:bg-hc-sunken">
                  <input type="checkbox" checked={!!take[i]} onChange={(e) => setTake({ ...take, [i]: e.target.checked })}
                    aria-label={`Vista ${v.label}`} className="h-4 w-4 accent-hc-brand-dark" />
                  <span className="min-w-0 flex-1 truncate text-hc-ink-2">{v.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-hc-ink">
                    {String(v.value).replace(".", ",")}{v.unit ? ` ${v.unit}` : ""}
                  </span>
                  {v.confidence !== "high" && <span className="shrink-0 text-[11px] text-hc-warn-ink" title="Óvíst gildi">?</span>}
                  </label>
                </li>
              ))}
            </ul>
            {result.warnings.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-hc-warn-ink">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
          )}
        </div>
      )}
    </section>
  );
}

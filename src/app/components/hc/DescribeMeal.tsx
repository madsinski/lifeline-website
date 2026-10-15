"use client";

// "I ate whatever the canteen had."
//
// The plan says grilled chicken and quinoa; work says lasagne. Before this
// the only options were to tick a meal you did not eat — which writes a
// wrong number into the diary — or log nothing, which writes none. So:
// describe it, get an estimate, correct it if it is off, and log it against
// the slot it replaced.
//
// The estimate is an ESTIMATE and the screen says so. It comes from a model
// reading a sentence, not from weighing anything, and the numbers are
// roundable by hand before they are saved for exactly that reason.
//
// ── Voice ──────────────────────────────────────────────────────────────
//
// The iOS app has a mic button that says "coming soon"; there was nothing to
// port. This uses the browser's own SpeechRecognition, which means the
// transcript arrives as text and no audio ever reaches Lifeline — we never
// receive, store or forward a recording. Where the browser has no such API
// the button simply is not there, and typing still works.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Square, Utensils } from "lucide-react";
import { SLOT_IS, type MealSlot } from "@/lib/hc/meals";
import { useDayMeals } from "./useDayMeals";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Macros { kcal: number; protein: number; carbs: number; fat: number }

/* The vendor-prefixed shape Safari still uses. Typed narrowly rather than
   pulled from lib.dom, which does not have it in this TS version. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function recogniser(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    (new () => SpeechRecognitionLike) | undefined;
  if (!Ctor) return null;
  const r = new Ctor();
  /* Icelandic first. Recognition quality varies by browser and some will
     fall back to the device locale on their own; the transcript is editable
     either way, so a mis-hearing costs a correction and not a wrong log. */
  r.lang = "is-IS";
  r.continuous = false;
  r.interimResults = false;
  return r;
}

export default function DescribeMeal({ api, slot, onLogged, onClose }: {
  api: Api;
  /** Which planned meal this replaces. One row per slot per day. */
  slot: MealSlot;
  onLogged?: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [macros, setMacros] = useState<Macros | null>(null);
  /** The numbers on screen came from the model, not from an empty fallback. */
  const [estimated, setEstimated] = useState(false);
  /** An estimate was made and then the text changed under it. */
  const [stale, setStale] = useState(false);
  const { logDescribed } = useDayMeals();
  /*
   * Editing the description after an estimate throws the estimate away.
   * The numbers described the old sentence; saving them against the new
   * one would log "lasagne" with the macros of "salat".
   */
  const changeText = (next: string | ((prev: string) => string)) => {
    setText(next);
    if (macros) { setMacros(null); setEstimated(false); setStale(true); }
  };
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canHear, setCanHear] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  /* Checked on the client only: whether this browser has the API is not
     something the server can know, and rendering a mic that does nothing is
     worse than rendering none. Deferred a tick, as the other screens here
     do it — the compiler lint rejects a setState reached synchronously from
     an effect. */
  useEffect(() => {
    const t = setTimeout(() => setCanHear(!!recogniser()), 0);
    return () => clearTimeout(t);
  }, []);

  const listen = useCallback(() => {
    if (listening) { recRef.current?.stop(); return; }
    const r = recogniser();
    if (!r) return;
    recRef.current = r;
    r.onresult = (e) => {
      const said = Array.from({ length: e.results.length }, (_, i) => e.results[i]?.[0]?.transcript ?? "").join(" ").trim();
      /* Appended, not replaced: somebody adding "og epli" to what they
         already typed should keep the typing. */
      if (said) changeText((prev) => (prev ? `${prev} ${said}` : said));
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- changeText only reads macros to decide whether to clear them
  }, [listening, macros]);

  const estimate = async () => {
    if (text.trim().length < 3) return;
    setBusy("parse"); setErr(null); setMacros(null); setEstimated(false); setStale(false);
    const r = await api("/api/hc/meal-parse", {
      method: "POST", body: JSON.stringify({ description: text.trim() }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    if (!r?.ok) {
      setErr(j.error === "too_many" ? "Of margar tilraunir í röð. Reyndu aftur um stund."
        : j.error === "too_short" ? "Segðu dálítið meira um máltíðina."
        : "Við gátum ekki áætlað þessa máltíð. Þú getur slegið töluna inn sjálf(ur).");
      /* Open the fields empty so the honest path forward is visible rather
         than described. */
      setMacros({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
      return;
    }
    setMacros(j.macros);
    setEstimated(true);
  };

  const allZero = !!macros && macros.kcal === 0 && macros.protein === 0 && macros.carbs === 0 && macros.fat === 0;
  const save = async () => {
    if (!macros || (allZero && !estimated)) return;
    setBusy("save"); setErr(null);
    /* One row per slot per day: the described lunch replaces the planned
       one rather than sitting beside it and double-counting the day. The
       shared day-meals state inserts first and removes the old row only
       once the new one is in, and toasts if it fails. */
    const ok = await logDescribed(slot, text, macros);
    setBusy(null);
    if (!ok) { setErr("Vistaðist ekki – reyndu aftur."); return; }
    onLogged?.();
    onClose();
  };

  const field = (k: keyof Macros, label: string, unit: string) => (
    <label className="flex-1 text-sm">
      <span className="font-medium text-hc-ink-2">{label}</span>
      <span className="mt-1 flex items-center gap-1 rounded-lg border border-slate-300 bg-hc-surface px-2">
        <input type="number" inputMode="numeric" min={0} value={macros?.[k] ?? 0}
          onChange={(e) => setMacros((m) => (m ? { ...m, [k]: Math.max(0, Number(e.target.value) || 0) } : m))}
          className="w-full py-2 text-hc-ink outline-none" />
        <span className="shrink-0 text-xs text-hc-ink-2">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-3 p-3">
      <p className="text-sm text-hc-ink-2">
        Skrifaðu hvað þú borðaðir — eða talaðu það inn — og við áætlum næringuna.
        Þetta kemur í staðinn fyrir <strong>{SLOT_IS[slot].toLowerCase()}</strong> í dag.
      </p>

      <div className="relative">
        <textarea value={text} onChange={(e) => changeText(e.target.value)} rows={3}
          placeholder="T.d. kjúklingabringa með hrísgrjónum og salati úr mötuneytinu"
          className="w-full rounded-2xl border border-slate-300 p-3 pr-12 text-hc-ink outline-none focus:ring-2 focus:ring-lime-600" />
        {canHear && (
          <button type="button" onClick={listen}
            aria-label={listening ? "Stoppa upptöku" : "Talaðu máltíðina inn"}
            aria-pressed={listening}
            className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full transition ${
              listening ? "animate-pulse bg-rose-600 text-white" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-slate-200"}`}>
            {listening ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
      {listening && <p className="text-xs text-hc-ink-2">Hlusta… talaðu máltíðina og ýttu svo á stopp.</p>}

      {!macros ? (
        <button type="button" onClick={() => void estimate()}
          disabled={text.trim().length < 3 || busy === "parse"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-700 px-4 py-3 font-bold text-white disabled:opacity-50">
          {busy === "parse" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Utensils className="h-5 w-5" aria-hidden />}
          {stale ? "Áætla aftur" : "Áætla næringu"}
        </button>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {field("kcal", "Orka", "kkal")}
            {field("protein", "Prótein", "g")}
          </div>
          <div className="flex flex-wrap gap-2">
            {field("carbs", "Kolvetni", "g")}
            {field("fat", "Fita", "g")}
          </div>
          {/* Said plainly, every time, because it is the whole caveat: a
              sentence read by a model is not a weighed plate. */}
          <p className="text-xs text-hc-ink-2">
            Þetta er áætlun út frá textanum, ekki mæling. Breyttu tölunum ef þú veist betur.
          </p>
          {allZero && !estimated && (
            <p className="text-xs text-hc-ink-2">Sláðu inn að minnsta kosti eina tölu til að skrá máltíðina.</p>
          )}
          <button type="button" onClick={() => void save()} disabled={busy === "save" || (allZero && !estimated)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-hc-brand-dark px-4 py-3 font-bold text-white disabled:opacity-50">
            {busy === "save" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Check className="h-5 w-5" aria-hidden />}
            Skrá máltíðina
          </button>
        </>
      )}

      {err && <p className="text-sm text-hc-bad-ink">{err}</p>}
    </div>
  );
}

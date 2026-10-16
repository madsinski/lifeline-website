"use client";

// The workstation's frame: who is signed in, the queue, which screen is
// showing, and keeping that in the URL.
//
//   ?t=today|clients|calendar|teaching|settings        the home side
//   ?p=<journey>&tab=status|report|plan|preview        a client's workspace
//              &sheet=interview|referral|orders|messages|history
//              &focus=chat                             land in the thread
//
// Old links keep working: ?m=1 opens the messages sheet, ?t=messages lands
// on Í dag (the inbox lives there now), ?s= is ignored.

import { useCallback, useEffect, useRef, useState } from "react";
import CalendarConnect, { type CalendarApi } from "@/app/components/hc/CalendarConnect";
import KnowledgeSearch, { useKnowledgeHotkey } from "@/app/components/hc/KnowledgeSearch";
import ProgramsLibrary from "@/app/components/hc/ProgramsLibrary";
import TeachingLibrary from "@/app/components/hc/TeachingLibrary";
import WsHeader, { type WsMenuItem } from "@/app/components/hc/WsHeader";
import WsSettings from "@/app/components/hc/WsSettings";
import { hcPage, hcTabs } from "@/app/components/hc/ui";
import { cookieApi, useWsApi, WS_SESSION_EXPIRED, type WsApi } from "@/app/components/hc/ws-api";
import { Alert, DialogProvider, useDialog } from "@/app/components/account/ui";
import { ToastProvider, useToast } from "@/app/components/hc/Toast";
import { cleanName, wsBtn } from "./format";
import { CalendarTab, ClientsTab, TodayView } from "./Home";
import { useInbox } from "./inbox";
import { Login, PinModal } from "./Login";
import { PatientView } from "./patient/PatientView";
import { HOME_TABS, SHEETS, WS_TABS, type HomeTab, type Me, type OpenClient, type PatientNav, type Row, type View } from "./tasks";
import { Kicker, Shimmer } from "./ui";

// The login and PIN screens only exist in the standalone workstation, so
// sign-out always talks over the nurse's own cookie session.
const ws = cookieApi;

/** Lifeline staff (/admin/vinnustod): same calendar, Bearer auth, so Google consent starts with a POST. */
const staffCalendar = (api: WsApi, fail: (message: string) => void): CalendarApi => ({
  call: api,
  googleStatusUrl: "/api/vinnustod/google",
  startGoogle: async () => {
    const r = await api("/api/vinnustod/google/start", { method: "POST" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (j.url) window.location.href = j.url; else fail(j.error || "Ekki tókst að tengja Google.");
  },
  icsTokenUrl: "/api/vinnustod/calendar-token",
  subscriptionName: "Lifeline — viðtöl",
});

const WORKER_CALENDAR: CalendarApi = {
  call: ws,
  googleStatusUrl: "/api/vinnustod/google",
  startGoogle: async () => { window.location.href = "/api/vinnustod/google/start"; },
  icsTokenUrl: "/api/vinnustod/calendar-token",
  subscriptionName: "Lifeline — viðtöl",
};

const SESSION_EXPIRED = WS_SESSION_EXPIRED;

// ── Root ────────────────────────────────────────────────────────────────────

/**
 * The workstation itself. In "worker" mode it owns sign-in (the partner
 * nurse's own session); in "staff" mode the admin layout has already
 * authenticated, so there is nothing to sign into and no PIN to set.
 */
export function WorkstationApp({ mode }: { mode: "worker" | "staff" }) {
  return (
    /* One toast for every save in the workstation, so a save that worked
       says so and one that failed says that too (hc/Toast). Mounted here,
       not in the route, so /admin/vinnustod gets it as well. */
    <ToastProvider>
      <DialogProvider>
        <Root mode={mode} />
      </DialogProvider>
    </ToastProvider>
  );
}

function Root({ mode }: { mode: "worker" | "staff" }) {
  const api = useWsApi();
  const [me, setMe] = useState<Me | null | "error" | undefined>(undefined);
  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/me").catch(() => null);
    // Only "not signed in" means sign in. Anything else — a 500, a dropped
    // connection — is an error to retry, not a reason to show a login form
    // to somebody who is signed in.
    const next: Me | null | "error" = !r ? "error" : r.ok ? (await r.json().catch(() => ({}))).me ?? null : r.status === 401 || r.status === 403 ? null : "error";
    setTimeout(() => setMe(next), 0);
  }, [api]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  if (me === undefined) return <div className="mx-auto max-w-6xl px-4 py-10"><Shimmer rows={4} label="Hleð vinnustöðinni" /></div>;
  if (me === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Alert tone="bad" title="Náði ekki sambandi við vinnustöðina"
          actions={<button type="button" className={wsBtn.secondary} onClick={() => { setMe(undefined); void load(); }}>Reyna aftur</button>}>
          Athugaðu netsambandið. Ef þetta heldur áfram er villan hjá okkur.
        </Alert>
      </div>
    );
  }
  if (me === null) {
    return mode === "worker" ? <Login onDone={() => void load()} /> : (
      <div className="p-10 text-center text-hc-ink-2">
        Coaching er opið starfsfólki Lifeline með tveggja þátta staðfestingu.
      </div>
    );
  }
  return <Workstation me={me} mode={mode} onLogout={() => setMe(null)} onPinSet={() => void load()} />;
}

// ── URL ↔ view ──────────────────────────────────────────────────────────────

const pick = <T extends string>(list: readonly T[], v: string | null): T | undefined =>
  v && (list as readonly string[]).includes(v) ? (v as T) : undefined;

function readView(): View {
  if (typeof window === "undefined") return { home: "today" };
  const q = new URLSearchParams(window.location.search);
  const p = q.get("p");
  if (p) {
    return {
      patient: p,
      tab: pick(WS_TABS, q.get("tab")),
      // ?m=1 predates the sheet: it meant "open the message composer".
      sheet: pick(SHEETS, q.get("sheet")) ?? (q.get("m") === "1" ? "messages" : undefined),
      focus: q.get("focus") === "chat" ? "chat" : q.get("focus") === "requests" ? "requests" : undefined,
    };
  }
  const t = q.get("t");
  // Old tabs: the inbox is part of Í dag now.
  const legacy: Record<string, HomeTab> = { messages: "today" };
  return { home: pick(HOME_TABS, t) ?? legacy[t ?? ""] ?? "today" };
}

function viewUrl(v: View): URL {
  const u = new URL(window.location.href);
  for (const k of ["p", "s", "m", "t", "tab", "sheet", "focus"]) u.searchParams.delete(k);
  if ("patient" in v) {
    u.searchParams.set("p", v.patient);
    if (v.tab && v.tab !== "status") u.searchParams.set("tab", v.tab);
    if (v.sheet) u.searchParams.set("sheet", v.sheet);
    if (v.focus) u.searchParams.set("focus", v.focus);
  } else if (v.home !== "today") {
    u.searchParams.set("t", v.home);
  }
  return u;
}

// ── Shell ───────────────────────────────────────────────────────────────────

const HOME_LABEL: Record<HomeTab, string> = {
  today: "Í dag", clients: "Skjólstæðingar", calendar: "Dagatal", teaching: "Prógrömm", settings: "Stillingar",
};

function Workstation({ me, mode, onLogout, onPinSet }: { me: Me; mode: "worker" | "staff"; onLogout: () => void; onPinSet: () => void }) {
  const api = useWsApi();
  const dialog = useDialog();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [expired, setExpired] = useState(false);
  const [view, setViewState] = useState<View>(readView);
  const viewRef = useRef(view);
  const [showPin, setShowPin] = useState(false);
  const [showBook, setShowBook] = useState(false);
  // Back from Google (?google=connected or any error code) or a "connect your
  // calendar" link (?cal=…): open the calendar dialog on arrival.
  const [showCal, setShowCal] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.has("google") || q.has("cal");
  });

  /* …and take them out of the address bar once read. CalendarConnect reads
     ?google= while rendering, so this runs after it has; left in place, a
     reload or a bookmark reopened the dialog every time. */
  useEffect(() => {
    const u = new URL(window.location.href);
    if (!u.searchParams.has("google") && !u.searchParams.has("cal")) return;
    u.searchParams.delete("google"); u.searchParams.delete("cal");
    window.history.replaceState(window.history.state, "", u);
  }, []);

  /*
   * Navigation. A new screen is a history entry; moving between a client's
   * tabs and sheets replaces the current one, so Back leaves the client
   * rather than stepping through every tab clicked.
   *
   * The scroll position rides on the entry being left, and Back restores
   * it: returning to Í dag from a client used to land at the top of the
   * list you were halfway down.
   */
  const setView = useCallback((v: View, replace = false) => {
    viewRef.current = v;
    setViewState(v);
    const u = viewUrl(v);
    if (replace) {
      window.history.replaceState(window.history.state, "", u);
    } else {
      window.history.replaceState({ ...(window.history.state ?? {}), wsY: window.scrollY }, "");
      window.history.pushState({}, "", u);
      window.scrollTo({ top: 0 });
    }
  }, []);
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const onPop = (e: PopStateEvent) => {
      const v = readView();
      viewRef.current = v;
      setViewState(v);
      const y = Number(e.state?.wsY ?? 0);
      // Twice: once when the frame paints, once after the lists below the
      // fold have had a moment to arrive and give the page its height back.
      requestAnimationFrame(() => window.scrollTo({ top: y }));
      setTimeout(() => window.scrollTo({ top: y }), 350);
    };
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); window.history.scrollRestoration = prev; };
  }, []);

  const open: OpenClient = useCallback((id, nav) => setView({ patient: id, ...(nav ?? {}) }), [setView]);
  const onNav = useCallback((patch: PatientNav) => {
    const cur = viewRef.current;
    if (!("patient" in cur)) return;
    setView({ ...cur, ...patch }, true);
  }, [setView]);

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/queue").catch(() => null);
    if (r?.status === 401) { window.dispatchEvent(new Event(SESSION_EXPIRED)); return; }
    if (!r?.ok) { setTimeout(() => setLoadErr(true), 0); return; }
    const j = await r.json().catch(() => null);
    if (!j) { setTimeout(() => setLoadErr(true), 0); return; }
    setTimeout(() => { setLoadErr(false); setRows(j.journeys ?? []); }, 0);
  }, [api]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  /*
   * The session ran out mid-work. ws-api announces it on any 401; the
   * sign-in opens OVER the workstation instead of replacing it, so the
   * client, the tab and a half-written interview are all still there
   * after the PIN.
   */
  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, []);

  const inbox = useInbox(api);
  const toast = useToast();
  /* On a shared station a sign-out that did not reach the server leaves the
     session open behind a login screen. Say so instead of pretending. */
  const logout = async () => {
    const r = await ws("/api/vinnustod/auth/logout", { method: "POST" }).catch(() => null);
    if (!r?.ok) { toast.show("Útskráning tókst ekki. Athugaðu netið og reyndu aftur.", { tone: "bad" }); return; }
    onLogout();
  };
  useKnowledgeHotkey(() => setShowBook(true));

  const menu: WsMenuItem[] = [
    { label: "Fletta upp", icon: "book", hint: "⌘K", onClick: () => setShowBook(true) },
    /* Calendar, PIN and sign-out live on Stillingar; sign-out stays here
       too, because it is the one thing somebody needs in a hurry. */
    ...(mode === "worker" ? [
      { label: "Útskrá", icon: "logout" as const, onClick: () => void logout() },
    ] : []),
  ];

  const home = "home" in view ? view.home : null;

  return (
    /* hc-ws-scope: dark mode is a workstation setting, so the dark tokens
       apply inside this subtree and nowhere else. */
    <div className={`hc-ws-scope ${hcPage.staff}`}>
      <WsHeader name={me.name} role={me.role === "doctor" ? "læknir" : me.role === "admin" ? "stjórnandi" : "hjúkrunarfræðingur"} items={menu} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {loadErr && rows !== null && (
          <Alert tone="warn" compact className="mb-4" actions={<button type="button" className={wsBtn.secondary} onClick={() => void load()}>Reyna aftur</button>}>
            Listinn uppfærðist ekki. Það sem þú sérð gæti verið gamalt.
          </Alert>
        )}
        {"patient" in view ? (
          <PatientView key={view.patient} id={view.patient} nav={view} onNav={onNav} me={me}
            onBack={() => (window.history.length > 1 ? window.history.back() : setView({ home: "today" }))}
            onChanged={() => void load()} onRead={() => void inbox.reload()} />
        ) : (
          <div className="space-y-4">
            <nav className={hcTabs.bar} aria-label="Vinnustöðin">
              {HOME_TABS.map((k) => (
                <button key={k} type="button" onClick={() => setView({ home: k })}
                  aria-current={home === k ? "page" : undefined}
                  className={`relative min-h-11 ${hcTabs.tab(home === k)}`}>
                  {HOME_LABEL[k]}
                  {/* Somebody is waiting on an answer. Pulses so it is seen
                      from across a room; carries the count, because three
                      people waiting is a different morning from one. */}
                  {k === "today" && inbox.waiting > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center">
                      <span className="absolute inset-0 animate-hc-ping rounded-full bg-red-500/40 motion-reduce:hidden" aria-hidden />
                      <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-red-700 px-1 text-[11px] font-bold text-white">
                        {inbox.waiting > 9 ? "9+" : inbox.waiting}
                        <span className="sr-only"> bíða svars</span>
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {home === "settings" ? (
              <WsSettings me={me} mode={mode} onPin={() => setShowPin(true)} onCalendar={() => setShowCal(true)} onLogout={() => void logout()} />
            ) : home === "calendar" ? (
              <CalendarTab onOpen={open} />
            ) : rows === null ? (
              loadErr
                ? <Alert tone="bad" title="Náði ekki í skjólstæðingalistann"
                    actions={<button type="button" className={wsBtn.secondary} onClick={() => void load()}>Reyna aftur</button>}>
                    Athugaðu netsambandið og reyndu aftur.
                  </Alert>
                : <Shimmer rows={4} label="Hleð listanum" />
            ) : home === "clients" ? (
              <ClientsTab rows={rows} onOpen={open} onReload={() => void load()} />
            ) : home === "teaching" ? (
              <div className="space-y-6">
                {/* Programmes first, teaching second: the programmes are what
                    a coach assembles; the lectures are what she consults. */}
                <section className="space-y-3">
                  <Kicker>Prógrömm</Kicker>
                  <ProgramsLibrary api={api} people={rows.map((r) => ({ id: r.id, name: cleanName(r.client_name) }))} />
                </section>
                <section className="space-y-3">
                  <Kicker>Fræðsluefni</Kicker>
                  <TeachingLibrary api={api} />
                </section>
              </div>
            ) : (
              <TodayView rows={rows} me={me} onOpen={open} inbox={inbox} />
            )}
          </div>
        )}
      </main>

      <KnowledgeSearch api={api} open={showBook} onClose={() => setShowBook(false)} />
      {showPin && <PinModal onClose={() => setShowPin(false)} onDone={() => { setShowPin(false); toast.show("PIN-númerið er vistað."); onPinSet(); }} />}
      <CalendarConnect
        api={mode === "worker" ? WORKER_CALENDAR : staffCalendar(api, (message) => void dialog.alert({ title: "Google-dagatal", body: message }))}
        open={showCal} onClose={() => setShowCal(false)}
        intro="Viðtöl og eftirfylgd sem þér eru úthlutuð birtast í dagatalinu þínu um leið og þau eru bókuð. Aðeins upphafsstafir skjólstæðings koma fram." />

      {expired && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-hc-page" role="dialog" aria-modal="true" aria-labelledby="expired-h">
          <div className="mx-auto max-w-sm px-4 pt-6">
            <Alert tone="info" title={<span id="expired-h">Lotan rann út</span>}>
              {mode === "worker"
                ? "Skráðu þig inn aftur. Þú heldur áfram þar sem frá var horfið."
                : "Skráðu þig aftur inn í stjórnborðinu og ýttu svo á „Endurhlaða“ hér fyrir neðan."}
            </Alert>
            {mode === "staff" && (
              <button type="button" className={`${wsBtn.primary} mt-4 w-full`} onClick={() => window.location.reload()}>Endurhlaða</button>
            )}
          </div>
          {mode === "worker" && <Login onDone={() => { setExpired(false); onPinSet(); void load(); void inbox.reload(); }} />}
        </div>
      )}
    </div>
  );
}

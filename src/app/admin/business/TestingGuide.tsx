"use client";

// Internal tester guide for the B2B (business) onboarding flow. Lives as a
// tab under /admin/business so the team has a single in-app reference for
// walking every screen end-to-end. Pure static content + per-browser
// checklist progress (localStorage) — no data is written server-side.
//
// When the onboarding flow changes (new step, new field, route rename),
// update the relevant <Step>/<Phase> below so this stays the source of
// truth for QA. Keep it scannable: short imperatives, one action per step.

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "business_testing_guide_progress_v1";

function useChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  // Hydrate from localStorage after mount. Deferred a tick so we don't
  // setState synchronously inside the effect (cascading-render lint rule)
  // and so the server-rendered empty state matches first client paint.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        queueMicrotask(() => setDone(parsed));
      }
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback((id: string) => {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setDone({});
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { done, toggle, reset };
}

function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "emerald" | "amber" | "blue" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-600",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Route({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px] font-mono text-gray-700">
      {children}
    </code>
  );
}

interface StepProps {
  id: string;
  done: Record<string, boolean>;
  toggle: (id: string) => void;
  children: React.ReactNode;
}

function Step({ id, done, toggle, children }: StepProps) {
  const checked = !!done[id];
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer group">
      <button
        type="button"
        onClick={() => toggle(id)}
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "bg-white border-gray-300 group-hover:border-emerald-400"
        }`}
        aria-pressed={checked}
      >
        {checked && (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`text-sm leading-relaxed ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
        {children}
      </span>
    </label>
  );
}

interface PhaseProps {
  n: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Phase({ n, title, subtitle, children, defaultOpen = false }: PhaseProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          {subtitle && <span className="block text-xs text-gray-500">{subtitle}</span>}
        </span>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-3 sm:px-5">{children}</div>}
    </div>
  );
}

function Callout({ tone, title, children }: { tone: "amber" | "blue" | "emerald"; title: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };
  return (
    <div className={`rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed ${styles[tone]}`}>
      <p className="font-semibold mb-0.5">{title}</p>
      <div className="opacity-90">{children}</div>
    </div>
  );
}

export default function TestingGuide() {
  const { done, toggle, reset } = useChecklist();

  const total = Object.keys(STEP_IDS).length;
  const completed = STEP_IDS_LIST.filter((id) => done[id]).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="max-w-3xl pb-12">
      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white mb-5">
        <h2 className="text-lg font-bold mb-1">Business onboarding — tester guide</h2>
        <p className="text-sm text-emerald-50 leading-relaxed">
          A walkthrough of the full B2B journey so the team can exercise every screen end-to-end:
          company signup → agreement → roster → scheduling → employee onboarding → admin oversight.
          Tick steps as you go — progress is saved in this browser only.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums">{completed}/{total}</span>
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium text-emerald-100 hover:text-white underline underline-offset-2"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Before you start */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Before you start</h3>
        <ul className="space-y-1.5 text-[13px] text-gray-600 leading-relaxed list-disc pl-4">
          <li>
            Use a <strong>real inbox you control</strong> (e.g. a <code className="font-mono text-[12px]">+test</code> Gmail alias) — signup
            and invites send confirmation emails you must click.
          </li>
          <li>
            Test in an <strong>incognito window</strong> so your admin session doesn&apos;t collide with the company-admin
            and employee sessions. The flow warns you if you&apos;re signed in as the wrong user, but separate windows are cleaner.
          </li>
          <li>
            You&apos;ll need <strong>valid Icelandic kennitölur</strong> (they&apos;re checksum-validated). Use a kennitala generator
            or known test numbers — a random 10 digits will be rejected.
          </li>
          <li>
            There are <strong>two ways a company starts</strong>: it signs up itself (Path A), or Lifeline staff pre-creates it and
            sends a claim link (Path B). Test both.
          </li>
          <li>
            Clean up after a run from <Route>/admin/companies</Route> (archive the test company) so the dashboard stays readable.
          </li>
        </ul>
      </div>

      {/* The two entry paths */}
      <h3 className="text-sm font-bold text-gray-900 mb-2 mt-6">Path A — Company signs itself up</h3>
      <div className="space-y-2.5">
        <Phase n={1} title="Create a company account" subtitle="Public signup + email confirmation" defaultOpen>
          <p className="text-[13px] text-gray-500 mb-2">
            Start at <Route>/business/login?mode=signup</Route> &nbsp;<Pill tone="gray">public</Pill>
          </p>
          <div className="divide-y divide-gray-100">
            <Step id="a1-signup" done={done} toggle={toggle}>
              On the <strong>Create account</strong> tab, enter full name, email, password (+ confirm) and submit.
            </Step>
            <Step id="a1-confirm" done={done} toggle={toggle}>
              Check the inbox and click the <strong>confirmation link</strong>. Confirm you can&apos;t proceed to create a company
              until the email is verified.
            </Step>
            <Step id="a1-login" done={done} toggle={toggle}>
              Sign back in at <Route>/business/login</Route>. Try the <strong>&quot;Forgot your password?&quot;</strong> link too.
            </Step>
          </div>
        </Phase>

        <Phase n={2} title="Accept terms + create the company" subtitle="3-step stepper at /business/signup">
          <div className="divide-y divide-gray-100">
            <Step id="a2-terms" done={done} toggle={toggle}>
              <strong>Agreement step:</strong> read Notkunarskilmálar (ToS) + Vinnslusamningur (DPA), tick both boxes. Confirm you
              can&apos;t advance with only one ticked.
            </Step>
            <Step id="a2-company" done={done} toggle={toggle}>
              <strong>Company step:</strong> enter company name, company kennitala, contact-person kennitala, phone, and position.
            </Step>
            <Step id="a2-kennitala" done={done} toggle={toggle}>
              <strong>Validation:</strong> try an invalid kennitala (e.g. <code className="font-mono text-[12px]">0000000000</code>) and
              confirm it&apos;s rejected with a clear message.
            </Step>
            <Step id="a2-redirect" done={done} toggle={toggle}>
              Submit → confirm you land on <Route>/business/&#123;companyId&#125;/welcome</Route>.
            </Step>
          </div>
        </Phase>

        <Phase n={3} title="Welcome screen" subtitle="First-run landing">
          <div className="divide-y divide-gray-100">
            <Step id="a3-welcome" done={done} toggle={toggle}>
              Confirm the personalised greeting shows your name + company, the medical-team card renders, and the 3-step overview is correct.
            </Step>
            <Step id="a3-cta" done={done} toggle={toggle}>
              Click through to the dashboard at <Route>/business/&#123;companyId&#125;</Route>.
            </Step>
          </div>
        </Phase>
      </div>

      <h3 className="text-sm font-bold text-gray-900 mb-2 mt-6">Path B — Lifeline staff pre-creates the company</h3>
      <div className="space-y-2.5">
        <Phase n={4} title="Staff creates a draft + claim link" subtitle="Admin side">
          <p className="text-[13px] text-gray-500 mb-2">
            From <Route>/admin/companies/create</Route> &nbsp;<Pill tone="emerald">staff / AAL2</Pill>
          </p>
          <div className="divide-y divide-gray-100">
            <Step id="b4-create" done={done} toggle={toggle}>
              Create a draft company: company name + contact draft (name, email, role). This generates a one-time <strong>claim token</strong>.
            </Step>
            <Step id="b4-invite" done={done} toggle={toggle}>
              Send / copy the claim link. Confirm the company shows as <Pill tone="amber">contact_invited</Pill> in <Route>/admin/companies</Route>.
            </Step>
          </div>
        </Phase>

        <Phase n={5} title="Contact claims the company" subtitle="/business/claim/{token}">
          <div className="divide-y divide-gray-100">
            <Step id="b5-preview" done={done} toggle={toggle}>
              Open the claim link in a fresh window. Confirm the company name + pre-filled contact details render.
            </Step>
            <Step id="b5-setup" done={done} toggle={toggle}>
              Set a password, confirm/edit name + role, and (for parent companies) accept ToS + DPA. Sub-companies should skip legal acceptance.
            </Step>
            <Step id="b5-guard" done={done} toggle={toggle}>
              <strong>Session guard:</strong> while signed in as a different user, open the link and confirm the amber &quot;sign out&quot; warning appears.
            </Step>
            <Step id="b5-login" done={done} toggle={toggle}>
              Submit → confirm redirect to <Route>/business/login?claimed=1</Route> and that you can sign in.
            </Step>
          </div>
        </Phase>
      </div>

      <h3 className="text-sm font-bold text-gray-900 mb-2 mt-6">Shared flow — both paths continue here</h3>
      <div className="space-y-2.5">
        <Phase n={6} title="Build the employee roster" subtitle="Dashboard → Roster">
          <div className="divide-y divide-gray-100">
            <Step id="c6-bulk" done={done} toggle={toggle}>
              <strong>Bulk upload:</strong> upload a CSV (columns: full_name, email, optional phone / kennitala_last4). Confirm members appear with status <Pill tone="amber">Invited</Pill>.
            </Step>
            <Step id="c6-single" done={done} toggle={toggle}>
              <strong>Add one manually</strong> and confirm it joins the roster.
            </Step>
            <Step id="c6-edit" done={done} toggle={toggle}>
              Edit and delete a roster row; confirm both work.
            </Step>
            <Step id="c6-gate" done={done} toggle={toggle}>
              <strong>Gate check:</strong> before signing the agreement, try to send invites — confirm it&apos;s blocked (invites require a signed agreement).
            </Step>
          </div>
        </Phase>

        <Phase n={7} title="Schedule the services" subtitle="Body comp · blood tests · doctor interviews · lectures">
          <Callout tone="blue" title="Each of these needs Lifeline approval">
            Events you create here land in the admin <strong>Scheduling</strong> tab as <em>requested</em>. Approve them later in Phase&nbsp;10.
          </Callout>
          <div className="divide-y divide-gray-100 mt-2">
            <Step id="c7-bodycomp" done={done} toggle={toggle}>
              <strong>Body composition:</strong> add an event — date, start/end time, location, room notes, break window, slot duration, capacity. Edit + delete it.
            </Step>
            <Step id="c7-blood" done={done} toggle={toggle}>
              <strong>Blood test day:</strong> add a date + notes (e.g. lab location). Edit + delete.
            </Step>
            <Step id="c7-doctor" done={done} toggle={toggle}>
              <strong>Doctor interviews:</strong> add a slot (date, time range, capacity).
            </Step>
            <Step id="c7-lecture" done={done} toggle={toggle}>
              <strong>Intro lecture:</strong> add one onsite (with location) and one in video mode. Confirm location only shows for onsite.
            </Step>
            <Step id="c7-status" done={done} toggle={toggle}>
              Confirm each new item shows a <Pill tone="amber">pending approval</Pill> badge.
            </Step>
          </div>
        </Phase>

        <Phase n={8} title="Invite a co-admin" subtitle="Team admins section">
          <div className="divide-y divide-gray-100">
            <Step id="c8-invite" done={done} toggle={toggle}>
              Invite a co-admin by email. They receive a magic link to <Route>/business/co-admin-setup</Route>.
            </Step>
            <Step id="c8-setup" done={done} toggle={toggle}>
              As the co-admin (fresh window), set a password + profile (name, position, phone, kennitala) and confirm you reach the same dashboard.
            </Step>
            <Step id="c8-switcher" done={done} toggle={toggle}>
              If your test user now admins 2+ companies, confirm <Route>/business</Route> shows the company switcher.
            </Step>
          </div>
        </Phase>

        <Phase n={9} title="Sign the service agreement" subtitle="/business/{companyId}/sign">
          <div className="divide-y divide-gray-100">
            <Step id="c9-config" done={done} toggle={toggle}>
              Set headcount (defaults to roster size), pick a 1-year (1 round) or 2-year (2 rounds) term, and confirm the per-assessment price drops on the 2-year option.
            </Step>
            <Step id="c9-addons" done={done} toggle={toggle}>
              Toggle add-ons: 3-month doctor call, and (if app-enabled for this company) the coaching-app subscription with prepaid months. Confirm the order summary updates live.
            </Step>
            <Step id="c9-discount" done={done} toggle={toggle}>
              Apply a <strong>discount code</strong> (create one first in admin → Discount codes). Confirm % or fixed reduction applies, and an invalid code is rejected.
            </Step>
            <Step id="c9-vat" done={done} toggle={toggle}>
              Check VAT defaults to 0 (healthcare) and that totals (subtotal → discount → VAT → total) compute correctly.
            </Step>
            <Step id="c9-docs" done={done} toggle={toggle}>
              Review the rendered Þjónustusamningur, Þjónustuskilmálar, and Purchase Order line items for accuracy.
            </Step>
            <Step id="c9-sign" done={done} toggle={toggle}>
              Tick the authorisation checkbox, sign &amp; confirm. Confirm the success screen + that confirmation emails are sent.
            </Step>
          </div>
        </Phase>

        <Phase n={10} title="Send employee invites + onboard one" subtitle="The employee experience">
          <div className="divide-y divide-gray-100">
            <Step id="c10-send" done={done} toggle={toggle}>
              Now that the agreement is signed, select members → <strong>Send invites</strong>. Confirm each gets an email with an onboarding link + temp password.
            </Step>
            <Step id="c10-verify" done={done} toggle={toggle}>
              As the employee (fresh window) open <Route>/business/onboard/&#123;token&#125;</Route> and verify the temporary password.
            </Step>
            <Step id="c10-consent" done={done} toggle={toggle}>
              Step through Welcome → Consent (ToS + health-assessment consent; try the research/marketing opt-outs).
            </Step>
            <Step id="c10-profile" done={done} toggle={toggle}>
              Enter the health profile (sex, height, weight, activity level).
            </Step>
            <Step id="c10-account" done={done} toggle={toggle}>
              Set the login email + password (min 12 chars) and finish. Confirm the &quot;download the app&quot; success screen.
            </Step>
            <Step id="c10-roster" done={done} toggle={toggle}>
              Back on the company dashboard, confirm that employee now shows as <Pill tone="emerald">completed</Pill> / profile complete.
            </Step>
          </div>
        </Phase>
      </div>

      <h3 className="text-sm font-bold text-gray-900 mb-2 mt-6">Admin oversight — verify the staff side</h3>
      <div className="space-y-2.5">
        <Phase n={11} title="Review everything from /admin/business">
          <div className="divide-y divide-gray-100">
            <Step id="d11-companies" done={done} toggle={toggle}>
              <strong>Companies tab:</strong> find your test company, drill in, and confirm members, co-admins, events, and milestones all match what you created.
            </Step>
            <Step id="d11-approvals" done={done} toggle={toggle}>
              <strong>Scheduling tab:</strong> approve a body-comp event and a lecture; reject one with a reason. Confirm the status flips on the company dashboard.
            </Step>
            <Step id="d11-pricing" done={done} toggle={toggle}>
              In the company detail, edit pricing overrides / tier / app-enabled flag and confirm they carry into a fresh signing page.
            </Step>
            <Step id="d11-payments" done={done} toggle={toggle}>
              <strong>Payments tab:</strong> confirm the signed order appears and invoice status is tracked.
            </Step>
            <Step id="d11-accounting" done={done} toggle={toggle}>
              <strong>Accounting tab:</strong> confirm the company shows in the P&amp;L rollup. The overview strip at the top should reflect this month&apos;s net + outstanding + pending approvals.
            </Step>
          </div>
        </Phase>
      </div>

      {/* Gotchas */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Watch out for</h3>
        <Callout tone="amber" title="Session collisions">
          The same browser can&apos;t be the admin, the company contact, and the employee at once. Use separate
          incognito windows; heed the amber &quot;you&apos;re signed in as X&quot; warnings on the claim/onboard pages.
        </Callout>
        <Callout tone="amber" title="Email gates are real">
          Company signup needs a confirmed email before you can create a company. Employee + co-admin invites send real
          mail — if nothing arrives, check spam and confirm the address before assuming a bug.
        </Callout>
        <Callout tone="amber" title="Invites need a signed agreement">
          You can build the roster any time, but <strong>Send invites</strong> is blocked until the service agreement is signed.
          That&apos;s intended — don&apos;t file it as a bug.
        </Callout>
        <Callout tone="emerald" title="How to report what you find">
          Note the exact route, what you did, what you expected, and what happened (a screenshot helps). Send it to Mads
          / drop it in the team channel. Include whether you were on Path A (self-signup) or Path B (claim link).
        </Callout>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Found a step that no longer matches the app? This guide lives at
        {" "}<code className="font-mono">src/app/admin/business/TestingGuide.tsx</code> — flag it so we keep it accurate.
      </p>
    </div>
  );
}

// Keep the progress denominator in sync with the <Step> ids above. Listed
// explicitly (rather than scraped) so the count is deterministic and a
// renamed/removed step is a visible diff here.
const STEP_IDS = {
  "a1-signup": 1, "a1-confirm": 1, "a1-login": 1,
  "a2-terms": 1, "a2-company": 1, "a2-kennitala": 1, "a2-redirect": 1,
  "a3-welcome": 1, "a3-cta": 1,
  "b4-create": 1, "b4-invite": 1,
  "b5-preview": 1, "b5-setup": 1, "b5-guard": 1, "b5-login": 1,
  "c6-bulk": 1, "c6-single": 1, "c6-edit": 1, "c6-gate": 1,
  "c7-bodycomp": 1, "c7-blood": 1, "c7-doctor": 1, "c7-lecture": 1, "c7-status": 1,
  "c8-invite": 1, "c8-setup": 1, "c8-switcher": 1,
  "c9-config": 1, "c9-addons": 1, "c9-discount": 1, "c9-vat": 1, "c9-docs": 1, "c9-sign": 1,
  "c10-send": 1, "c10-verify": 1, "c10-consent": 1, "c10-profile": 1, "c10-account": 1, "c10-roster": 1,
  "d11-companies": 1, "d11-approvals": 1, "d11-pricing": 1, "d11-payments": 1, "d11-accounting": 1,
} as const;

const STEP_IDS_LIST = Object.keys(STEP_IDS);

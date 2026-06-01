<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Lifeline Website — agent context

**Read this before starting any task in this repo.** It captures the system architecture, conventions, and current state. Live state (commits, deploys, open PRs) lives in tools (git, vercel, supabase) — query those, don't trust this file for the latest.

## What this is

Lifeline Health ehf. is an Icelandic health platform: comprehensive health assessments ("Health Check") + ongoing personalised coaching, sold B2C and B2B (companies). This repo is `lifeline-website` and serves THREE products from one Next.js codebase deployed as a single Vercel project (`lifeline-website`, prod aliases `www.lifelinehealth.is` and `lifelinehealth.is`):

1. **Marketing site** — `/`, `/assessment`, `/coaching`, `/business`, `/contact`, `/pricing`, `/how-it-works`, plus legal pages.
2. **Client account** — `/account/*` (login, signup, profile) for end users.
3. **Admin / clinical app** — `/admin/*` — staff use this to run the whole business: clients, scheduling, programs, content, surveys, payments, B2B, team management, AI feedback, and the recruiting doc tooling. MFA-gated, role-based.

A sibling **`lifeline-app`** repo (mobile / web client app — see cross-repo section) is the patient-facing application that talks to the same Supabase backend. The two share a database; they don't share code by default.

## Module map (`src/app/`)

| Path | Purpose | Auth |
|---|---|---|
| `/` + marketing routes | Public marketing | Gated by coming-soon (cosmetic, see below) |
| `/account/*` | Client login + signup + profile | Supabase auth |
| `/admin/*` | Staff app (clients, scheduling, programs, etc.) | Supabase + staff RPC + AAL2 (MFA) |
| `/auth/*` | OAuth callback handlers | n/a |
| `/api/admin/*` | Admin server endpoints | `requireAdminAAL2` for mutations, `isAnyActiveStaff` for reads |
| `/api/*` | Public / cron / webhook endpoints | Each route owns its gate |
| `/survey/*`, `/research/*`, `/verkefnalysing/*`, `/radningarsamningur/*` | Chrome-free shared links (no Navbar / Footer) | Per-route (often password-gated) |
| `/coming-soon` | Pre-launch splash | n/a |

Admin sub-routes are extensive (~50): `clients`, `coach`, `conversations`, `scheduling`, `bookings`, `content`, `business`, `communication`, `analytics`, `legal`, `beta`, `releases`, `surveys`, `ai-test-bench`, `ai-feedback`, `errors`, `wearable-issues`, `team`, `settings`, `signatures`, `job-description`, etc. Each is a `src/app/admin/<name>/page.tsx` client component.

## Stack

- **Next.js (latest)** — App Router. **Read `node_modules/next/dist/docs/` before writing any Next.js code.** The version has breaking changes vs. older training data: `middleware.ts` is deprecated in favor of `proxy.ts`, default function timeout is 300s, Node.js 24 LTS default, etc.
- **TypeScript** strict, ESLint via `npx eslint`.
- **Tailwind CSS** for everything. Emerald accent `#10B981` is the brand; rebrand wordmark at `/public/lifeline-logo-rebrand.svg`.
- **Supabase** — auth + Postgres + storage. Project `lifeline-health` (`cfnibfxzltxiriqxvvru`).
- **Vercel** — auto-deploys on push to `main`. Cron jobs declared in `vercel.json`.
- **i18n** via `@/lib/i18n` (Icelandic / English).

## Supabase: clients and conventions

Two clients in `src/lib/`:

- `supabase.ts` — **anon client**, used in `"use client"` components. Subject to RLS. Never use for admin operations.
- `supabase-admin.ts` — **service-role client**, server-only (API routes). Bypasses RLS. **Never import in a `"use client"` file** — that would ship the key to the browser.

Auth helpers in `src/lib/auth-helpers.ts`:

- `getUserFromRequest(req)` — decodes the `Authorization: Bearer <token>` header, returns the Supabase user or null.
- `isAnyActiveStaff(userId)` — any active staff (incl. lawyer / medical_advisor read-only roles). Use for **read** endpoints.
- `isStaff(userId)` — active staff with write authorization (excludes lawyer / medical_advisor).
- `requireAdminAAL2(req)` — hard gate for admin mutation endpoints: valid session + admin-write role + AAL2 (MFA-stepped-up) token. Returns the user or one of `'unauthorized' | 'forbidden' | 'mfa_required'`. **Use this on every PUT / POST / DELETE in `/api/admin/*`**.

### Staff roles & permissions

Roles: `coach`, `doctor`, `nurse`, `psychologist`, `admin`, `lawyer`, `medical_advisor`.
Permissions: `manage_clients`, `manage_programs`, `manage_team`, `view_analytics`, `send_messages`, `app_user_access`, `view_legal`.

`lawyer` only ever sees `/admin/legal/*` (external counsel, no patient data). `medical_advisor` gets read-everything on the admin app; writes blocked by RLS.

### Migration convention

Loose `.sql` files in `supabase/` (e.g. `migration-job-description.sql`, `migration-email-signatures.sql`). Applied **manually in the Supabase SQL editor**, not via `supabase db push`. Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY …`, `ON CONFLICT DO NOTHING`).

Standard table pattern for API-mediated data:

1. `ENABLE ROW LEVEL SECURITY`
2. A "Block client access" policy `FOR ALL USING (false) WITH CHECK (false)` (all reads / writes go through the API using `supabaseAdmin`)
3. Optional: a "Active staff can read" policy for tables read directly by the admin UI

## Coming-soon gate

`src/middleware.ts` (still `middleware.ts`, not `proxy.ts` as of this writing — pending migration) rewrites any non-allowlisted public path to `/coming-soon` unless one of:

- A `site_preview` cookie with the shared key `lifelinepreview2026` is present
- A `?preview=lifelinepreview2026` query param is provided (sets the cookie for 30 days)
- The user is an active admin (the admin layout sets the bypass cookie on auth — `src/app/admin/layout.tsx`)

The allowlist currently passes `/auth`, `/admin`, `/account`, `/api`, `/research`, `/survey`, `/verkefnalysing`, `/_next`, `/favicon`, plus static assets.

**The coming-soon gate is cosmetic, not a security boundary.** The key is in source. Don't put anything sensitive behind it without a real auth gate.

## Chrome-free public routes

Navbar (`src/app/components/Navbar.tsx`) and Footer (`src/app/components/Footer.tsx`) self-suppress for `/survey`, `/research`, `/verkefnalysing`, `/radningarsamningur`, `/privacy`, `/terms`, `/sales-terms`, `/soluskilmalar`. Pages there render their own header (logo + back button) when needed.

When adding a new chrome-free route, update **both** Navbar and Footer's suppression lists and the middleware allowlist if it should bypass coming-soon.

## Deployment

- `main` → production. Vercel auto-deploys on push (the GitHub integration is connected).
- Feature branches → preview deployments at `lifeline-website-git-<branch>-<scope>.vercel.app`.
- A `full-site-preview` branch exists with a `VERCEL_ENV === 'preview'` short-circuit in middleware that ungates the entire preview deployment, for internal review. Safe to merge to main — production stays gated for everyone except logged-in admins.
- Manual deploy from CLI: `vercel --prod`. Used historically before git auto-deploy was reliable.
- Crons declared in `vercel.json` (b2b-digest, body-comp-reminder, access-review-reminder, error-log-digest, ai consistency narratives, refresh-meters).

## Conventions you must follow

1. **Read `node_modules/next/dist/docs/` for Next.js APIs.** Don't trust your training data.
2. **`"use client"` files must never import `supabase-admin`** or any env var that starts with `SUPABASE_SERVICE_ROLE_KEY`.
3. **Admin mutations use `requireAdminAAL2`**, not just `isStaff`.
4. **API-mediated tables get RLS with `FOR ALL USING (false)`** — block client direct access; the API is the only path.
5. **Loose `.sql` migrations**, applied manually. Always idempotent. Reference the file path in the API route comment.
6. **Icelandic typography**: low-99 opening quote `„` and high-66 closing quote `“` — not straight `"` (which also breaks `react/no-unescaped-entities` in JSX text).
7. **Don't run `next build` blindly to test** — it's slow and the lint config tolerates some pre-existing `any` warnings; rely on `npx tsc --noEmit` + `npx eslint <files>` for fast feedback.
8. **Don't migrate to `proxy.ts`** ad hoc — it's a repo-wide change. The hook will nudge; defer unless explicitly tasked.
9. **Never commit `.env.local` or files under `supabase/.temp/`.** Both are gitignored.

## Cross-repo: `lifeline-app`

The mobile / web client app for end users (Lifeline members). Lives at `~/lifeline-app` (or wherever the user has it). Shares the same Supabase project — same auth, same `clients_decrypted` table, same surveys / programs / assessments tables.

When making changes that touch the contract between the two repos (API shape, table schema, auth flow):

- Identify which side owns the change (usually the server / website side).
- Land the contract change in `lifeline-website` first (additive: new optional fields, new endpoint). Deploy.
- Update `lifeline-app` to consume it. Deploy.
- Remove the old code path in `lifeline-website` only after `lifeline-app` no longer uses it (multi-step deprecation).

Open Agent View with `--add-dir` to the other repo when working on cross-repo changes:

```
cd ~/lifeline-website
claude agents --add-dir ~/lifeline-app --permission-mode acceptEdits
```

The two `AGENTS.md` files reference each other but don't share content. Each repo is the source of truth for its own architecture.

## Current focus

(Update this section when priorities shift — short, present-tense, actionable. Use `/update-context` to be reminded.)

- Recruiting tooling: `/admin/job-description` + the public mirror `/verkefnalysing` (password `lifeline`) for sending the framkvæmdastjóri proposal to candidates.
- Coming-soon gate stays on for the public marketing site until launch; admin and the password-gated mirrors are open paths through.

## Useful one-liners for agents

```
git diff main...HEAD                              # what's in this branch
npx tsc --noEmit -p tsconfig.json                 # full typecheck
npx eslint src/app/<path>                         # lint specific path
vercel ls                                         # recent deployments
vercel inspect <deployment-url>                   # deployment details
grep -rn "<symbol>" src --include='*.tsx' --include='*.ts'
```

To run the dev server cleanly (kill afterward by process group):

```
setsid bash -c 'PORT=3137 npm run dev > /tmp/nd.log 2>&1' &
until curl -s -o /dev/null http://localhost:3137/; do sleep 2; done
# ...do work...
pgid=$(ps -o pgid= -p $(pgrep -f "next-server|next dev" | head -1) | tr -d ' ')
kill -TERM -- -"$pgid"
```

## Pitfalls (real ones, from prior incidents)

- **Two Claude sessions pushing to `main` concurrently** can collide. Pause one tab when the other is finishing work.
- **`vercel.json` is `crons`-only here**, not a deploy-disabler. Don't assume missing config means broken pipeline.
- **"No deployment for an hour"** is usually webhook delivery lag from GitHub to Vercel, not a config issue. Empty-commit pushes usually shake it loose.
- **Empty trigger commits** (`chore: trigger Vercel git auto-deploy`) are intentional artefacts of debugging the deploy webhook — leave them in `main`'s history.
- **localStorage-only persistence on shared docs** doesn't propagate across browsers / devices. Job-description / signature data should go through `/api/*` to Supabase, not localStorage alone.

---

*Maintained by humans + `/update-context`. Don't auto-update on every commit; only when the change matters for future agents.*

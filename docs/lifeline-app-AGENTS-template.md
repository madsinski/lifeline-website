<!-- Template: copy this file into the `lifeline-app` repo root as `AGENTS.md`
     (or import from `CLAUDE.md` the same way `lifeline-website` does:
     `CLAUDE.md` containing only `@AGENTS.md`).

     Then fill in every `<TODO: …>` placeholder with the real values. Delete
     this header block once it's done. Keep this file in sync with the
     sibling `lifeline-website/AGENTS.md` — the two reference each other. -->

# Lifeline App — agent context

**Read this before starting any task in this repo.** Architecture, conventions, current state. Live state (commits, deploys, open PRs) lives in tools; query those, don't trust this file for the latest.

## What this is

The patient-facing application for Lifeline Health ehf. — <TODO: one-sentence pitch>. Companion to `lifeline-website` (the marketing + admin / clinical app). Shares one Supabase project; doesn't share code by default.

Stack: <TODO: e.g. "Expo React Native + EAS for iOS / Android" OR "Next.js web app" OR "Both via Expo + Next.js"> — fill this in.

## Module map

| Path | Purpose |
|---|---|
| <TODO: route or folder> | <TODO: purpose> |
| `src/screens/Onboarding/*` | (example) Initial signup + assessment flow |
| `src/screens/Coaching/*` | (example) Daily check-ins, programs, messaging |

## Stack

- **Framework** — <TODO: Expo SDK 51 / Next.js / both>
- **Build / deploy** — <TODO: EAS Build for native, Vercel for web?>
- **Supabase** — same project as `lifeline-website` (`lifeline-health`, ref `cfnibfxzltxiriqxvvru`). Use the anon client only — there is no service role here.
- **Auth** — Supabase auth. Patients log in; staff don't. Anything that requires staff privileges happens on the website side and is consumed via the website's `/api/*` endpoints.
- **State / data** — <TODO: e.g. TanStack Query, Zustand, Redux>
- **Styling** — <TODO: NativeWind, StyleSheet, Tailwind>
- **i18n** — <TODO: Icelandic / English; library if any>

## Supabase: read-only conventions for this repo

- Use only the anon client. **Never bring in a service-role key — there's no place for it here.**
- RLS is the security model. If a query 403s, the RLS policy is the answer; don't try to work around it from the client.
- Tables this app talks to (typical): `clients_decrypted` (your own profile only — RLS scopes to `auth.uid()`), surveys, assessments, programs, check-ins, messages.
- Mutations that touch staff data or business state go through the website's `/api/*` endpoints with a Bearer token. Don't reach into website-side admin tables from this app.

## Cross-repo: `lifeline-website`

The sibling repo. Marketing site + client account screens (web) + the full admin / clinical app + the API. When in doubt about a contract:

- The **source of truth for shared tables and the API surface** is `lifeline-website`. Read `~/lifeline-website/AGENTS.md` and the relevant `src/app/api/*` route.
- Don't change shared table schemas from this app — open a PR on the website repo first.

To work cross-repo: launch agent view anchored to whichever repo you're focused on with `--add-dir` to the other:

```
cd ~/lifeline-app
claude agents --add-dir ~/lifeline-website --permission-mode acceptEdits
```

## Conventions you must follow

1. <TODO: e.g. "Use NativeWind classes; avoid inline StyleSheet">
2. <TODO: e.g. "All network calls go through `src/lib/api.ts` which attaches the Supabase bearer">
3. <TODO: e.g. "Use the shared brand: emerald-600 #10B981 accent, rebrand wordmark for logo">
4. <TODO: e.g. "Never log PII to console — use the privacy-safe logger in `src/lib/log.ts`">
5. <TODO: e.g. "Native builds: bump version in app.json before EAS submit; CI fails if you forget">

## Deployment

- **<TODO: web target>** — <TODO: Vercel project name, branches, deploy command>
- **<TODO: iOS>** — <TODO: EAS profile, store track, submit command>
- **<TODO: Android>** — <TODO: EAS profile, track, signing notes>

## Current focus

(Update when priorities shift. Use `/update-context` to be reminded.)

- <TODO: what's actively being worked on this week>
- <TODO: what's blocked or waiting on the website side>

## Useful one-liners for agents

```
<TODO: e.g. expo start | eas build --platform ios --profile preview>
<TODO: e.g. npx tsc --noEmit>
<TODO: e.g. yarn lint>
```

## Pitfalls (fill in from real incidents)

- <TODO: e.g. "EAS update fails silently when the bundler config is wrong — always check the EAS logs, don't trust local builds">
- <TODO: e.g. "Supabase RLS treats anonymous and authenticated requests differently — always test logged-in flows">
- <TODO: e.g. "iOS App Tracking Transparency: must request before any analytics SDK initialises">

---

*Maintained by humans + `/update-context`. Don't auto-update on every commit; only when the change matters for future agents.*

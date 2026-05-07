# Biody integration handoff package

Two documents, written for two audiences:

- **`EXECUTIVE_SUMMARY.md`** — one-page brief for Medalia's engineering leads. What Biody is, why integrate, what it gives you, what's required from Biody up front, rough effort estimate.

- **`INTEGRATION_GUIDE.md`** — full technical specification. Suitable for an engineer or AI coding agent to ingest as complete context and implement against. Covers auth flow, patient lifecycle, measurement sync, B2B grouping, the 8 specific Biody quirks Lifeline hit, observability, secrets, and a day-by-day testing path.

## How to use

Send both. The summary is for the conversation that gets the project staffed; the guide is for the engineer (or agent) doing the work.

If they want the actual Lifeline reference implementation (~880 lines of TypeScript, Supabase Edge Function flavour), it can be shared on request. The guide is written so it stands on its own without seeing the implementation.

## Contact

Questions on anything in either document — ping Mads at Lifeline Health.

"use client";

// Lifeline vinnustöð — the nurse's and coach's workstation for health-check
// clients (Vera and Lifeline nurses, Lifeline doctors as backup).
//
//   Í dag           today's appointments and ONE "Bíður þín" list: journey
//                   steps, beiðnir and unanswered messages, each row with one
//                   button that lands where the work is done
//   Skjólstæðingar  everyone, searchable, by stage, and the groups
//   Dagatal         the week and the station's open times
//   Prógrömm        programmes and teaching material
//   Stillingar      calendar, PIN, sound, theme, sign-out
//
//   Client page     "Næsta verk" and four tabs — Staða · Skýrsla ·
//                   Aðgerðaáætlun · Forskoðun — with the interview (book →
//                   prepare → talk → assess → plan → finish and book the
//                   3-month follow-up), referrals, SMS/email, payments and the
//                   audit trail opening as sheets over them
//
// The code lives in ./_ws: Shell (session, view and URL), Home, tasks (the
// next-task rule), and patient/* (the workspace, its sheets and the
// interview). Own cookie auth (src/lib/hc/ws-auth.ts); nurses never need
// /admin. /admin/vinnustod mounts the same WorkstationApp with Bearer auth.

import { WorkstationApp } from "./_ws/Shell";

export { WorkstationApp };

export default function Vinnustod() {
  return <WorkstationApp mode="worker" />;
}

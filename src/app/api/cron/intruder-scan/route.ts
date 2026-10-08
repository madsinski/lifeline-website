// Hourly cron — scans every account for signs of an intruder
// (scanner-generated signups, injection probes, self-granted staff
// roles, new staff rows, signup bursts). New findings are stored in
// security_findings, emailed once, and shown at /admin/security.
// Accounts on scanner callback domains are blocked from signing in
// straight away. Logic lives in src/lib/intruder-scan.ts.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runIntruderScan } from "@/lib/intruder-scan";

export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;
  const got = auth.slice(prefix.length);
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runIntruderScan();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "scan_failed" }, { status: 500 });
  }
}

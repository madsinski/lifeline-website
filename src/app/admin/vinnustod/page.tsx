"use client";

/*
 * The workstation for Lifeline's own staff.
 *
 * ws-api.tsx has described this route since it was written — "/admin/vinnustod
 * Lifeline staff, the admin Bearer token + MFA" — and /api/vinnustod/me has
 * always accepted both kinds of actor. The route itself was never built, so
 * the staff half of a two-actor design had no door: WorkstationApp supports
 * mode="staff" and nothing mounted it.
 *
 * What that meant in practice is that Lifeline staff could not use the
 * workstation at all. /vinnustod signs requests with the partner-nurse cookie
 * session, so the only way in there is an hc_workers password — a second
 * credential, separate from the Supabase login, which one of Mads' two
 * accounts does not have at all.
 *
 * Here the api is Bearer-signed from the Supabase session, which getHcActor
 * resolves to a staff actor when the session is AAL2. The MFA requirement is
 * deliberate and stays: this screen reaches every client's record.
 */

import { WorkstationApp } from "@/app/vinnustod/page";
import { WsApiProvider } from "@/app/components/hc/ws-api";
import { adminApi } from "../hc-api";

export default function AdminWorkstationPage() {
  return (
    <WsApiProvider value={adminApi}>
      <WorkstationApp mode="staff" />
    </WsApiProvider>
  );
}

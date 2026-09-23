"use client";

// The nurse workstation, inside the admin app.
//
// Same screens as the standalone /vinnustod (which partner nurses at Vera and
// the heilsugæsla sign into with their own session) — here they run on the
// Lifeline staff token, so the admin layout's MFA gate is the door and there
// is nothing extra to sign into.

import { useStaffGuard } from "@/lib/useStaffGuard";
import { WorkstationApp } from "@/app/vinnustod/page";
import { WsApiProvider } from "@/app/components/hc/ws-api";
import { adminApi } from "../hc-api";

export default function AdminWorkstation() {
  const { authorized, loading } = useStaffGuard();
  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;
  return (
    <WsApiProvider value={adminApi}>
      <WorkstationApp mode="staff" />
    </WsApiProvider>
  );
}

"use client";

// Action-plan builder for one client journey, from /admin (staff Bearer +
// AAL2). Nurses use the same builder in /vinnustod.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStaffGuard } from "@/lib/useStaffGuard";
import PlanBuilder from "@/app/components/hc/PlanBuilder";
import { adminApi } from "../../../hc-api";

export default function AdminPlanBuilder() {
  const { journeyId } = useParams<{ journeyId: string }>();
  const { authorized, loading } = useStaffGuard();
  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;
  return (
    <div className="p-6">
      <Link href="/admin/coach/plans" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">← Aðgerðaáætlanir</Link>
      <PlanBuilder journeyId={journeyId} api={adminApi} />
    </div>
  );
}

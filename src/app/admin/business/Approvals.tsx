"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PendingEvent {
  id: string;
  company_id: string;
  company_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
}

interface PendingInterview {
  id: string;
  company_id: string;
  company_name: string;
  proposed_date: string;
  start_time: string;
  end_time: string;
  mode: "onsite" | "video";
}

export default function ApprovalsContent() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [interviews, setInterviews] = useState<PendingInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: evs }, { data: ivs }] = await Promise.all([
      supabase
        .from("body_comp_events")
        .select("id, company_id, event_date, start_time, end_time, location, companies:company_id(name)")
        .eq("approval_status", "requested")
        .order("event_date", { ascending: true }),
      supabase
        .from("doctor_interview_proposals")
        .select("id, company_id, proposed_date, start_time, end_time, mode, companies:company_id(name)")
        .eq("approval_status", "requested")
        .order("proposed_date", { ascending: true }),
    ]);
    const name = (raw: unknown): string => {
      const c = Array.isArray(raw) ? raw[0] : raw;
      return (c && typeof c === "object" && "name" in c ? (c as { name: string }).name : "") || "—";
    };
    setEvents(((evs as unknown[]) || []).map((e) => {
      const r = e as Record<string, unknown>;
      return { id: r.id as string, company_id: r.company_id as string, company_name: name(r.companies), event_date: r.event_date as string, start_time: r.start_time as string, end_time: r.end_time as string, location: (r.location as string) ?? null };
    }));
    setInterviews(((ivs as unknown[]) || []).map((e) => {
      const r = e as Record<string, unknown>;
      return { id: r.id as string, company_id: r.company_id as string, company_name: name(r.companies), proposed_date: r.proposed_date as string, start_time: r.start_time as string, end_time: r.end_time as string, mode: r.mode as "onsite" | "video" };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (kind: "event" | "interview", id: string, action: "approve" | "reject") => {
    setBusyId(id);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const url = kind === "event"
      ? `/api/admin/business/events/${id}/approve`
      : `/api/admin/business/doctor-interviews/${id}/approve`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(`Failed: ${j.error || res.status}`); return; }
    load();
  };

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const totalPending = events.length + interviews.length;

  return (
    <div className="px-8 py-6 space-y-8 max-w-3xl">
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : totalPending === 0 ? (
        <p className="text-gray-400 text-sm">Nothing awaiting approval.</p>
      ) : (
        <>
          {events.length > 0 && (
            <section>
              <h2 className="font-semibold text-gray-900 mb-3">Measurement days ({events.length})</h2>
              <div className="space-y-2">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-sm">
                      <div className="font-semibold text-gray-900">{e.company_name}</div>
                      <div className="text-gray-600">{fmtDate(e.event_date)} · {e.start_time.slice(0,5)}–{e.end_time.slice(0,5)}{e.location ? ` · ${e.location}` : ""}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button disabled={busyId === e.id} onClick={() => act("event", e.id, "approve")}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">Approve</button>
                      <button disabled={busyId === e.id} onClick={() => act("event", e.id, "reject")}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {interviews.length > 0 && (
            <section>
              <h2 className="font-semibold text-gray-900 mb-3">Doctor-interview days ({interviews.length})</h2>
              <div className="space-y-2">
                {interviews.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-sm">
                      <div className="font-semibold text-gray-900">{e.company_name}</div>
                      <div className="text-gray-600">
                        {fmtDate(e.proposed_date)} · {e.start_time.slice(0,5)}–{e.end_time.slice(0,5)} ·{" "}
                        <span className="capitalize">{e.mode === "onsite" ? "On-site" : "Video/phone"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button disabled={busyId === e.id} onClick={() => act("interview", e.id, "approve")}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">Approve</button>
                      <button disabled={busyId === e.id} onClick={() => act("interview", e.id, "reject")}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

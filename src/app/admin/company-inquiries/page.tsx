"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Inquiry = {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  kennitala: string | null;
  location: string | null;
  employee_count: number | null;
  interest: string[];
  message: string | null;
  status: "new" | "contacted" | "converted" | "closed";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Filter = "new" | "contacted" | "converted" | "closed" | "all";

const INTEREST_LABEL: Record<string, string> = {
  foundational: "Foundational Health",
  checkin: "Check-in",
  "self-checkin": "Self Check-in",
  coaching: "Coaching app",
  other: "Other",
};

export default function CompanyInquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("new");
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("company_inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { setMsg(`Load failed: ${error.message}`); return; }
    setRows((data as Inquiry[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => filter === "all" ? true : r.status === filter),
    [rows, filter],
  );

  const counts = useMemo(() => {
    const c = { new: 0, contacted: 0, converted: 0, closed: 0, all: rows.length };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  async function updateStatus(id: string, status: Inquiry["status"]) {
    const { error } = await supabase.from("company_inquiries").update({ status }).eq("id", id);
    if (error) { setMsg(`Update failed: ${error.message}`); return; }
    setMsg("Status updated.");
    load();
  }

  async function saveNotes(id: string, notes: string) {
    const { error } = await supabase.from("company_inquiries").update({ notes }).eq("id", id);
    if (error) { setMsg(`Notes save failed: ${error.message}`); return; }
    setMsg("Notes saved.");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this inquiry permanently?")) return;
    const { error } = await supabase.from("company_inquiries").delete().eq("id", id);
    if (error) { setMsg(`Delete failed: ${error.message}`); return; }
    setMsg("Deleted.");
    load();
  }

  function statusPill(status: Inquiry["status"]) {
    const map = {
      new: "bg-blue-50 text-blue-700 border-blue-100",
      contacted: "bg-amber-50 text-amber-700 border-amber-100",
      converted: "bg-emerald-50 text-emerald-700 border-emerald-100",
      closed: "bg-gray-50 text-gray-600 border-gray-200",
    };
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#1F2937]">Company inquiries</h1>
        <p className="text-sm text-[#6B7280]">Incoming B2B inquiries from the public /business page.</p>
      </header>

      {msg && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          {msg}
          <button onClick={() => setMsg("")} className="ml-2 text-xs underline">dismiss</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        {([
          ["new", `New (${counts.new})`],
          ["contacted", `Contacted (${counts.contacted})`],
          ["converted", `Converted (${counts.converted})`],
          ["closed", `Closed (${counts.closed})`],
          ["all", `All (${counts.all})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === key ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm text-gray-600">
          No inquiries in this view.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{r.company_name}</span>
                      {statusPill(r.status)}
                      {r.employee_count != null && (
                        <span className="text-xs text-gray-500">{r.employee_count} employees</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {r.contact_name} · <a href={`mailto:${r.contact_email}`} className="underline" onClick={(e) => e.stopPropagation()}>{r.contact_email}</a>
                      {r.contact_phone && <> · {r.contact_phone}</>}
                      {r.location && <> · {r.location}</>}
                    </div>
                    {r.interest.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Interest: {r.interest.map((i) => INTEREST_LABEL[i] || i).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </button>
                {isOpen && (
                  <InquiryDetail
                    inquiry={r}
                    onStatus={(s) => updateStatus(r.id, s)}
                    onSaveNotes={(notes) => saveNotes(r.id, notes)}
                    onDelete={() => remove(r.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InquiryDetail({
  inquiry, onStatus, onSaveNotes, onDelete,
}: {
  inquiry: Inquiry;
  onStatus: (s: Inquiry["status"]) => void;
  onSaveNotes: (notes: string) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(inquiry.notes || "");
  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 space-y-4">
      {inquiry.kennitala && (
        <div className="text-sm text-gray-700">
          <span className="text-gray-500">Kennitala:</span> {inquiry.kennitala}
        </div>
      )}
      {inquiry.message && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Message</div>
          <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">{inquiry.message}</div>
        </div>
      )}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Staff notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
          placeholder="Private notes — quote sent, next steps, etc."
        />
        <button
          onClick={() => onSaveNotes(notes)}
          className="mt-2 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
        >
          Save notes
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {(["new", "contacted", "converted", "closed"] as Inquiry["status"][]).map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
                inquiry.status === s
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={onDelete}
          className="text-xs font-medium text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

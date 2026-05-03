"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TIER_LABELS: Record<string, string> = {
  "free-trial": "Free Plan",
  "self-maintained": "Self-Maintained",
  "premium": "Premium",
};

const tierColors: Record<string, string> = {
  "free-trial": "bg-gray-100 text-gray-700",
  "self-maintained": "bg-blue-100 text-blue-700",
  "premium": "bg-emerald-100 text-emerald-700",
};

interface Client {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  sex: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Subscription {
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface Appointment {
  id: string;
  type: string;
  date: string;
  time: string;
  status: string;
  coach_name: string | null;
}

interface ClientProgram {
  category_key: string;
  program_key: string;
  week_number: number;
  started_at: string;
}

interface Conversation {
  id: string;
  coach_name: string;
  created_at: string;
  messageCount: number;
  lastMessage: string;
}

function ClientDetailsEditor({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [fullName, setFullName] = useState(client.full_name || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [address, setAddress] = useState(client.address || "");
  const [dateOfBirth, setDateOfBirth] = useState(client.date_of_birth || "");
  const [sex, setSex] = useState(client.sex || "");

  const reset = () => {
    setFullName(client.full_name || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setAddress(client.address || "");
    setDateOfBirth(client.date_of_birth || "");
    setSex(client.sex || "");
    setMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      // Update clients table
      const { error: clientErr } = await supabase.from("clients_decrypted").update({
        full_name: fullName.trim() || client.full_name,
        phone: phone.trim() || null,
        address: address.trim() || null,
        date_of_birth: dateOfBirth || null,
        sex: sex || null,
      }).eq("id", client.id);

      if (clientErr) throw new Error(clientErr.message);

      // Update auth email if changed
      if (email.trim() && email.trim() !== client.email) {
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (token) {
          const res = await fetch(`/api/admin/clients/${client.id}/update-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ email: email.trim() }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || "Email update failed");
          }
        }
      }

      setMsg({ type: "ok", text: "Saved" });
      setEditing(false);
      onSaved();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    }
    setSaving(false);
  };

  if (!editing) {
    return (
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Personal details</p>
          <button onClick={() => { reset(); setEditing(true); }} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Full name</p>
            <p className="text-sm text-gray-700 mt-0.5">{client.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Email</p>
            <p className="text-sm text-gray-700 mt-0.5">{client.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            <p className="text-sm text-gray-700 mt-0.5">{client.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Address</p>
            <p className="text-sm text-gray-700 mt-0.5">{client.address || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Date of birth</p>
            <p className="text-sm text-gray-700 mt-0.5">{client.date_of_birth ? formatDate(client.date_of_birth) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sex</p>
            <p className="text-sm text-gray-700 mt-0.5 capitalize">{client.sex || "—"}</p>
          </div>
        </div>
        {msg && <p className={`text-xs mt-2 ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">Edit personal details</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+354..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date of birth</label>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sex</label>
          <select value={sex} onChange={(e) => setSex(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none">
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      <div className="flex items-center gap-2 mt-4">
        <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={() => { setEditing(false); reset(); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [programs, setPrograms] = useState<ClientProgram[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClient = useCallback(async () => {
    setLoading(true);
    try {
      // Load all in parallel
      const [clientRes, subRes, aptRes, progRes, convRes] = await Promise.all([
        supabase.from("clients_decrypted").select("*").eq("id", clientId).single(),
        supabase.from("subscriptions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
        supabase.from("appointments").select("*").eq("client_id", clientId).order("date", { ascending: false }).limit(10),
        supabase.from("client_programs").select("*").eq("client_id", clientId),
        supabase.from("conversations").select("*, messages_decrypted(id, content, created_at)").eq("client_id", clientId),
      ]);

      if (clientRes.data) setClient(clientRes.data as Client);
      if (subRes.data && subRes.data.length > 0) setSubscription(subRes.data[0] as Subscription);
      if (aptRes.data) setAppointments(aptRes.data as Appointment[]);
      if (progRes.data) setPrograms(progRes.data as ClientProgram[]);
      if (convRes.data) {
        setConversations(
          (convRes.data as (Record<string, unknown> & { messages: { id: string; content: string; created_at: string }[] })[]).map((c) => ({
            id: c.id as string,
            coach_name: (c.coach_name as string) || "Coach",
            created_at: c.created_at as string,
            messageCount: c.messages?.length ?? 0,
            lastMessage: c.messages?.length > 0
              ? c.messages.sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].content
              : "",
          }))
        );
      }
    } catch (e) {
      console.error("[ClientDetail] Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Client not found</p>
        <button onClick={() => router.push("/admin/clients")} className="text-sm text-blue-600 mt-2 hover:underline">
          Back to clients
        </button>
      </div>
    );
  }

  const tier = subscription?.tier || "none";
  const initials = client.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to clients
      </Link>

      {/* Client header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center text-xl font-bold text-[#10B981]">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1F2937]">{client.full_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{client.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tierColors[tier] || "bg-gray-100 text-gray-600"}`}>
                {TIER_LABELS[tier] || "No subscription"}
              </span>
              {subscription && (
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                  subscription.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {subscription.status}
                </span>
              )}
              <span className="text-xs text-gray-400">Member since {formatDate(client.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Contact details — editable */}
        <ClientDetailsEditor client={client} onSaved={loadClient} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Programs */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Active Programs</h2>
          {programs.length === 0 ? (
            <p className="text-sm text-gray-400">No active programs</p>
          ) : (
            <div className="space-y-3">
              {programs.map((p) => (
                <div key={p.category_key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#1F2937] capitalize">{p.category_key}</p>
                    <p className="text-xs text-gray-500">{p.program_key}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#10B981]">Week {p.week_number}</p>
                    <p className="text-xs text-gray-400">Started {formatDate(p.started_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Appointments */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Recent Appointments</h2>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-400">No appointments</p>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#1F2937] capitalize">{a.type.replace("-", " ")}</p>
                    <p className="text-xs text-gray-500">{a.date} at {a.time}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    a.status === "booked" ? "bg-yellow-100 text-yellow-800" :
                    a.status === "completed" ? "bg-green-100 text-green-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-400">No conversations</p>
          ) : (
            <div className="space-y-3">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href="/admin/messages"
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#1F2937]">{c.coach_name}</p>
                    <span className="text-xs text-gray-400">{c.messageCount} messages</span>
                  </div>
                  {c.lastMessage && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{c.lastMessage}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Subscription details */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Subscription</h2>
          {!subscription ? (
            <p className="text-sm text-gray-400">No active subscription</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tier</span>
                <span className="text-sm font-medium text-[#1F2937]">{TIER_LABELS[subscription.tier] || subscription.tier}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Status</span>
                <span className="text-sm font-medium capitalize text-[#1F2937]">{subscription.status}</span>
              </div>
              {subscription.trial_ends_at && (
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Trial ends</span>
                  <span className="text-sm font-medium text-[#1F2937]">{formatDate(subscription.trial_ends_at)}</span>
                </div>
              )}
              {subscription.current_period_end && (
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Current period ends</span>
                  <span className="text-sm font-medium text-[#1F2937]">{formatDate(subscription.current_period_end)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

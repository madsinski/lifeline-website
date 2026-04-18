import { supabaseAdmin } from "./supabase-admin";

const PAYDAY_BASE_URL = process.env.PAYDAY_BASE_URL || "https://api.payday.is";
const PAYDAY_CLIENT_ID = process.env.PAYDAY_CLIENT_ID;
const PAYDAY_CLIENT_SECRET = process.env.PAYDAY_CLIENT_SECRET;

const HEADERS_BASE = {
  "Content-Type": "application/json",
  "Api-Version": "alpha",
};

// ─── OAuth token (cached in DB) ──────────────────────────────────────────────

async function fetchNewToken(): Promise<{ token: string; expiresAt: string } | null> {
  if (!PAYDAY_CLIENT_ID || !PAYDAY_CLIENT_SECRET) return null;
  const res = await fetch(`${PAYDAY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: HEADERS_BASE,
    body: JSON.stringify({
      clientId: PAYDAY_CLIENT_ID,
      clientSecret: PAYDAY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    console.error("[payday] token fetch failed", res.status, await res.text());
    return null;
  }
  const j = await res.json();
  // PayDay returns { access_token, expires_in } or similar.
  const token = (j?.access_token || j?.accessToken || j?.token) as string | undefined;
  const ttlSec = Number(j?.expires_in || j?.expiresIn || 3600);
  if (!token) {
    console.error("[payday] token response missing token", j);
    return null;
  }
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  await supabaseAdmin.from("payday_auth_cache").upsert({
    id: 1,
    access_token: token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  return { token, expiresAt };
}

async function getToken(): Promise<string | null> {
  if (!PAYDAY_CLIENT_ID || !PAYDAY_CLIENT_SECRET) return null;
  const { data: cached } = await supabaseAdmin
    .from("payday_auth_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (cached?.access_token && new Date(cached.expires_at).getTime() > Date.now() + 60_000) {
    return cached.access_token;
  }
  const fresh = await fetchNewToken();
  return fresh?.token ?? null;
}

async function paydayFetch(path: string, init: RequestInit = {}, retry = true): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const token = await getToken();
  if (!token) return { ok: false, status: 401, json: null, text: "no_payday_token" };
  const res = await fetch(`${PAYDAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...HEADERS_BASE,
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (res.status === 401 && retry) {
    // Invalidate and retry once with a fresh token
    await supabaseAdmin.from("payday_auth_cache").delete().eq("id", 1);
    return paydayFetch(path, init, false);
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { ok: res.ok, status: res.status, json, text };
}

// ─── Customers ──────────────────────────────────────────────────────────────

export interface EnsureCustomerArgs {
  companyId: string;
  kennitala: string;      // 10 digits
  name: string;
  email?: string | null;
  existingPaydayCustomerId?: string | null;
}

export async function ensurePaydayCustomer(args: EnsureCustomerArgs): Promise<{ ok: boolean; customer_id?: string; error?: string; raw?: unknown }> {
  if (args.existingPaydayCustomerId) {
    return { ok: true, customer_id: args.existingPaydayCustomerId };
  }

  const body = {
    ssn: args.kennitala,
    email: args.email || undefined,
    language: "is",
    name: args.name,
    sendElectronicInvoices: true,
    finalDueDateDefaultDaysAfter: 14,
  };

  const res = await paydayFetch("/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // A common failure mode is "customer already exists with this ssn".
    // Fall back to search/query endpoints.
    const searchRes = await paydayFetch(`/customers?perpage=10&page=1`);
    if (searchRes.ok && searchRes.json && typeof searchRes.json === "object") {
      type CustomerRow = { id?: string; ssn?: string };
      const data = (searchRes.json as { data?: CustomerRow[] }).data || [];
      const match = data.find((c) => c?.ssn === args.kennitala);
      if (match?.id) {
        await supabaseAdmin.from("companies").update({ payday_customer_id: match.id }).eq("id", args.companyId);
        return { ok: true, customer_id: match.id };
      }
    }
    return { ok: false, error: `customer_create_http_${res.status}`, raw: res.json ?? res.text };
  }

  const j = res.json as { id?: string; data?: { id?: string } } | null;
  const customerId = j?.id || j?.data?.id;
  if (!customerId) {
    return { ok: false, error: "customer_create_no_id", raw: res.json };
  }

  await supabaseAdmin.from("companies").update({ payday_customer_id: customerId }).eq("id", args.companyId);
  return { ok: true, customer_id: customerId };
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPriceExcludingVat: number;   // ISK per unit
  vatPercentage: number;           // e.g. 24
  discountPercentage?: number;
  comment?: string;
  sku?: string;
  productId?: string;
}

export interface InvoicePayload {
  customerId: string;
  invoiceDate?: string;      // YYYY-MM-DD
  dueDate?: string;          // YYYY-MM-DD
  finalDueDate?: string;     // YYYY-MM-DD
  currencyCode?: string;     // "ISK"
  description?: string;
  createClaim?: boolean;
  createElectronicInvoice?: boolean;
  sendEmail?: boolean;
  reference?: string;
  lines: InvoiceLine[];
}

export interface InvoiceResult {
  ok: boolean;
  invoice_id?: string;
  invoice_number?: string;
  pdf_url?: string;
  issued_at?: string;
  due_at?: string;
  final_due_at?: string;
  error?: string;
  raw?: unknown;
}

export async function createPaydayInvoice(p: InvoicePayload): Promise<InvoiceResult> {
  if (!PAYDAY_CLIENT_ID || !PAYDAY_CLIENT_SECRET) {
    console.warn("[payday] PAYDAY_CLIENT_ID / PAYDAY_CLIENT_SECRET not set — logging payload instead");
    console.log("[payday] would-be invoice:", JSON.stringify(p, null, 2));
    return {
      ok: true,
      invoice_id: `dev_${Date.now()}`,
      invoice_number: `DEV-${Date.now()}`,
      issued_at: new Date().toISOString(),
      due_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const in28 = new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10);

  const body = {
    customer: { id: p.customerId },
    description: p.description || undefined,
    invoiceDate: p.invoiceDate || today,
    dueDate: p.dueDate || in14,
    finalDueDate: p.finalDueDate || in28,
    currencyCode: p.currencyCode || "ISK",
    createClaim: p.createClaim ?? true,
    createElectronicInvoice: p.createElectronicInvoice ?? true,
    sendEmail: p.sendEmail ?? true,
    reference: p.reference || undefined,
    lines: p.lines,
  };

  const res = await paydayFetch("/invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { ok: false, error: `invoice_http_${res.status}`, raw: res.json ?? res.text };
  }

  const j = (res.json ?? {}) as Record<string, unknown>;
  const nested = (j.data ?? {}) as Record<string, unknown>;
  const invoice = { ...nested, ...j };
  const invoiceId = (invoice.id || invoice.invoiceId) as string | undefined;
  const invoiceNumber = (invoice.number || invoice.invoiceNumber) as string | undefined;
  const issued = (invoice.invoiceDate || invoice.issuedAt) as string | undefined;
  const due = (invoice.dueDate || invoice.dueAt) as string | undefined;
  const finalDue = (invoice.finalDueDate || invoice.finalDueAt) as string | undefined;

  return {
    ok: true,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    issued_at: issued,
    due_at: due,
    final_due_at: finalDue,
    raw: res.json,
  };
}

// ─── PDF URL builder ────────────────────────────────────────────────────────

export function paydayPdfUrl(invoiceId: string): string {
  // The PDF endpoint returns a binary; callers should download it server-side
  // if they want to store it. We expose the URL for staff links to it.
  return `${PAYDAY_BASE_URL}/invoices/${invoiceId}/pdf`;
}

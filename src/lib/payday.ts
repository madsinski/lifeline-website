import { supabaseAdmin } from "./supabase-admin";

const PAYDAY_BASE_URL = process.env.PAYDAY_BASE_URL || "https://api.payday.is";
const PAYDAY_CLIENT_ID = process.env.PAYDAY_CLIENT_ID;
const PAYDAY_CLIENT_SECRET = process.env.PAYDAY_CLIENT_SECRET;

const HEADERS_BASE: Record<string, string> = {
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

export async function getToken(): Promise<string | null> {
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

/** Raw fetch — returns the native Response (for binary endpoints like PDF) */
export async function paydayFetchRaw(path: string): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error("no_payday_token");
  return fetch(`${PAYDAY_BASE_URL}${path}`, {
    headers: { ...HEADERS_BASE, Authorization: `Bearer ${token}` },
  });
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

  // Strip dashes/spaces from kennitala — PayDay expects 10 digits
  const cleanKt = args.kennitala.replace(/[-\s]/g, "");

  const body = {
    ssn: cleanKt,
    email: args.email || undefined,
    language: "is",
    name: args.name,
    sendElectronicInvoices: false,
    finalDueDateDefaultDaysAfter: 14,
  };

  console.log("[payday] creating customer", { name: args.name, ssn: cleanKt.slice(0, 4) + "...", email: args.email, baseUrl: PAYDAY_BASE_URL });

  const res = await paydayFetch("/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[payday] customer create failed", res.status, JSON.stringify(res.json ?? res.text));
    // A common failure mode is "customer already exists with this ssn".
    // Try looking up by SSN.
    const lookupRes = await paydayFetch(`/customers/number/${cleanKt}`);
    if (lookupRes.ok && lookupRes.json) {
      const match = lookupRes.json as { id?: string; ssn?: string };
      if (match?.id) {
        console.log("[payday] found existing customer", match.id);
        await supabaseAdmin.from("companies").update({ payday_customer_id: match.id }).eq("id", args.companyId);
        return { ok: true, customer_id: match.id };
      }
    }
    return { ok: false, error: `customer_create_http_${res.status}`, raw: res.json ?? res.text };
  }

  // PayDay returns no body on customer create — look up by SSN to get the ID
  let customerId: string | undefined;
  const j = res.json as { id?: string; data?: { id?: string } } | null;
  customerId = j?.id || j?.data?.id;

  if (!customerId) {
    // Fetch by kennitala: GET /customers/number/:ssn
    const lookupRes = await paydayFetch(`/customers/number/${cleanKt}`);
    if (lookupRes.ok && lookupRes.json) {
      const lookup = lookupRes.json as { id?: string };
      customerId = lookup.id;
    }
  }

  if (!customerId) {
    // Fallback: search all customers
    const searchRes = await paydayFetch(`/customers?perpage=100&page=1`);
    if (searchRes.ok && searchRes.json) {
      const list = (searchRes.json as { customers?: { id: string; ssn: string }[] }).customers || [];
      const match = list.find((c) => c.ssn === cleanKt);
      customerId = match?.id;
    }
  }

  if (!customerId) {
    return { ok: false, error: "customer_create_no_id", raw: res.json ?? "Created OK but could not retrieve customer ID" };
  }

  console.log("[payday] customer created/found", customerId);
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

  const body = {
    customer: { id: p.customerId },
    description: p.description || undefined,
    invoiceDate: p.invoiceDate || today,
    dueDate: p.dueDate || in14,
    finalDueDate: p.finalDueDate || in14,
    currencyCode: p.currencyCode || "ISK",
    createClaim: p.createClaim ?? true,
    createElectronicInvoice: p.createElectronicInvoice ?? true,
    sendEmail: p.sendEmail ?? true,
    reference: p.reference || undefined,
    lines: p.lines,
  };

  let res = await paydayFetch("/invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Error 21018: customer does not accept electronic invoices — retry without
  if (!res.ok) {
    const errCode = (res.json as any)?.errorCode ?? (res.json as any)?.code ?? "";
    if (String(errCode) === "21018" || JSON.stringify(res.json).includes("21018")) {
      console.warn("[payday] customer does not accept e-invoices, retrying without createElectronicInvoice");
      body.createElectronicInvoice = false;
      res = await paydayFetch("/invoices", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
  }

  if (!res.ok) {
    console.error("[payday] invoice create failed", res.status, JSON.stringify(res.json ?? res.text));
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

// ─── Invoice status sync ───────────────────────────────────────────────────

export async function syncInvoiceStatuses(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  // Get all local invoices that aren't terminal (paid/cancelled)
  const { data: pending } = await supabaseAdmin
    .from("company_invoices")
    .select("id, payday_invoice_id, status")
    .not("status", "in", '("paid","cancelled")')
    .not("payday_invoice_id", "is", null);

  if (!pending || pending.length === 0) return { synced: 0, errors: [] };

  for (const inv of pending) {
    try {
      const res = await paydayFetch(`/invoices/${inv.payday_invoice_id}`);
      if (!res.ok) { errors.push(`${inv.id}: fetch failed (${res.status})`); continue; }
      const j = res.json as { status?: string; paidDate?: string; cancelledDate?: string } | null;
      if (!j?.status) continue;

      const paydayStatus = j.status.toLowerCase(); // DRAFT, SENT, PAID, CANCELLED, CREDIT, DELETED
      let newStatus: string | null = null;
      if (paydayStatus === "paid" && inv.status !== "paid") newStatus = "paid";
      else if (paydayStatus === "cancelled" && inv.status !== "cancelled") newStatus = "cancelled";
      else if (paydayStatus === "sent" && inv.status === "draft") newStatus = "sent";

      if (newStatus) {
        await supabaseAdmin.from("company_invoices").update({
          status: newStatus,
          ...(j.paidDate ? { paid_at: j.paidDate } : {}),
        }).eq("id", inv.id);

        // Also update the payments ledger
        await supabaseAdmin.from("payments").update({
          status: newStatus === "paid" ? "succeeded" : newStatus === "cancelled" ? "refunded" : "pending",
          ...(j.paidDate ? { paid_at: j.paidDate } : {}),
        }).eq("related_type", "company_invoice").eq("related_id", inv.id);

        synced++;
      }
    } catch (e) {
      errors.push(`${inv.id}: ${(e as Error).message}`);
    }
  }

  return { synced, errors };
}

// ─── PDF URL builder ────────────────────────────────────────────────────────

export function paydayPdfUrl(invoiceId: string): string {
  // Route through our API proxy which adds the Bearer token
  return `/api/admin/invoices/${invoiceId}/pdf`;
}

// ─── Import a company's invoices from PayDay ─────────────────────────────────
// Pulls every invoice for the company's PayDay customer (incl. ones made
// directly in PayDay), upserts into company_invoices by payday_invoice_id, and
// mirrors each into the payments ledger so it shows on the Payments page too.

const PD_BASE = process.env.PAYDAY_BASE_URL || "https://api.payday.is";

function mapInvoiceStatus(s: string | undefined): string {
  const u = (s || "").toUpperCase();
  if (u === "PAID") return "paid";
  if (u === "CANCELLED" || u === "CREDIT" || u === "DELETED") return "cancelled";
  if (u === "DRAFT") return "draft";
  return "sent";
}
const toPaymentStatus = (s: string) => (s === "paid" ? "succeeded" : s === "cancelled" ? "refunded" : "pending");


const PD_HEADERS = async () => {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : null;
};

type PInv = { id: string; number?: string | number; status?: string; invoiceDate?: string; dueDate?: string; paidDate?: string; amountIncludingVat?: number; amountExcludingVat?: number; currencyCode?: string; customer?: { id?: string; name?: string } };

// Distinct PayDay customers that have at least one invoice.
export async function listPaydayCustomers(): Promise<{ ok: boolean; reason?: string; customers: Array<{ id: string; name: string }> }> {
  const headers = await PD_HEADERS();
  if (!headers) return { ok: false, reason: "payday_auth_failed", customers: [] };
  const map = new Map<string, string>();
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`${PD_BASE}/invoices?perPage=100&page=${page}`, { headers });
    if (!res.ok) return { ok: false, reason: `payday_list_http_${res.status}`, customers: [] };
    const json = await res.json().catch(() => null) as { invoices?: PInv[]; pages?: number } | null;
    for (const inv of json?.invoices || []) if (inv.customer?.id) map.set(inv.customer.id, inv.customer.name || "");
    if (!json?.pages || page >= json.pages) break;
  }
  return { ok: true, customers: [...map.entries()].map(([id, name]) => ({ id, name })) };
}

// A PayDay customer's kennitala (ssn), to match against a company.
export async function getPaydayCustomerSsn(customerId: string): Promise<string | null> {
  const headers = await PD_HEADERS();
  if (!headers) return null;
  const res = await fetch(`${PD_BASE}/customers/${customerId}`, { headers });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null) as { ssn?: string } | null;
  return j?.ssn || null;
}

// Import (and reconcile) one company's PayDay invoices. Idempotent and
// self-healing: matches existing rows by payday_invoice_id, prunes local
// payday-sourced rows that no longer exist in PayDay (stale duplicates),
// and keeps exactly one payments-ledger row per invoice.
export async function importCompanyInvoicesFromPayday(
  companyId: string,
  createdBy: string,
): Promise<{ ok: boolean; reason?: string; imported: number; updated: number; total: number }> {
  const { data: company } = await supabaseAdmin
    .from("companies").select("name, payday_customer_id").eq("id", companyId).maybeSingle();
  const customerId = company?.payday_customer_id as string | null;
  if (!customerId) return { ok: false, reason: "no_customer", imported: 0, updated: 0, total: 0 };

  const headers = await PD_HEADERS();
  if (!headers) return { ok: false, reason: "payday_auth_failed", imported: 0, updated: 0, total: 0 };

  const invoices: PInv[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${PD_BASE}/invoices?customerId=${customerId}&perPage=100&page=${page}`, { headers });
    if (!res.ok) return { ok: false, reason: `payday_list_http_${res.status}`, imported: 0, updated: 0, total: 0 };
    const json = await res.json().catch(() => null) as { invoices?: PInv[]; pages?: number } | null;
    invoices.push(...(json?.invoices || []).filter((x) => x.customer?.id === customerId));
    if (!json?.pages || page >= json.pages) break;
  }
  const paydaySet = new Set(invoices.map((i) => i.id));

  // Existing local rows for this company (only payday-sourced ones are
  // candidates for matching/pruning; external attached PDFs are left alone).
  const { data: existing } = await supabaseAdmin
    .from("company_invoices")
    .select("id, payday_invoice_id, pdf_storage_path")
    .eq("company_id", companyId);
  const rows = existing || [];
  const byPayday = new Map(rows.filter((r) => r.payday_invoice_id).map((r) => [r.payday_invoice_id as string, r.id as string]));

  let imported = 0, updated = 0;
  const keptInvoiceIds: string[] = [];
  for (const inv of invoices) {
    const total = Math.round(inv.amountIncludingVat ?? 0);
    const net = Math.round(inv.amountExcludingVat ?? inv.amountIncludingVat ?? 0);
    const status = mapInvoiceStatus(inv.status);
    const paidAt = inv.paidDate ? new Date(inv.paidDate).toISOString() : null;
    const number = inv.number != null ? String(inv.number) : null;
    const row = {
      status, currency: inv.currencyCode || "ISK", amount_net: net, amount_total: total,
      issued_at: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString() : new Date().toISOString(),
      due_at: inv.dueDate ? new Date(inv.dueDate).toISOString() : null,
      paid_at: paidAt, payday_invoice_number: number, pdf_url: paydayPdfUrl(inv.id),
    };
    let localId = byPayday.get(inv.id);
    if (localId) {
      await supabaseAdmin.from("company_invoices").update(row).eq("id", localId);
      updated++;
    } else {
      const { data: ins } = await supabaseAdmin.from("company_invoices")
        .insert({ company_id: companyId, payday_invoice_id: inv.id, created_by: createdBy, ...row })
        .select("id").single();
      localId = ins?.id;
      if (localId) imported++;
    }
    if (!localId) continue;
    keptInvoiceIds.push(localId);

    // Mirror into payments, de-duping any prior rows for this invoice
    // (website mirror keyed by the payday id, or an earlier import).
    const { data: prior } = await supabaseAdmin
      .from("payments")
      .select("id, related_id, provider_reference")
      .eq("provider", "payday").eq("owner_company_id", companyId);
    const refs = new Set([localId, inv.id, number].filter(Boolean) as string[]);
    const matches = (prior || []).filter((p) =>
      (p.related_id && refs.has(p.related_id as string)) || (p.provider_reference && refs.has(p.provider_reference as string)));
    const payFields = {
      owner_type: "company", owner_id: companyId, owner_company_id: companyId,
      owner_company_name: company?.name || null, amount_isk: total, currency: row.currency,
      description: `PayDay invoice ${number || ""}`.trim(), provider: "payday",
      provider_reference: number, status: toPaymentStatus(status),
      related_type: "company_invoice", related_id: localId, paid_at: paidAt, pdf_url: row.pdf_url,
    };
    if (matches.length === 0) {
      await supabaseAdmin.from("payments").insert(payFields);
    } else {
      await supabaseAdmin.from("payments").update(payFields).eq("id", matches[0].id as string);
      const extra = matches.slice(1).map((p) => p.id as string);
      if (extra.length) await supabaseAdmin.from("payments").delete().in("id", extra);
    }
  }

  // Prune stale payday-sourced rows that no longer exist in PayDay
  // (the source of the duplicate-invoice problem), plus their payments.
  const orphanIds = rows
    .filter((r) => r.payday_invoice_id && !paydaySet.has(r.payday_invoice_id as string) && !r.pdf_storage_path)
    .map((r) => r.id as string);
  if (orphanIds.length) {
    await supabaseAdmin.from("payments").delete().in("related_id", orphanIds).eq("provider", "payday");
    await supabaseAdmin.from("company_invoices").delete().in("id", orphanIds);
  }

  return { ok: true, imported, updated, total: invoices.length };
}

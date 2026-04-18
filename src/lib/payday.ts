const PAYDAY_API_KEY = process.env.PAYDAY_API_KEY;
const PAYDAY_BASE_URL = process.env.PAYDAY_BASE_URL || "https://api.payday.is";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;   // ISK
  vat_rate: number;     // percent
}

export interface InvoicePayload {
  customer_kennitala: string;   // Icelandic company ID (digits only)
  customer_name: string;
  customer_email?: string | null;
  currency: string;             // "ISK"
  due_in_days?: number;         // default 14
  reference?: string | null;    // internal reference for bookkeeping
  lines: InvoiceLineItem[];
}

export interface InvoiceResult {
  ok: boolean;
  invoice_id?: string;
  invoice_number?: string;
  pdf_url?: string;
  issued_at?: string;
  due_at?: string;
  error?: string;
  raw?: unknown;
}

/**
 * Build the body PayDay expects for creating an invoice. The exact shape is
 * tightened once we have live PayDay API access; for now we emit a shape that
 * matches most invoicing APIs and rely on PAYDAY_INVOICE_TEMPLATE env var to
 * tweak it if needed.
 */
function buildPaydayBody(p: InvoicePayload): Record<string, unknown> {
  const due = p.due_in_days ?? 14;
  const issued = new Date();
  const dueDate = new Date(issued.getTime() + due * 86_400_000);
  return {
    customer: {
      identifier: p.customer_kennitala,
      name: p.customer_name,
      email: p.customer_email || undefined,
    },
    currency: p.currency,
    issued_at: issued.toISOString().slice(0, 10),
    due_at: dueDate.toISOString().slice(0, 10),
    reference: p.reference || undefined,
    lines: p.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      vat_rate: l.vat_rate,
    })),
  };
}

export async function createPaydayInvoice(p: InvoicePayload): Promise<InvoiceResult> {
  if (!PAYDAY_API_KEY) {
    console.warn("[payday] PAYDAY_API_KEY not set — invoice NOT sent, logging payload instead");
    console.log("[payday] would-be invoice:", JSON.stringify(buildPaydayBody(p), null, 2));
    // Fake an invoice id so the DB can still record something meaningful
    // during development.
    return {
      ok: true,
      invoice_id: `dev_${Date.now()}`,
      invoice_number: `DEV-${Date.now()}`,
      issued_at: new Date().toISOString(),
      due_at: new Date(Date.now() + (p.due_in_days ?? 14) * 86_400_000).toISOString(),
    };
  }
  try {
    const res = await fetch(`${PAYDAY_BASE_URL}/v1/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYDAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPaydayBody(p)),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: `payday_http_${res.status}`, raw: j };
    }
    return {
      ok: true,
      invoice_id: (j?.id || j?.invoice_id || "") as string,
      invoice_number: (j?.number || j?.invoice_number || "") as string,
      pdf_url: (j?.pdf_url || j?.pdf || "") as string,
      issued_at: (j?.issued_at || j?.issued || "") as string,
      due_at: (j?.due_at || j?.due || "") as string,
      raw: j,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

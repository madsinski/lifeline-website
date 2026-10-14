// Put an account back to the state it was in just after signing up.
//
// Iterating on onboarding meant registering a new address for every pass —
// eighteen madsinski+… accounts exist for exactly that reason — and each one
// costs a confirmation email, a mailbox round trip and a fresh password. This
// rewinds instead: the welcome deck, the legacy wizard flags, the accepted
// terms and the consent rows all go back to empty, so the next sign-in walks
// the whole flow again on the same login.
//
// POST  (no body)  -> { ok, cleared }
//
// Who may call it, and why it is not simply open:
//
//   • active staff — they are already trusted with every client record
//   • an address containing "+" — a plus-alias is a test address by
//     convention, and this is the only way to iterate without a staff
//     session on a phone
//
// Everyone else is refused. Clearing terms_accepted_at on a real client
// would drop the record of a consent they actually gave, which is a GDPR
// artefact and not ours to discard for convenience. The flow re-collects it
// immediately, but "it gets fixed on the next screen" is not a reason to
// delete a compliance record.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const email = (user.email ?? "").toLowerCase();
  const isTestAlias = email.includes("+");
  const staff = await isAnyActiveStaff(user.id);
  if (!staff && !isTestAlias) {
    return NextResponse.json({
      error: "Þessi aðgerð er fyrir prófunaraðganga (netfang með +) og starfsfólk.",
    }, { status: 403 });
  }

  /* Through the view, as everywhere else that writes to clients: it carries
     the INSTEAD OF trigger, and bypassing it for "just a few flags" is how a
     table ends up with some rows written one way and some the other. */
  const { error } = await supabaseAdmin.from("clients_decrypted").update({
    welcome_seen_at: null,
    onboarding_complete: false,
    onboarding_data: null,
    terms_accepted_at: null,
    terms_version: null,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  /* Consents are rows, not flags — deleted rather than revoked, because a
     revoked consent is a thing that happened and this is a rewind, not a
     withdrawal. */
  const { count } = await supabaseAdmin.from("client_consents")
    .delete({ count: "exact" }).eq("client_id", user.id);

  return NextResponse.json({
    ok: true,
    email,
    cleared: ["welcome_seen_at", "onboarding_complete", "onboarding_data", "terms_accepted_at", "terms_version"],
    consentsDeleted: count ?? 0,
  });
}

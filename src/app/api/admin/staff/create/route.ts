// Create a new staff member with auth.users.id == staff.id from the start.
//
// Existing problem with the invite-team edge function: it created the
// staff row with a fresh UUID and the auth user with a separate UUID,
// which broke any RLS policy using `staff.id = auth.uid()`. This route
// fixes that by creating the auth user first (server-side via the
// admin API), capturing its id, and using that id for the staff row.
//
// Caller must be admin. Returns the created staff row.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const VALID_ROLES = ["coach", "doctor", "nurse", "psychologist", "admin", "lawyer"] as const;
type Role = (typeof VALID_ROLES)[number];

const VALID_EMPLOYMENT = ["salaried", "piece_rate", "contractor", "shareholder"] as const;
type EmploymentType = (typeof VALID_EMPLOYMENT)[number];

interface CreateBody {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  employment_type?: string;
  permissions?: string[];
  send_invite?: boolean;
}

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lifelinehealth.is";

export async function POST(req: Request) {
  let body: CreateBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Validate inputs
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const role = body.role as Role | undefined;
  const employment_type = body.employment_type as EmploymentType | undefined;
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];
  const sendInvite = body.send_invite !== false; // default true

  if (!name || !email) {
    return NextResponse.json({ ok: false, error: "Name and email required" }, { status: 400 });
  }
  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
  }
  if (employment_type && !(VALID_EMPLOYMENT as readonly string[]).includes(employment_type)) {
    return NextResponse.json({ ok: false, error: "Invalid employment type" }, { status: 400 });
  }

  // Verify caller is admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
  if (callerErr || !callerData.user?.email) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }
  const { data: callerStaff } = await supabaseAdmin
    .from("staff")
    .select("role, active")
    .eq("email", callerData.user.email)
    .maybeSingle();
  if (!callerStaff || !callerStaff.active || callerStaff.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin role required" }, { status: 403 });
  }

  // Look up existing auth user by email — if they already exist (e.g.,
  // an existing client being upgraded to staff), reuse their id rather
  // than creating a duplicate.
  let authUserId: string | null = null;
  let authCreated = false;
  try {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
    if (existing) {
      authUserId = existing.id;
    }
  } catch {
    // listUsers may paginate; if not found in first page we try invite below.
  }

  if (!authUserId) {
    // Create the auth user via admin API. This both creates the user
    // and (if redirectTo is set) sends a magic link / invite email.
    if (sendInvite) {
      const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { name, role },
        redirectTo: `${ORIGIN}/admin/login`,
      });
      if (invErr || !inv.user) {
        return NextResponse.json(
          { ok: false, error: `Could not create auth user: ${invErr?.message || "no user returned"}` },
          { status: 500 },
        );
      }
      authUserId = inv.user.id;
      authCreated = true;
    } else {
      // No invite — still create the auth user shell so the staff.id matches.
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name, role },
      });
      if (createErr || !created.user) {
        return NextResponse.json(
          { ok: false, error: `Could not create auth user: ${createErr?.message || "no user returned"}` },
          { status: 500 },
        );
      }
      authUserId = created.user.id;
      authCreated = true;
    }
  }

  // Insert (or upsert) the staff row with id = auth user id.
  const { data: staffRow, error: insErr } = await supabaseAdmin
    .from("staff")
    .upsert(
      {
        id: authUserId,
        name,
        email,
        phone: phone || null,
        role,
        employment_type: employment_type || null,
        permissions,
        active: true,
        invited: sendInvite,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (insErr || !staffRow) {
    // If we created an auth user but staff insert failed, roll back the auth user
    // so we don't leave orphans.
    if (authCreated && authUserId) {
      try { await supabaseAdmin.auth.admin.deleteUser(authUserId); } catch {}
    }
    return NextResponse.json(
      { ok: false, error: `Could not create staff row: ${insErr?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    staff: staffRow,
    invite_sent: sendInvite,
    auth_user_created: authCreated,
  });
}

// POST /api/admin/releases
//
// Registers a new release in the app_releases table. Typically
// called by scripts/release.sh on the developer machine right
// after a git tag is pushed, but can also be triggered from the
// /admin/releases UI for ad-hoc imports / historical backfill.
//
// Optional multipart body part `sbom` (a JSON file) is uploaded
// to the app-releases-sbom Supabase bucket and linked back via
// sbom_storage_path + sbom_sha256.
//
// GET returns a paged list (most recent first) for the admin UI.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_REPOS = ["app", "website"] as const;
const VALID_CHANNELS = ["development", "preview", "production"] as const;
const VALID_PLATFORMS = ["ios", "android", "all", "web"] as const;

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("role, active")
    .eq("email", user.email ?? "")
    .maybeSingle();
  if (!staff?.active || staff.role !== "admin") return null;
  return user;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "admin_access_required" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  let payload: Record<string, string | null> = {};
  let sbomBytes: Buffer | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (k === "sbom" && v instanceof File) {
        const ab = await v.arrayBuffer();
        sbomBytes = Buffer.from(ab);
      } else if (typeof v === "string") {
        payload[k] = v;
      }
    }
  } else {
    payload = (await req.json().catch(() => ({}))) as Record<string, string | null>;
  }

  const repo = String(payload.repo ?? "");
  const version = String(payload.version ?? "").trim();
  const channel = String(payload.channel ?? "preview");
  const platform = (payload.platform ?? null) as string | null;
  const buildNumber = (payload.build_number ?? null) as string | null;
  const gitSha = String(payload.git_sha ?? "").trim();
  const gitTag = (payload.git_tag ?? null) as string | null;
  const gitBranch = (payload.git_branch ?? null) as string | null;
  const releaseNotes = (payload.release_notes ?? null) as string | null;
  const riskAssessment = (payload.risk_assessment ?? null) as string | null;
  const buildArtifactUrl = (payload.build_artifact_url ?? null) as string | null;

  if (!(VALID_REPOS as readonly string[]).includes(repo)) {
    return NextResponse.json({ error: "invalid_repo" }, { status: 400 });
  }
  if (!version) {
    return NextResponse.json({ error: "version_required" }, { status: 400 });
  }
  if (!(VALID_CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  if (platform && !(VALID_PLATFORMS as readonly string[]).includes(platform)) {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }
  if (!gitSha || gitSha.length < 7) {
    return NextResponse.json({ error: "git_sha_required" }, { status: 400 });
  }

  const { data: row, error: insErr } = await supabaseAdmin
    .from("app_releases")
    .insert({
      repo,
      version,
      build_number: buildNumber,
      platform,
      channel,
      git_sha: gitSha,
      git_tag: gitTag,
      git_branch: gitBranch,
      release_notes: releaseNotes,
      risk_assessment: riskAssessment,
      build_artifact_url: buildArtifactUrl,
      released_by: user.id,
      released_by_email: user.email,
    })
    .select("id, released_at")
    .single();

  if (insErr) {
    // 23505 = unique violation. Surface a friendly message — the
    // release helper script can ignore + treat as success.
    if (insErr.code === "23505") {
      return NextResponse.json({ error: "release_already_registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed", detail: insErr.message }, { status: 500 });
  }

  let sbomStoragePath: string | null = null;
  let sbomSha256: string | null = null;

  if (sbomBytes) {
    sbomStoragePath = `${repo}/${row.id}.json`;
    sbomSha256 = sha256Hex(sbomBytes);
    const { error: upErr } = await supabaseAdmin.storage
      .from("app-releases-sbom")
      .upload(sbomStoragePath, sbomBytes, {
        contentType: "application/json",
        upsert: false,
      });
    if (upErr) {
      console.error("[releases] SBOM upload failed:", upErr.message);
      sbomStoragePath = null;
      sbomSha256 = null;
    } else {
      await supabaseAdmin
        .from("app_releases")
        .update({ sbom_storage_path: sbomStoragePath, sbom_sha256: sbomSha256 })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    released_at: row.released_at,
    sbom_storage_path: sbomStoragePath,
    sbom_sha256: sbomSha256,
  });
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "admin_access_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);
  const repo = searchParams.get("repo");

  let q = supabaseAdmin
    .from("app_releases")
    .select("*")
    .order("released_at", { ascending: false })
    .limit(limit);
  if (repo) q = q.eq("repo", repo);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "list_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ releases: data ?? [] });
}

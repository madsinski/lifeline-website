// GET /api/admin/surveys/[id]/email-preview
//
// Renders the survey-invite email with placeholder recipient / URL /
// expiry so the editor can preview the exact email that will go out.
// Read-only; any active staff member who can see the editor can preview.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderSurveyInviteEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;

  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: survey, error } = await supabaseAdmin
    .from("feedback_surveys")
    .select("title_is, estimated_minutes")
    .eq("id", surveyId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!survey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL
    || req.headers.get("origin")
    || "https://www.lifelinehealth.is";

  // ~30 days from now, matching the typical assignment expiry.
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { subject, html, text } = renderSurveyInviteEmail({
    recipientName: "Anna Jónsdóttir",
    surveyTitleIs: survey.title_is,
    estimatedMinutes: survey.estimated_minutes ?? 5,
    surveyUrl: `${origin.replace(/\/$/, "")}/survey/PREVIEW-TOKEN`,
    expiresAt,
  });

  return NextResponse.json({ subject, html, text });
}

// Fræðsla — the courses.
//
// education_courses holds 20 rows. Lessons are NOT a separate table: they
// live in the `modules` jsonb on the course, which is why the app's three
// view states (list → course → lesson) all read from one table.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data } = await supabaseAdmin
    .from("education_courses")
    .select("id, name, description, cover_image_url, difficulty, estimated_duration, modules, category")
    .order("category", { ascending: true });

  return NextResponse.json({
    courses: (data ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      description: (c.description as string) ?? null,
      cover: (c.cover_image_url as string) ?? null,
      difficulty: (c.difficulty as string) ?? null,
      minutes: (c.estimated_duration as number) ?? null,
      category: (c.category as string) ?? null,
      modules: Array.isArray(c.modules) ? (c.modules as unknown[]) : [],
    })),
  });
}

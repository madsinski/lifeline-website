import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email;
    const rawSource = typeof body?.source === "string" ? body.source : "coming-soon";
    const source = rawSource.slice(0, 40) || "coming-soon";
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const { error } = await supabase
      .from("email_subscribers")
      .insert({
        email: normalized,
        source,
        user_agent: req.headers.get("user-agent") || null,
      });

    if (error) {
      if (error.code === "23505") {
        // Unique violation — treat as success; already subscribed
        return NextResponse.json({ ok: true, existing: true });
      }
      console.error("subscribe error", error);
      return NextResponse.json({ error: "Could not subscribe. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

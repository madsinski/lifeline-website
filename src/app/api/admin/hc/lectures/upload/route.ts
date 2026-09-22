// Image / video upload for lectures (slide images, thumbnails, short mp4).
// Public bucket `hc-lecture-media` — lecture content is not personal data.
// POST multipart { file } → { url }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 200 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|application\/pdf)$/;

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Skrá vantar." }, { status: 400 });
  if (!ALLOWED.test(file.type)) return NextResponse.json({ error: "Aðeins myndir, mp4/webm eða PDF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Skráin er of stór." }, { status: 400 });
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${safe}`;
  const { error } = await supabaseAdmin.storage
    .from("hc-lecture-media")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = supabaseAdmin.storage.from("hc-lecture-media").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}

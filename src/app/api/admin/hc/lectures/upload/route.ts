// Image / video upload for lectures (slide images, thumbnails, short mp4).
// Public bucket `hc-lecture-media` — lecture content is not personal data.
// POST multipart { file } → { url }
// GET → { items: [{ url, name, kind }] } — the media library: built-in
//       graphics (public/hc-fraedsla) plus everything uploaded here.

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

const BUILT_IN = [
  ["fjorar-stodir.svg", "Fjórar stoðir heilsu"],
  ["ferlid.svg", "Heilsuferðin í átta skrefum"],
  ["svefnhringur.svg", "Svefnlotur yfir nóttina"],
  ["diskurinn.svg", "Diskaaðferðin"],
  ["hreyfing-vika.svg", "Hreyfing: vikan"],
  ["ondun.svg", "Kassaöndun"],
  ["vana-lykkja.svg", "Svona myndast venja"],
];

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const items: { url: string; name: string; kind: "image" | "video" | "pdf"; builtIn?: boolean }[] =
    BUILT_IN.map(([f, name]) => ({ url: `/hc-fraedsla/${f}`, name, kind: "image" as const, builtIn: true }));
  const bucket = supabaseAdmin.storage.from("hc-lecture-media");
  const { data: folders } = await bucket.list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
  for (const f of folders || []) {
    if (f.id) continue; // a file at the root, not a month folder
    const { data: files } = await bucket.list(f.name, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    for (const file of files || []) {
      const path = `${f.name}/${file.name}`;
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      items.push({
        url: bucket.getPublicUrl(path).data.publicUrl,
        name: file.name.replace(/^\d+-/, ""),
        kind: ["mp4", "webm"].includes(ext) ? "video" : ext === "pdf" ? "pdf" : "image",
      });
    }
  }
  return NextResponse.json({ items });
}

// Your own face.
//
// POST  multipart/form-data { file } → uploads and returns { avatar_url }
// DELETE                             → clears it
//
// Stored at avatars/<client id> in the public `avatars` bucket, which the
// app already uses — same path shape, so a photo set here shows up in the
// app and the other way round.
//
// avatar_url carries two shapes in the wild: a storage URL like this one,
// and "avatar:<emoji>" from the app's emoji picker. This endpoint only ever
// writes the URL form; readers handle both.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

const BUCKET = "avatars";
/** 6 MB. A phone camera JPEG is 2–4; anything much past that is a mistake. */
const MAX = 6 * 1024 * 1024;
const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: "too_big", message: "Myndin er of stór. Hámark er 6 MB." }, { status: 413 });
  }
  /*
   * Trust the bytes, not the name.
   *
   * A phone can hand over a HEIC with an image/* type the browser made up,
   * so the type is checked but an unknown one is not fatal — what matters
   * is that it is an image at all, which the magic number says.
   */
  const buf = Buffer.from(await file.arrayBuffer());
  const magic = buf.subarray(0, 12);
  const isJpeg = magic[0] === 0xff && magic[1] === 0xd8;
  const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47;
  const isWebp = magic.subarray(0, 4).toString("ascii") === "RIFF" && magic.subarray(8, 12).toString("ascii") === "WEBP";
  const isHeic = magic.subarray(4, 8).toString("ascii") === "ftyp";
  if (!isJpeg && !isPng && !isWebp && !isHeic) {
    return NextResponse.json({ error: "not_an_image", message: "Þetta er ekki mynd sem við þekkjum." }, { status: 415 });
  }
  const type = OK_TYPES.has(file.type) ? file.type : isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";

  const path = user.id;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  /*
   * A cache-buster on the stored value.
   *
   * The path never changes, so replacing the photo would otherwise leave
   * every browser and CDN showing the old one. The query string makes each
   * save a new URL.
   */
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await supabaseAdmin
    .from("clients").update({ avatar_url: url }).eq("id", user.id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ avatar_url: url });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  await supabaseAdmin.storage.from(BUCKET).remove([user.id]).catch(() => {});
  const { error } = await supabaseAdmin
    .from("clients").update({ avatar_url: null }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

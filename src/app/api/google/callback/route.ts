// Google sends people back here after consent (customers and workstation
// users share one OAuth client and this one redirect URI; the signed state
// says which). Tokens are exchanged, the dedicated calendar is created and
// filled — the fill runs after the redirect so nobody stares at a blank tab.
// Must be registered verbatim as an "Authorized redirect URI" on the client.

import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as G from "@/lib/google-calendar";
import { completeConnect, recordConnectError, syncOwner } from "@/lib/hc/calendar-sync";

export const runtime = "nodejs";

function back(req: Request, path: string, params: Record<string, string>) {
  const url = new URL(path || "/", new URL(req.url).origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const state = G.verifyState(q.get("state") ?? "");
  if (!state) return back(req, "/", { google: "state" });

  const home = state.returnTo || (state.kind === "worker" ? "/vinnustod" : "/account/heilsuferd");
  if (state.kind === "worker") {
    const { data } = await supabaseAdmin.from("hc_workers").select("id, active").eq("id", state.ownerId).maybeSingle();
    if (!data?.active) return back(req, "/vinnustod", { google: "notfound" });
  } else {
    const { data } = await supabaseAdmin.auth.admin.getUserById(state.ownerId);
    if (!data?.user) return back(req, "/account/heilsuferd", { google: "notfound" });
  }

  if (q.get("error")) return back(req, home, { google: "cancelled" });
  const code = q.get("code");
  if (!code) return back(req, home, { google: "nocode" });

  try {
    const outcome = await completeConnect(state.kind, state.ownerId, code);
    if (outcome === "norefresh") return back(req, home, { google: "norefresh" });
    after(async () => { await syncOwner(state.kind, state.ownerId); });
    return back(req, home, { google: "connected" });
  } catch (e) {
    await recordConnectError(state.kind, state.ownerId, e instanceof Error ? e.message : String(e));
    return back(req, home, { google: "error" });
  }
}

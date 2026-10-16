"use client";

// Replace a set of rows (an action's exercises, its meals) without the
// window where they are gone.
//
// The editors used to delete every row for the key and then insert the new
// list, both unchecked: a failed or RLS-blocked insert left the action
// empty, and the screen still showed the list as saved. Here the new rows
// go in first, and only once they are confirmed are the old ones deleted by
// id. Writes through the anon client are RLS-checked, and a blocked write
// returns no error and no rows, so each step asks for its rows back.

import { supabase } from "@/lib/supabase";

export type ReplaceResult = { ok: true } | { ok: false; error: string };

export async function replaceRows(
  table: string,
  match: Record<string, string | number>,
  rows: Record<string, unknown>[],
): Promise<ReplaceResult> {
  try {
    let q = supabase.from(table).select("id");
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { data: old, error: readErr } = await q;
    if (readErr) return { ok: false, error: `Ekki tókst að lesa núverandi færslur: ${readErr.message}` };
    const oldIds = (old ?? []).map((r) => (r as { id: string }).id);

    if (rows.length > 0) {
      const { data: inserted, error: insErr } = await supabase.from(table).insert(rows).select("id");
      if (insErr) return { ok: false, error: insErr.message };
      if ((inserted?.length ?? 0) !== rows.length) return { ok: false, error: "engin heimild til að vista" };
    }

    if (oldIds.length > 0) {
      const { data: deleted, error: delErr } = await supabase.from(table).delete().in("id", oldIds).select("id");
      if (delErr || (deleted?.length ?? 0) !== oldIds.length) {
        return { ok: false, error: `Nýju færslurnar vistuðust en þær gömlu voru ekki fjarlægðar (${delErr?.message || "engin heimild til að eyða"}). Endurhladdu síðuna og athugaðu listann.` };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "netvilla" };
  }
}

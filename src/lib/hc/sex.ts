// One place that decides what the stored `sex` value means, so the
// workstation, the reference bands and the client account agree.
// Client-safe.

export type Sex = "m" | "f" | null;

/** "kvk"/"female"/"kona" → f · "kk"/"male"/"karl" → m · anything else → null. */
export function sexOf(raw: string | null | undefined): Sex {
  const v = (raw || "").toLowerCase().trim();
  if (["f", "female", "kona", "kvk", "kvenkyn", "kven"].includes(v)) return "f";
  if (["m", "male", "karl", "kk", "karlkyn"].includes(v)) return "m";
  return null;
}

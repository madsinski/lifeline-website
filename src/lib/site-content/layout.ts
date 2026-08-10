// Shared band-background engine for the marketing page views. Every page uses
// this so section backgrounds ALWAYS alternate white / light-grey by their
// visible position — including after the CMS reorders or hides sections. Dark
// bands (CTA / download / the dark "bang" band) are placed as-is and don't take
// part in the alternation; a wave separator is drawn only between two light
// bands whose colour actually changes (never touching a dark band or the hero).

export const BG_LIGHT = "#ffffff";
export const BG_GREY = "#ecf0f3";
export const BG_DARK = "#111827";

export interface LaidBand {
  id: string;
  bg: string;
  dark: boolean;
  wave: { from: string; to: string } | null;
}

/**
 * @param visible  section ids in display order, already filtered for hidden
 * @param darkIds  ids that render their own dark background (cta/download/bang)
 */
export function layoutBands(visible: string[], darkIds: Set<string>): LaidBand[] {
  // The hero always ends on grey, so the first light band (white) gets a wave.
  let prev = BG_GREY;
  let lightIdx = 0;
  const out: LaidBand[] = [];
  for (const id of visible) {
    if (darkIds.has(id)) {
      out.push({ id, bg: BG_DARK, dark: true, wave: null });
      prev = BG_DARK;
      continue;
    }
    const bg = lightIdx % 2 === 0 ? BG_LIGHT : BG_GREY;
    lightIdx += 1;
    const wave = prev !== BG_DARK && prev !== bg ? { from: prev, to: bg } : null;
    out.push({ id, bg, dark: false, wave });
    prev = bg;
  }
  return out;
}

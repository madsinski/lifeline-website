/*
 * A short two-note chime, synthesised rather than fetched.
 *
 * No asset, no request, a few lines: a notification sound is two sine tones
 * with a fast decay, and shipping an mp3 for that would be a download on a
 * page nobody opened to hear it.
 *
 * It can simply not play, and that is fine. Browsers refuse audio until the
 * person has interacted with the page, so a chime on first load is blocked
 * by design — hence the red pulse, which is the part that always works.
 *
 * Shared, because both sides of the conversation need it: the participant's
 * bell on Í dag and the coach's Skilaboð tab in the workstation.
 */
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // suspended means no gesture has happened yet and the browser will not
    // let this through. Give up quietly rather than leaving a context open.
    if (ctx.state === "suspended") { void ctx.close(); return; }
    [880, 1174.7].forEach((hz, n) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = hz;
      const t = ctx.currentTime + n * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.32);
    });
    setTimeout(() => void ctx.close().catch(() => {}), 1200);
  } catch { /* no audio on this device, or blocked. The pulse carries it. */ }
}

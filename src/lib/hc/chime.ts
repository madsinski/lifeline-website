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
/*
 * Where the per-device sound preference lives.
 *
 * Per device and not per account on purpose: the same coach wants sound at
 * their own desk and silence in a room with a client, and that is a fact
 * about the room, not about them. localStorage also means a shared
 * workstation does not carry one person's choice to the next.
 */
export const SOUND_KEY = "hc-sound";

/** Default on — a notification nobody asked to silence should be audible. */
export function soundOn(): boolean {
  try { return window.localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

/**
 * Play the chime. Returns whether it could play.
 *
 * `fromGesture`: called straight from a click (the "Prófa hljóð" button).
 * Safari creates even a click's AudioContext suspended until resume() is
 * called, so the test button used to do nothing there; with this flag a
 * suspended context is resumed instead of given up on.
 */
export function chime(opts?: { fromGesture?: boolean }): boolean {
  // Checked here rather than at each call site, so turning sound off turns
  // it off everywhere — including anywhere that starts chiming later.
  if (!soundOn()) return false;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    // suspended means no gesture has happened yet and the browser will not
    // let this through. Give up quietly rather than leaving a context open.
    if (ctx.state === "suspended") {
      if (!opts?.fromGesture) { void ctx.close(); return false; }
      void ctx.resume().catch(() => {});
    }
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
    return true;
  } catch { /* no audio on this device, or blocked. The pulse carries it. */ return false; }
}

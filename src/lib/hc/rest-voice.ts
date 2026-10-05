"use client";

// Spoken cues during the rest countdown, ported from the app's restVoice.ts
// (expo-speech) onto the Web Speech API.
//
// The app speaks English — "10 seconds left", "Get ready", "Go". Keeping
// that is not laziness: Icelandic TTS voices exist on almost no desktop
// browser, and an English voice reading "tíu sekúndur eftir" is worse than
// an English voice reading English. So we look for an Icelandic voice, use
// Icelandic when there is one, and fall back to the app's English cues when
// there is not.
//
// Everything is wrapped: speechSynthesis is missing in some browsers, throws
// in others, and getVoices() is empty until the voiceschanged event fires.

const IS_CUES = { ten: "Tíu sekúndur eftir", ready: "Tilbúin", go: "Áfram" };
const EN_CUES = { ten: "10 seconds left", ready: "Get ready", go: "Go" };
export type Cue = keyof typeof EN_CUES;

const KEY = "hc_rest_voice_v1";

export function voiceEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function setVoiceEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ }
}

/** True once the browser admits to having a speech synthesiser. */
export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let voicesWarmed = false;
/**
 * getVoices() is empty until the list loads, so touch it early — the first
 * call is what triggers `voiceschanged` in several browsers.
 */
export function warmVoices() {
  if (voicesWarmed || !speechAvailable()) return;
  voicesWarmed = true;
  try { window.speechSynthesis.getVoices(); } catch { /* ignore */ }
}

function icelandicVoice(): SpeechSynthesisVoice | null {
  try {
    return window.speechSynthesis.getVoices().find((v) => /^is(-|_|$)/i.test(v.lang)) ?? null;
  } catch { return null; }
}

/** Say one cue. Silent and harmless when speech is off or unavailable. */
export function speakCue(cue: Cue) {
  if (!speechAvailable() || !voiceEnabled()) return;
  try {
    const v = icelandicVoice();
    const u = new SpeechSynthesisUtterance(v ? IS_CUES[cue] : EN_CUES[cue]);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
    u.rate = 1.05;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* a cue is never worth throwing over */ }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide } from "@/lib/presentations/types";
import { DECK_CSS } from "./deck-css";
import { DeckDefs, SlideView } from "./SlideView";

function hasBg(s: Slide): boolean {
  return (s.type === "title" || s.type === "closing") && !!s.bg;
}

// Inject the scoped stylesheet once per page.
function DeckStyle() {
  return <style dangerouslySetInnerHTML={{ __html: DECK_CSS }} />;
}

/**
 * A single slide rendered inside a 16:9 container that scales to its parent
 * (container queries do the sizing). Used for the editor's live preview.
 */
export function SlideStage({ slide }: { slide: Slide | null }) {
  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 40px -12px rgba(6,78,59,.25)" }}>
      <DeckStyle />
      <div className="lldeck is-stage">
        <DeckDefs />
        {slide
          ? <section className={`slide ${slide.theme}${hasBg(slide) ? " has-bg" : ""} active`}><SlideView slide={slide} /></section>
          : <section className="slide light active" style={{ display: "grid", placeItems: "center" }}><p style={{ color: "#5b6b66" }}>No slide selected</p></section>}
      </div>
    </div>
  );
}

/**
 * Full presentation mode: fixed full-viewport deck with keyboard / touch
 * navigation, progress bar and presenter notes (N). Pass `onClose` to show a
 * close button (used by the editor preview); omit it for the public route.
 */
export function Deck({ slides, initialIndex = 0, onClose }: { slides: Slide[]; initialIndex?: number; onClose?: () => void }) {
  const [i, setI] = useState(initialIndex);
  const [notesOpen, setNotesOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef(0);
  const total = slides.length;

  const go = useCallback((n: number) => setI((cur) => Math.max(0, Math.min(total - 1, n ?? cur))), [total]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); setI((c) => Math.min(total - 1, c + 1)); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setI((c) => Math.max(0, c - 1)); }
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(total - 1);
      else if (e.key === "n" || e.key === "N") setNotesOpen((v) => !v);
      else if (e.key === "f" || e.key === "F") { toggleFullscreen(); }
      else if (e.key === "Escape" && onClose) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onClose, toggleFullscreen]);

  if (!total) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#06231c", color: "#eafaf3", zIndex: 9999 }}>
        <p>This presentation has no slides yet.</p>
      </div>
    );
  }

  const cur = slides[i];

  return (
    <div
      ref={rootRef}
      className="lldeck"
      style={{ position: "fixed", inset: 0, zIndex: 9999 }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) setI((c) => Math.max(0, Math.min(total - 1, c + (dx < 0 ? 1 : -1))));
      }}
    >
      <DeckStyle />
      <DeckDefs />
      <div className="deck-bar" style={{ width: `${((i + 1) / total) * 100}%` }} />

      {slides.map((s, idx) => (
        <section key={s.id} className={`slide ${s.theme}${hasBg(s) ? " has-bg" : ""}${idx === i ? " active" : idx < i ? " prev" : ""}`}>
          <SlideView slide={s} />
        </section>
      ))}

      <div className="deck-hint">← → / Space · <b>F</b> fullscreen · <b>N</b> notes</div>

      <div className="deck-nav">
        <button aria-label="Previous slide" onClick={() => go(i - 1)}>‹</button>
        <span className="count">{i + 1} / {total}</span>
        <button aria-label="Next slide" onClick={() => go(i + 1)}>›</button>
        <button aria-label="Fullscreen" onClick={toggleFullscreen}>⛶</button>
        {onClose && <button aria-label="Close" onClick={onClose}>✕</button>}
      </div>

      <div className={`deck-notes${notesOpen ? " show" : ""}`}>
        <b>Presenter note · {i + 1} / {total}</b>
        <p>{cur.notes || "—"}</p>
      </div>
    </div>
  );
}

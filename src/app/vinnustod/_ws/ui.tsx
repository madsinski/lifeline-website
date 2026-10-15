"use client";

// Small pieces shared by the home side and the client workspace.

/** Marks a seeded test client. Warn tokens, 11px: readable, not shouting. */
export function TestBadge() {
  return (
    <span className="ml-1 rounded bg-hc-warn-surface px-1.5 py-0.5 align-middle text-[11px] font-bold uppercase text-hc-warn-ink ring-1 ring-hc-warn-ink/20">
      Prufa
    </span>
  );
}

/** Grey blocks where content is about to be, instead of the word "Hleð…". */
export function Shimmer({ rows = 3, label = "Hleð…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`rounded-2xl hc-shimmer ${i === 0 ? "h-24" : "h-14"}`} />
      ))}
    </div>
  );
}

/** A section title on the home side. */
export function Kicker({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="text-xs font-bold uppercase tracking-[0.08em] text-hc-ink-2">{children}</h2>;
}

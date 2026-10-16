// A table that says what it is.
//
// The admin's tables were hand-built <table>s with bare <th>s (no scope, no
// caption), a blank body while loading and another blank body when empty —
// a screen reader heard neither state and a sighted person could not tell
// them apart. This wraps the markup: th scope="col", an optional visually
// hidden caption, a loading row, an empty row, and sideways scroll on a
// phone instead of a squashed column set. Server-safe (no hooks).

import type { ReactNode } from "react";

export interface AdminColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Right-align numbers. */
  align?: "left" | "right";
  className?: string;
}

export function AdminTable<T>({ columns, rows, rowKey, caption, loading = false, empty = "Ekkert að sýna.", onRowClick }: {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Read by screen readers; hidden visually. */
  caption?: string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const span = columns.length;
  return (
    <div className="overflow-x-auto rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-slate-200">
      <table className="min-w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-hc-sunken">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col"
                className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-hc-ink-2 ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hc-hairline" aria-busy={loading || undefined}>
          {loading ? (
            <tr><td colSpan={span} className="px-4 py-6 text-center text-hc-ink-3" role="status">Hleð…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={span} className="px-4 py-6 text-center text-hc-ink-3">{empty}</td></tr>
          ) : rows.map((r) => (
            <tr key={rowKey(r)}
              className={onRowClick ? "cursor-pointer hover:bg-hc-brand-surface/50" : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 text-hc-ink ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

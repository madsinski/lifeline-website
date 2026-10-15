// Which subscription row "counts", shared by the server and the browser.
//
// Cancelling (DELETE /api/hc/subscribe) sets status 'cancelled' and leaves
// current_period_end alone: the period that was paid for still runs, as
// söluskilmálar section 6 promises. So a cancelled row whose period has not
// ended is still a subscription — for access, and for what the account
// screens show — just one that will not renew.
//
// No server imports here: useAccountData reads the table with the anon
// client and needs the same rule.

export interface SubLike {
  status: string | null;
  current_period_end: string | null;
}

/** Cancelled, but the paid period has not ended yet. */
export function cancelledButRunning(s: SubLike | null | undefined, now = Date.now()): boolean {
  if (!s || s.status !== "cancelled" || !s.current_period_end) return false;
  const end = Date.parse(s.current_period_end);
  return Number.isFinite(end) && end > now;
}

/** Live: active, or cancelled with time still left on it. */
export function isRunning(s: SubLike | null | undefined, now = Date.now()): boolean {
  return !!s && (s.status === "active" || cancelledButRunning(s, now));
}

/**
 * From rows newest-first: the active one, else a cancelled one still running.
 * An active row wins over a cancelled one, whatever their order.
 */
export function pickCurrent<T extends SubLike>(rows: T[] | null | undefined, now = Date.now()): T | null {
  const list = rows ?? [];
  return list.find((r) => r.status === "active") ?? list.find((r) => cancelledButRunning(r, now)) ?? null;
}

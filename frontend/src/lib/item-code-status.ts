// Shared status rules for community item codes, used by the public /codes page
// and the admin moderation tab so the two can never disagree.

export type CodeStatus = "active" | "scheduled" | "expired";

export type CodeWindow = {
  start_date: string | null;
  expire_date: string | null;
};

const DAY_MS = 86400000;

// Dates are stored as an instant at local midnight of the chosen day, but a
// user reads "Expire Date: Jul 23" as "usable through Jul 23" — so status is
// compared at day granularity, not against the raw instant. Without this a code
// reads Expired for the whole of the day it is supposed to still work.
export function dayStart(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayEnd(iso: string): number {
  return dayStart(iso) + DAY_MS - 1;
}

/**
 * Status as of `now` (the viewer's clock). Expired wins over Scheduled: a code
 * whose window has already closed is expired regardless of when it was meant
 * to start.
 */
export function statusOf(c: CodeWindow, now: number = Date.now()): CodeStatus {
  if (c.expire_date && dayEnd(c.expire_date) < now) return "expired";
  if (c.start_date && dayStart(c.start_date) > now) return "scheduled";
  return "active";
}

/**
 * Wire format between the run counter and its OBS overlay.
 *
 * OBS renders a browser source in its own embedded Chromium, a separate browser
 * from the one running the counter, so nothing local — localStorage,
 * BroadcastChannel, SharedWorker — can carry the count across. It has to go over
 * the network, and a Supabase Realtime broadcast channel is the cheapest route:
 * no table, no backend endpoint, and the client is already a dependency.
 *
 * The channel name is the only secret. Anyone holding it can read the count (and
 * could push a fake one), which is why the counter page can roll it.
 */

export type OverlayState = {
  count: number;
  /** When the most recent run was counted, epoch ms. */
  lastAt: number | null;
  /** Sender clock, so a receiver can tell a fresh message from a stale one. */
  at: number;
};

export const OVERLAY_EVENT = 'state';

export function overlayChannel(token: string) {
  return `dgn-runs-${token}`;
}

/**
 * How often the counter re-sends its state even when nothing changed. Broadcast
 * carries no history, so an overlay that starts (or reconnects, or comes back
 * from a scene switch) after the last run would otherwise sit blank until the
 * next one. It doubles as the liveness signal.
 */
export const OVERLAY_BEAT_MS = 5000;

/** No word from the counter for this long means the tab is gone or asleep. */
export const OVERLAY_STALE_MS = 20000;

export function newOverlayToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

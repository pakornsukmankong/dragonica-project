/**
 * Whole-frame banner search, off the main thread.
 *
 * Two jobs, because both are things a background tab is bad at:
 *
 *  - `scan`  — the search is ~10^8 operations, which visibly froze the page
 *              when it ran between video frames.
 *  - `clock` — a hidden tab has its timers clamped (and eventually throttled
 *              to roughly once a minute), which would silently stop counting
 *              the moment the user alt-tabs into the game. A worker timer is
 *              one of the three clocks the page samples from; see the page for
 *              the others and for the watchdog that reports the rate actually
 *              achieved.
 */

import { buildTemplate, searchGray, type Template } from './detector';

type ScanMsg = {
  type: 'scan';
  seq: number;
  gray: ArrayBuffer;
  sw: number;
  sh: number;
  cutoff: number;
};
type ClockMsg = { type: 'clock'; ms: number };
type InMsg = ScanMsg | ClockMsg;

// tsconfig only pulls in lib.dom, so the worker global is typed to the two
// members used here rather than to DedicatedWorkerGlobalScope.
const ctx = self as unknown as {
  addEventListener(t: 'message', l: (e: MessageEvent<InMsg>) => void): void;
  postMessage(m: unknown): void;
};

let tpl: Template | null = null;
let clock: ReturnType<typeof setInterval> | null = null;

ctx.addEventListener('message', (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  if (msg.type === 'clock') {
    if (clock) clearInterval(clock);
    clock = msg.ms > 0 ? setInterval(() => ctx.postMessage({ type: 'tick' }), msg.ms) : null;
    return;
  }

  if (msg.type === 'scan') {
    // Built lazily so constructing the worker stays cheap.
    tpl ??= buildTemplate();
    const found = searchGray(
      new Uint8Array(msg.gray),
      msg.sw,
      msg.sh,
      msg.cutoff,
      tpl,
    );
    ctx.postMessage({ type: 'scan', seq: msg.seq, found });
  }
});

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MASK_H,
  MASK_N,
  MASK_W,
  SEARCH_W,
  buildTemplate,
  scoreMask,
  searchGray,
  toGray,
  type Region,
} from './detector';

/**
 * Internal, unlisted experiment: count dungeon runs by watching the game window.
 *
 * Purely passive — it reads pixels from a screen share the user starts and never
 * touches the game. Reached by URL only (no nav entry); /grind/* is already
 * login-gated by middleware and disallowed in robots.txt.
 */

// Where "MISSION START" sits, measured off a 1920x1080 capture of a real run
// (x680 y175, 470x180). Only a starting box for the overlay: the real one is
// found by searching the frame, since the game usually sits in a window.
const DEFAULT_REGION: Region = { x: 35.4, y: 16.2, w: 24.5, h: 16.7 };

// Brightness at which a pixel counts as lit. The template was built at this
// value, so changing it in the UI trades recall against false positives.
//
// 140 rather than something brighter because "START" is rendered in orange-gold,
// which has a much lower luma than the white "MISSION": at 190 the darker "RT"
// dropped out and the template kept only "MISSION STA". The fuller template also
// survives the blur that comes with capturing a small game window.
const DEFAULT_CUTOFF = 140;

// Across fullscreen and three simulated window sizes the banner scores 0.79-0.91
// while the best false match on town, combat and result frames reaches 0.43, so
// the default sits between the two with room on each side.
const DEFAULT_MIN_SCORE = 0.6;

// Shortest allowed gap between two counted runs. This is now only a backstop —
// double-counting is prevented by the release rule below, not by a timer — so it
// can be short enough that a fast party clearing in under a minute still counts.
const DEFAULT_MIN_GAP = 10;

// Minimum interval between samples. The banner holds for ~2s, so this leaves 4-5
// chances to catch each one.
const SAMPLE_MS = 400;

// A run is counted only after this many consecutive samples clear the threshold,
// so one fluke frame cannot invent a run.
const CONFIRM_FRAMES = 2;

// ...and the next run cannot be counted until the score has fallen back below
// this fraction of the threshold, i.e. until the banner has actually gone away.
// Hysteresis rather than a long cooldown: a cooldown long enough to cover one
// banner also swallows genuinely short runs.
const RELEASE_RATIO = 0.7;

// A gap longer than this between samples means a banner could have come and gone
// unseen — almost always a throttled background tab.
const GAP_WARN_MS = 2500;

const LS_REGION = 'dgn-auto-region';
const LS_TUNING = 'dgn-auto-tuning';
const LS_RUNS = 'dgn-auto-runs';
const LS_LOCKED_LEGACY = 'dgn-auto-locked';

// Bumped whenever the defaults above change meaningfully. Saved tuning from an
// older version is discarded rather than applied: a stored cutoff of 190 would
// silently clip "START" again, and a stored 60s cooldown would now block short
// runs, on exactly the machines that had already run the old build.
const TUNING_VERSION = 3;

type Run = { id: number; at: number; manual?: boolean };

function validRegion(v: unknown): Region | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const out = {} as Region;
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    const n = r[k];
    // A NaN or out-of-range box makes drawImage throw on every single frame.
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)
      return null;
    out[k] = n;
  }
  return out.w > 0 && out.h > 0 ? out : null;
}

function validRuns(v: unknown): Run[] | null {
  if (!Array.isArray(v)) return null;
  const out: Run[] = [];
  for (const r of v) {
    if (
      r &&
      typeof r === 'object' &&
      typeof (r as Run).id === 'number' &&
      typeof (r as Run).at === 'number' &&
      Number.isFinite((r as Run).at)
    )
      out.push({ id: (r as Run).id, at: (r as Run).at, manual: !!(r as Run).manual });
  }
  return out;
}

export default function AutoCountPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<HTMLCanvasElement>(null); // colour crop preview
  const maskRef = useRef<HTMLCanvasElement>(null); // binarised preview
  const tplRef = useRef<HTMLCanvasElement>(null); // template, for aligning
  const workRef = useRef<HTMLCanvasElement | null>(null); // offscreen sampler
  const scanRef = useRef<HTMLCanvasElement | null>(null); // offscreen whole-frame
  const grayRef = useRef(new Uint8Array(MASK_N));
  const idRef = useRef(0);

  const [running, setRunning] = useState(false);
  // Until the banner has been found once, the region is a guess; after that the
  // box is pinned and only the cheap fixed-region check runs.
  const [locked, setLocked] = useState(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [cutoff, setCutoff] = useState(DEFAULT_CUTOFF);
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);
  const [minGap, setMinGap] = useState(DEFAULT_MIN_GAP);
  const [live, setLive] = useState(0);
  // Highest score seen since the counter was reset — a run that only just clears
  // the threshold looks identical to a solid one without this.
  const [peak, setPeak] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [rate, setRate] = useState(0); // samples/second actually achieved
  const [maxGap, setMaxGap] = useState(0); // longest blind spot, ms
  const [workerDown, setWorkerDown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Persisting before the restore below has landed would write the empty
  // initial state over the saved one.
  const [hydrated, setHydrated] = useState(false);

  const count = runs.length;

  const tpl = useMemo(() => buildTemplate(), []);

  // Config the sampling loop reads without being torn down and rebuilt every
  // time a slider moves.
  const cfgRef = useRef({ cutoff, minScore, minGap });
  const regionRef = useRef(region);
  const lockedRef = useRef(locked);
  useEffect(() => {
    cfgRef.current = { cutoff, minScore, minGap };
  }, [cutoff, minScore, minGap]);
  useEffect(() => {
    regionRef.current = region;
  }, [region]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // Restore from the last session. This has to run in an effect rather than a
  // lazy state initialiser: localStorage does not exist during the server
  // render, and seeding state from it there would desync hydration.
  //
  // `locked` is deliberately not restored — the game window may have moved since
  // the tab was closed, and the only way to know is to find the banner again.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot restore on mount */
    try {
      localStorage.removeItem(LS_LOCKED_LEGACY);
      const r = validRegion(JSON.parse(localStorage.getItem(LS_REGION) ?? 'null'));
      if (r) setRegion(r);
      const saved = validRuns(JSON.parse(localStorage.getItem(LS_RUNS) ?? 'null'));
      if (saved?.length) {
        setRuns(saved);
        idRef.current = Math.max(...saved.map((x) => x.id));
      }
      const t = JSON.parse(localStorage.getItem(LS_TUNING) ?? 'null');
      if (t && t.v === TUNING_VERSION) {
        if (typeof t.cutoff === 'number') setCutoff(t.cutoff);
        if (typeof t.minScore === 'number') setMinScore(t.minScore);
        if (typeof t.minGap === 'number') setMinGap(t.minGap);
      }
    } catch {
      // corrupt or unavailable storage just means "start fresh"
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_REGION, JSON.stringify(region));
  }, [hydrated, region]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_RUNS, JSON.stringify(runs));
  }, [hydrated, runs]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(
        LS_TUNING,
        JSON.stringify({ v: TUNING_VERSION, cutoff, minScore, minGap }),
      );
  }, [hydrated, cutoff, minScore, minGap]);

  // Paint the template once so the region box can be lined up by eye.
  useEffect(() => {
    const c = tplRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const img = ctx.createImageData(MASK_W, MASK_H);
    for (let i = 0; i < MASK_N; i++) {
      img.data[i * 4] = tpl.on.data[i] ? 255 : 0;
      img.data[i * 4 + 1] = tpl.on.data[i] ? 190 : 0;
      img.data[i * 4 + 2] = 0;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [tpl]);

  const addRun = useCallback((manual = false) => {
    // The id is taken before the updater runs: React may invoke an updater more
    // than once, and doing this inside it duplicated history entries.
    const id = ++idRef.current;
    const at = Date.now();
    setRuns((r) => [...r, { id, at, manual }]);
  }, []);

  const resetCounter = () => {
    setRuns([]);
    setPeak(0);
    setMaxGap(0);
    idRef.current = 0;
  };

  const rehunt = () => {
    setLocked(false);
    lockedRef.current = false;
    setLive(0);
    setPeak(0);
  };

  /** Crop the pinned region and score it. Also paints the two previews. */
  const sampleLocked = useCallback((): number | null => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;

    const work = (workRef.current ??= document.createElement('canvas'));
    if (work.width !== MASK_W) {
      work.width = MASK_W;
      work.height = MASK_H;
    }
    const wctx = work.getContext('2d', { willReadFrequently: true });
    if (!wctx) return null;

    const r = regionRef.current;
    const sx = (r.x / 100) * video.videoWidth;
    const sy = (r.y / 100) * video.videoHeight;
    const sw = (r.w / 100) * video.videoWidth;
    const sh = (r.h / 100) * video.videoHeight;
    wctx.drawImage(video, sx, sy, sw, sh, 0, 0, MASK_W, MASK_H);

    const gray = grayRef.current;
    toGray(wctx.getImageData(0, 0, MASK_W, MASK_H).data, gray);

    const cutoff = cfgRef.current.cutoff;
    const mctx = maskRef.current?.getContext('2d');
    if (mctx) {
      const out = mctx.createImageData(MASK_W, MASK_H);
      for (let i = 0; i < MASK_N; i++) {
        const v = gray[i] >= cutoff ? 255 : 0;
        out.data[i * 4] = v;
        out.data[i * 4 + 1] = v;
        out.data[i * 4 + 2] = v;
        out.data[i * 4 + 3] = 255;
      }
      mctx.putImageData(out, 0, 0);
    }
    const crop = cropRef.current;
    const cctx = crop?.getContext('2d');
    if (crop && cctx)
      cctx.drawImage(video, sx, sy, sw, sh, 0, 0, crop.width, crop.height);

    return scoreMask(gray, tpl.on, tpl.off, cutoff);
  }, [tpl]);

  /** Downscale the whole frame to a grey buffer for the search. */
  const grabGray = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const sw = SEARCH_W;
    const sh = Math.round((sw * video.videoHeight) / video.videoWidth);
    const c = (scanRef.current ??= document.createElement('canvas'));
    if (c.width !== sw || c.height !== sh) {
      c.width = sw;
      c.height = sh;
    }
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, sw, sh);
    const gray = new Uint8Array(sw * sh);
    toGray(ctx.getImageData(0, 0, sw, sh).data, gray);
    return { gray, sw, sh };
  }, []);

  const start = async () => {
    setError(null);
    try {
      // Hints only, but they pre-select the right tab in the picker: sharing the
      // game window alone keeps the rest of the desktop out of the page's reach
      // and makes the frame almost entirely banner-relevant. selfBrowserSurface
      // is newer than the DOM typings, hence the cast.
      const opts: DisplayMediaStreamOptions = {
        video: { frameRate: 10, displaySurface: 'window' },
        audio: false,
        ...({ selfBrowserSurface: 'exclude' } as object),
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(opts);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      // Reflect the browser's own "stop sharing" button back into our state.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setRunning(false);
        if (videoRef.current) videoRef.current.srcObject = null;
      });
      setMaxGap(0);
      setRunning(true);
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'ยกเลิกการแชร์หน้าจอ หรือเบราว์เซอร์ไม่อนุญาต'
          : 'เริ่มจับหน้าจอไม่สำเร็จ',
      );
    }
  };

  const stop = () => {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setRunning(false);
  };

  useEffect(() => stop, []); // release the capture when leaving the page

  /**
   * The sampling loop.
   *
   * Three independent clocks feed one gated tick, because the tab spends nearly
   * all of its time in the background while the user is in the game and each of
   * them can stall on its own: requestVideoFrameCallback stops when the page is
   * not being composited, a main-thread interval is clamped (and eventually
   * throttled hard) in a hidden tab, and a worker interval is the most resistant
   * but not guaranteed either. Whatever survives drives the sampling, and the
   * watchdog below reports the rate actually achieved so a stall is visible
   * instead of silent.
   */
  useEffect(() => {
    if (!running) return;
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let busy = false; // a scan is in flight
    let seq = 0;
    let lastSample = 0;
    let above = 0; // consecutive samples over the threshold
    let armed = true; // false until the score falls back down
    let lastHit = 0;
    let lockDims = '';
    const stamps: number[] = [];

    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./scan.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      worker = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reporting the state of an external system (worker construction), not deriving state
    if (!worker) setWorkerDown(true);

    const lockOnto = (r: Region) => {
      regionRef.current = r;
      lockedRef.current = true;
      lockDims = `${video.videoWidth}x${video.videoHeight}`;
      setRegion(r);
      setLocked(true);
    };

    const applyScore = (s: number, found: Region | null) => {
      if (disposed) return;
      setLive(s);
      setPeak((p) => (s > p ? s : p));
      const cfg = cfgRef.current;
      if (s >= cfg.minScore) {
        above++;
        if (above >= CONFIRM_FRAMES) {
          if (found) lockOnto(found);
          const now = Date.now();
          if (armed && now - lastHit >= cfg.minGap * 1000) {
            armed = false;
            lastHit = now;
            addRun();
          }
        }
      } else {
        above = 0;
        // Re-arm only once the banner is clearly gone, not the moment the score
        // dips below the line.
        if (s < cfg.minScore * RELEASE_RATIO) armed = true;
      }
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      if (lastSample && now - lastSample < SAMPLE_MS) return;
      if (lastSample) {
        const gap = now - lastSample;
        setMaxGap((g) => (gap > g ? gap : g));
      }
      lastSample = now;

      stamps.push(now);
      if (stamps.length > 16) stamps.shift();
      if (stamps.length > 1)
        setRate(
          ((stamps.length - 1) / (stamps[stamps.length - 1] - stamps[0])) * 1000,
        );

      if (lockedRef.current) {
        // The window was resized or the share was switched, so the pinned box no
        // longer means anything.
        if (lockDims && `${video.videoWidth}x${video.videoHeight}` !== lockDims) {
          lockedRef.current = false;
          setLocked(false);
          return;
        }
        const s = sampleLocked();
        if (s !== null) applyScore(s, null);
        return;
      }

      if (busy) return;
      const g = grabGray();
      if (!g) return;
      if (worker) {
        busy = true;
        worker.postMessage(
          {
            type: 'scan',
            seq: ++seq,
            gray: g.gray.buffer,
            sw: g.sw,
            sh: g.sh,
            cutoff: cfgRef.current.cutoff,
          },
          [g.gray.buffer],
        );
      } else {
        const found = searchGray(g.gray, g.sw, g.sh, cfgRef.current.cutoff, tpl);
        if (found) applyScore(found.score, found.region);
      }
    };

    if (worker) {
      worker.addEventListener('message', (e: MessageEvent) => {
        const m = e.data;
        if (m?.type === 'tick') tick();
        else if (m?.type === 'scan') {
          busy = false;
          if (m.found) applyScore(m.found.score, m.found.region);
        }
      });
      worker.addEventListener('error', () => {
        // Fall back to searching on the main thread rather than stopping.
        worker?.terminate();
        worker = null;
        setWorkerDown(true);
      });
      worker.postMessage({ type: 'clock', ms: SAMPLE_MS });
    }

    const interval = setInterval(tick, SAMPLE_MS);

    let rvfc = 0;
    const onFrame = () => {
      if (disposed) return;
      tick();
      rvfc = video.requestVideoFrameCallback(onFrame);
    };
    if ('requestVideoFrameCallback' in video)
      rvfc = video.requestVideoFrameCallback(onFrame);

    return () => {
      disposed = true;
      clearInterval(interval);
      if (rvfc) video.cancelVideoFrameCallback(rvfc);
      worker?.terminate();
    };
  }, [running, addRun, sampleLocked, grabGray, tpl]);

  const stalled = running && maxGap > GAP_WARN_MS;
  const recent = runs.slice(-40).reverse();

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">
          ตัวนับรอบดันอัตโนมัติ <span className="text-muted">(ทดลอง)</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          จับภาพหน้าจอเกมแล้วนับเมื่อเจอ “MISSION START” — พร้อมใช้ทันที
          ไม่ต้องตั้งค่าอะไร อ่านภาพอย่างเดียว ไม่ยุ่งกับตัวเกม เล่นแบบ Windowed
          / Borderless จะจับภาพได้ (Fullscreen Exclusive อาจได้จอดำ)
        </p>
        <p className="mt-1 text-sm text-muted">
          ตอนเลือกสิ่งที่จะแชร์ <strong className="text-foreground">ให้เลือกแท็บ
          “หน้าต่าง” แล้วเลือกหน้าต่างเกม</strong> ไม่ต้องแชร์ทั้งจอ — ปลอดภัยกว่า
          เพราะหน้านี้จะเห็นแค่เกม และหาตำแหน่งแบนเนอร์ได้เร็วกว่าด้วย
        </p>
      </header>

      {error && (
        <div className="rounded-base border border-[var(--border-danger)] bg-[var(--danger)]/10 p-3 text-sm text-foreground">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button
            onClick={start}
            className="rounded-base bg-[var(--success)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            เริ่มจับหน้าจอ
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-base border border-[var(--border-danger)] px-4 py-2 text-sm text-foreground hover:opacity-90"
          >
            หยุด
          </button>
        )}
        <button
          onClick={rehunt}
          disabled={!locked}
          className="rounded-base border border-border px-3 py-2 text-sm text-foreground hover:border-gold/50 disabled:opacity-40"
          title="ถ้าย้าย/ปรับขนาดหน้าต่างเกม ให้กดหาตำแหน่งใหม่"
        >
          หาตำแหน่งใหม่
        </button>
        <span className="text-xs text-muted">
          {!running
            ? 'ยังไม่ได้จับหน้าจอ'
            : locked
              ? 'ล็อกตำแหน่งแล้ว — กำลังนับ'
              : 'กำลังหาตำแหน่ง… ลงดันได้เลย เจอ MISSION START เมื่อไหร่จะล็อกให้เอง'}
        </span>
      </div>

      {running && !locked && (
        <div className="rounded-base border border-gold/40 bg-gold/5 p-3 text-sm text-foreground">
          ยังไม่รู้ว่าหน้าต่างเกมอยู่ตรงไหนในภาพที่จับ กำลังสแกนทั้งจอหาแบนเนอร์
          — <strong>ลงดันตามปกติได้เลย</strong> พอ “MISSION START” ขึ้นครั้งแรก
          มันจะจับตำแหน่งเอง ล็อกไว้ แล้วนับรอบนั้นให้ด้วย
        </div>
      )}

      {stalled && (
        <div className="rounded-base border border-[var(--border-danger)] bg-[var(--danger)]/10 p-3 text-sm text-foreground">
          เคยมีช่วงที่ตรวจจับห่างกันถึง {(maxGap / 1000).toFixed(1)} วินาที —
          แบนเนอร์ขึ้นแค่ ~2 วิ ช่วงนั้นอาจนับตกไปแล้ว
          มักเกิดจากเบราว์เซอร์ลดการทำงานของแท็บที่ถูกสลับไปอยู่ข้างหลัง
          ถ้าเป็นบ่อยให้เปิดแท็บนี้ค้างไว้ให้เห็น (เช่นจออีกจอ
          หรือหน้าต่างเล็ก ๆ วางข้างเกม) แล้วกดรีเซ็ตตัวนับเพื่อวัดใหม่
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        {/* live capture with the detection box drawn on top */}
        <div className="relative overflow-hidden rounded-base border border-border bg-black">
          <video ref={videoRef} muted playsInline className="block w-full" />
          <div
            className="pointer-events-none absolute border-2 border-gold"
            style={{
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.w}%`,
              height: `${region.h}%`,
            }}
          />
          {!running && (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted">
              ยังไม่ได้จับหน้าจอ
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-base border border-border bg-surface p-3">
            <div className="text-3xl font-bold tabular-nums text-gold">
              {count}
              <span className="ml-2 text-sm font-normal text-muted">รอบ</span>
            </div>
            <div className="text-xs text-muted">
              ≈ {count * 20} stamina · ล่าสุด{' '}
              {recent[0] ? new Date(recent[0].at).toLocaleTimeString() : '—'}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                onClick={() => addRun(true)}
                className="rounded-base border border-border px-2 py-1 text-xs text-foreground hover:border-gold/50"
                title="นับตกไปหนึ่งรอบ"
              >
                +1
              </button>
              <button
                onClick={() => setRuns((r) => r.slice(0, -1))}
                disabled={!count}
                className="rounded-base border border-border px-2 py-1 text-xs text-foreground hover:border-gold/50 disabled:opacity-40"
                title="ลบรอบล่าสุดที่นับเกินมา"
              >
                −1
              </button>
              <button
                onClick={resetCounter}
                className="rounded-base border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
              >
                รีเซ็ตตัวนับ
              </button>
            </div>
          </div>

          <div className="rounded-base border border-border bg-surface p-3 text-xs">
            <div className="mb-1 text-muted">ความเหมือนตอนนี้</div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--root)]">
              <div
                className="h-full bg-gold transition-[width]"
                style={{ width: `${Math.round(live * 100)}%` }}
              />
            </div>
            <div className="tabular-nums text-foreground">
              {(live * 100).toFixed(1)}% (ต้องถึง {(minScore * 100).toFixed(0)}%)
            </div>
            <div className="tabular-nums text-muted">
              สูงสุดที่เคยเจอ{' '}
              <span
                className={
                  peak >= minScore + 0.15
                    ? 'text-[var(--success)]'
                    : peak >= minScore
                      ? 'text-gold'
                      : ''
                }
              >
                {(peak * 100).toFixed(1)}%
              </span>
              {peak > 0 && peak < minScore + 0.15 && (
                <span className="ml-1">— เฉียดเกณฑ์ ควรลดเกณฑ์ลง</span>
              )}
            </div>
            {running && (
              <div className="tabular-nums text-muted">
                ตรวจจับ {rate.toFixed(1)} ครั้ง/วิ · ห่างสุด{' '}
                <span className={stalled ? 'text-[var(--danger)]' : ''}>
                  {(maxGap / 1000).toFixed(1)} วิ
                </span>
                {workerDown && <span className="ml-1">· ไม่มี worker</span>}
              </div>
            )}
            <div className="mt-2 space-y-1">
              <canvas
                ref={cropRef}
                width={192}
                height={72}
                className="w-full rounded border border-border"
              />
              <div className="flex gap-1">
                <canvas
                  ref={maskRef}
                  width={MASK_W}
                  height={MASK_H}
                  className="w-1/2 rounded border border-border [image-rendering:pixelated]"
                  title="ภาพที่ตัวตรวจจับเห็น"
                />
                <canvas
                  ref={tplRef}
                  width={MASK_W}
                  height={MASK_H}
                  className="w-1/2 rounded border border-border [image-rendering:pixelated]"
                  title="แม่แบบที่ฝังมา — ให้ซ้อนทับกับภาพซ้าย"
                />
              </div>
              <div className="text-[10px] text-muted">
                ซ้าย = ที่เห็นจริง · ขวา = แม่แบบ (ตอนแบนเนอร์ขึ้นควรทับกันพอดี)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* tuning — only needed if the region does not line up on this setup */}
      <details className="rounded-base border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          ตั้งค่าละเอียด (ปกติไม่ต้องแตะ)
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label key={k} className="text-xs text-muted">
              กรอบ {k} (%)
              <input
                type="number"
                step="0.1"
                value={region[k]}
                onChange={(e) => {
                  const next = { ...region, [k]: Number(e.target.value) };
                  setRegion(validRegion(next) ?? region);
                }}
                className="mt-1 w-full rounded-base border border-border bg-[var(--root)] px-2 py-1 text-sm text-foreground"
              />
            </label>
          ))}
          <label className="text-xs text-muted">
            ความสว่างขั้นต่ำ ({cutoff})
            <input
              type="range"
              min={80}
              max={250}
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-xs text-muted">
            เกณฑ์ความเหมือน ({(minScore * 100).toFixed(0)}%)
            <input
              type="range"
              min={20}
              max={95}
              value={minScore * 100}
              onChange={(e) => setMinScore(Number(e.target.value) / 100)}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-xs text-muted">
            เว้นระยะขั้นต่ำระหว่างรอบ ({minGap} วิ)
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={minGap}
              onChange={(e) => setMinGap(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <button
            onClick={() => {
              setRegion(DEFAULT_REGION);
              setCutoff(DEFAULT_CUTOFF);
              setMinScore(DEFAULT_MIN_SCORE);
              setMinGap(DEFAULT_MIN_GAP);
            }}
            className="self-end rounded-base border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            คืนค่าเริ่มต้น
          </button>
        </div>
      </details>

      {recent.length > 0 && (
        <div className="rounded-base border border-border bg-surface p-3">
          <div className="mb-2 text-sm font-medium text-foreground">
            ประวัติการตรวจเจอ{' '}
            <span className="text-xs font-normal text-muted">
              (กด × เพื่อลบรอบที่นับผิด)
            </span>
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {recent.map((r, i) => (
              <li key={r.id} className="tabular-nums">
                <span className={r.manual ? 'text-gold' : ''}>
                  #{count - i} · {new Date(r.at).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => setRuns((all) => all.filter((x) => x.id !== r.id))}
                  className="ml-1 text-muted hover:text-[var(--danger)]"
                  aria-label={`ลบรอบที่ ${count - i}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

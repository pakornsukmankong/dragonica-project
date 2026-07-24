'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Internal, unlisted experiment: count dungeon runs by watching the game window.
 *
 * Purely passive — it reads pixels from a screen share the user starts and never
 * touches the game. Reached by URL only (no nav entry); /grind/* is already
 * login-gated by middleware and disallowed in robots.txt.
 */

// Where "MISSION START" sits, measured off a 1920x1080 capture of a real run
// (x680 y175, 470x180). Kept as percentages so a different capture resolution
// still lines up as long as the aspect ratio matches.
const DEFAULT_REGION = { x: 35.4, y: 16.2, w: 24.5, h: 16.7 };

// The banner is matched as a small black/white mask: enough pixels to recognise
// the letterforms, few enough to compare on every sampled frame.
const MASK_W = 96;
const MASK_H = 36;

// The banner shows for ~2s and runs are ~164s apart, so sampling twice a second
// gives 4-5 chances to catch each one without loading the machine.
const SAMPLE_MS = 500;

const LS_REF = 'dgn-auto-ref-mask';
const LS_REGION = 'dgn-auto-region';
const LS_TUNING = 'dgn-auto-tuning';

type Region = typeof DEFAULT_REGION;
type Hit = { n: number; at: string };

/** Bright pixels only: the banner text is near-white, most backdrops are not. */
function toMask(data: Uint8ClampedArray, cutoff: number): Uint8Array {
  const mask = new Uint8Array(MASK_W * MASK_H);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    // Rec. 601 luma — cheaper than a colour-space conversion and good enough.
    const luma = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    mask[i] = luma >= cutoff ? 1 : 0;
  }
  return mask;
}

/**
 * Intersection over union of the lit pixels. Plain per-pixel equality would
 * score a mostly-dark frame highly against a mostly-dark reference, so compare
 * only what is lit in either mask.
 */
function score(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union++;
    if (a[i] && b[i]) inter++;
  }
  return union === 0 ? 0 : inter / union;
}

export default function AutoCountPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<HTMLCanvasElement>(null); // colour crop preview
  const maskRef = useRef<HTMLCanvasElement>(null); // binarised preview
  const workRef = useRef<HTMLCanvasElement | null>(null); // offscreen sampler
  const refMaskRef = useRef<Uint8Array | null>(null);
  const lastHitRef = useRef(0);

  const [running, setRunning] = useState(false);
  // Lit-pixel count of the stored reference, or null when there is none. Kept in
  // state (not read off the ref during render) so the UI re-renders with it.
  const [refLit, setRefLit] = useState<number | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [cutoff, setCutoff] = useState(190); // brightness for "lit"
  const [minScore, setMinScore] = useState(0.7); // match threshold
  const [cooldown, setCooldown] = useState(60); // seconds between counts
  const [live, setLive] = useState(0);
  const [count, setCount] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Restore tuning from the last session — recalibrating on every visit would
  // make this unusable. This has to run in an effect rather than a lazy state
  // initialiser: localStorage does not exist during the server render, and
  // seeding state from it there would desync hydration.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot restore on mount */
    try {
      const r = localStorage.getItem(LS_REGION);
      if (r) setRegion(JSON.parse(r));
      const t = localStorage.getItem(LS_TUNING);
      if (t) {
        const v = JSON.parse(t);
        if (typeof v.cutoff === 'number') setCutoff(v.cutoff);
        if (typeof v.minScore === 'number') setMinScore(v.minScore);
        if (typeof v.cooldown === 'number') setCooldown(v.cooldown);
      }
      const m = localStorage.getItem(LS_REF);
      if (m && m.length === MASK_W * MASK_H) {
        const mask = Uint8Array.from(m, (c) => (c === '1' ? 1 : 0));
        refMaskRef.current = mask;
        setRefLit(mask.reduce((a, b) => a + b, 0));
      }
    } catch {
      // corrupt or unavailable storage just means "start fresh"
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_REGION, JSON.stringify(region));
  }, [region]);
  useEffect(() => {
    localStorage.setItem(
      LS_TUNING,
      JSON.stringify({ cutoff, minScore, cooldown }),
    );
  }, [cutoff, minScore, cooldown]);

  /** Grab the current region as a mask, painting both previews on the way. */
  const sample = useCallback((): Uint8Array | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const work =
      workRef.current ?? (workRef.current = document.createElement('canvas'));
    work.width = MASK_W;
    work.height = MASK_H;
    const wctx = work.getContext('2d', { willReadFrequently: true });
    if (!wctx) return null;

    const sx = (region.x / 100) * video.videoWidth;
    const sy = (region.y / 100) * video.videoHeight;
    const sw = (region.w / 100) * video.videoWidth;
    const sh = (region.h / 100) * video.videoHeight;
    wctx.drawImage(video, sx, sy, sw, sh, 0, 0, MASK_W, MASK_H);

    const img = wctx.getImageData(0, 0, MASK_W, MASK_H);
    const mask = toMask(img.data, cutoff);

    // colour crop preview
    const crop = cropRef.current;
    const cctx = crop?.getContext('2d');
    if (crop && cctx) cctx.drawImage(video, sx, sy, sw, sh, 0, 0, crop.width, crop.height);

    // binarised preview — what the matcher actually sees
    const mc = maskRef.current;
    const mctx = mc?.getContext('2d');
    if (mc && mctx) {
      const out = mctx.createImageData(MASK_W, MASK_H);
      for (let i = 0; i < mask.length; i++) {
        const v = mask[i] ? 255 : 0;
        out.data[i * 4] = v;
        out.data[i * 4 + 1] = v;
        out.data[i * 4 + 2] = v;
        out.data[i * 4 + 3] = 255;
      }
      mctx.putImageData(out, 0, 0);
    }
    return mask;
  }, [region, cutoff]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      // Reflect the browser's own "stop sharing" button back into our state.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setRunning(false);
        if (videoRef.current) videoRef.current.srcObject = null;
      });
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

  // Detection loop.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const mask = sample();
      if (!mask) return;
      const ref = refMaskRef.current;
      if (!ref) return;
      const s = score(mask, ref);
      setLive(s);
      const now = Date.now();
      if (s >= minScore && now - lastHitRef.current > cooldown * 1000) {
        lastHitRef.current = now;
        setCount((c) => {
          const n = c + 1;
          setHits((h) =>
            [{ n, at: new Date().toLocaleTimeString() }, ...h].slice(0, 50),
          );
          return n;
        });
      }
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [running, sample, minScore, cooldown]);

  const captureRef = () => {
    const mask = sample();
    if (!mask) return;
    refMaskRef.current = mask;
    setRefLit(mask.reduce((a, b) => a + b, 0));
    localStorage.setItem(LS_REF, Array.from(mask).join(''));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">
          ตัวนับรอบดันอัตโนมัติ <span className="text-muted">(ทดลอง)</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          จับภาพหน้าจอเกมแล้วนับเมื่อเจอ “MISSION START” — อ่านภาพอย่างเดียว
          ไม่ยุ่งกับตัวเกม เล่นแบบ Windowed / Borderless จะจับภาพได้ (Fullscreen
          Exclusive อาจได้จอดำ)
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
          onClick={captureRef}
          disabled={!running}
          className="rounded-base border border-border px-4 py-2 text-sm text-foreground hover:border-gold/50 disabled:opacity-40"
          title="ให้เกมค้างที่จอ MISSION START แล้วค่อยกด"
        >
          บันทึกแม่แบบจากภาพตอนนี้
        </button>
        <span className="text-xs text-muted">
          {refLit !== null
            ? `มีแม่แบบแล้ว (จุดสว่าง ${refLit})`
            : 'ยังไม่มีแม่แบบ'}
        </span>
      </div>

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
              ≈ {count * 20} stamina · ล่าสุด {hits[0]?.at ?? '—'}
            </div>
            <button
              onClick={() => {
                setCount(0);
                setHits([]);
                lastHitRef.current = 0;
              }}
              className="mt-2 rounded-base border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              รีเซ็ตตัวนับ
            </button>
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
            <div className="mt-2 flex gap-2">
              <canvas
                ref={cropRef}
                width={192}
                height={72}
                className="w-1/2 rounded border border-border"
              />
              <canvas
                ref={maskRef}
                width={MASK_W}
                height={MASK_H}
                className="w-1/2 rounded border border-border [image-rendering:pixelated]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* tuning */}
      <details className="rounded-base border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          ตั้งค่าละเอียด
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label key={k} className="text-xs text-muted">
              กรอบ {k} (%)
              <input
                type="number"
                step="0.1"
                value={region[k]}
                onChange={(e) =>
                  setRegion({ ...region, [k]: Number(e.target.value) })
                }
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
              min={30}
              max={95}
              value={minScore * 100}
              onChange={(e) => setMinScore(Number(e.target.value) / 100)}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-xs text-muted">
            หน่วงกันนับซ้ำ ({cooldown} วิ)
            <input
              type="range"
              min={5}
              max={180}
              step={5}
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <button
            onClick={() => setRegion(DEFAULT_REGION)}
            className="self-end rounded-base border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            คืนค่ากรอบเริ่มต้น
          </button>
        </div>
      </details>

      {hits.length > 0 && (
        <div className="rounded-base border border-border bg-surface p-3">
          <div className="mb-2 text-sm font-medium text-foreground">
            ประวัติการตรวจเจอ
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {hits.map((h) => (
              <li key={h.n} className="tabular-nums">
                #{h.n} · {h.at}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

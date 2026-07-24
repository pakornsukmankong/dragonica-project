'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
const MASK_N = MASK_W * MASK_H;

// Brightness at which a pixel counts as lit. The template below was built at
// this value, so changing it in the UI trades recall against false positives.
const DEFAULT_CUTOFF = 190;

// The banner shows for ~2s and runs are ~164s apart, so sampling twice a second
// gives 4-5 chances to catch each one without loading the machine.
const SAMPLE_MS = 500;

/**
 * Built-in template, derived from four banner frames across two runs of a real
 * recording — no per-user calibration needed.
 *
 * ON  = lit in every sample (the letter cores).
 * OFF = dark in every sample (gaps and outline).
 *
 * Two maps rather than one because the backdrop behind the banner changes with
 * the dungeon: only pixels that agreed across visibly different backgrounds are
 * kept, so the match keys on the text and ignores the scenery.
 */
const TPL_ON =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA6M8cGHgQMAAAAAAA6O+eOH4YeDAQAAAA7PGDOGOY6DAQAAAA/HDDDAGIzHAAAAAI3HHHBADMzHAAAAAEnGeOAAAAAAAAAAgGlm4MAAAAAMAAAAgDhjwAFiBkRsAAAAgBhjgAFiBmZ8AAAAwBgzwwwjjGN4AAAAQIgx/twx/CE4AAAAQIAxPHAweDA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAP78DwT4jwAAAAAAAP/8Dwb4i4EAAAAAgOPgAAcYAAAAAAAAgAHgAAcYAAAAAAAAwAFggA8AAAAAAAAAwANgwAwAAAAAAAAAgA9gwAwAAAAAAAAAAD8wYAAAAAAAAAAAADwwEAAAAAAAAAAAAHAwAAAAAAAAAAAAAHAQAAAAAAAAAAAAEHAIAAAAAAAAAAAAMDAQAAAAAAAAAAAAcBwAAAAAAAAAAAAA4A8IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TPL_OFF =
  '//////////////////////////////////////////////////FzDj54fvz///////FxBhx4Hnh8/v////Ew58x5xnF8/v////A4888/53M4/////3I4448/8zM4/////7Y5hx8++zM7////f5aZHz+8+TMT////f8ecP/6c+ZuT////f+ecf/6d+ZmD////P+fMPPPcc5yH////v3fOASPOA97H////v3/Ow4/Ph8/H/////////////////////////////////////////8f//////////////wED8PsHcP///////wAD8PkHdH7/////fxwf//jn////////f/4f//jn////////P/6ff/D/////////P/yfP/P/////////f/CfP/P//////////8DPn////////////8PP7////////////4/P/////////////4/v////////////74/3////////////z8/v////////////j+P/////////////H/D3////////////////////////////////////////////////////////';

// Live scores land at ~1.0 on the banner and under 0.05 on town, loading,
// combat, result and warning frames, so the default sits in the middle of a
// very wide gap.
const DEFAULT_MIN_SCORE = 0.5;

// Runs are ~164s apart; this only has to outlast the ~2s the banner is up.
const DEFAULT_COOLDOWN = 60;

const LS_REGION = 'dgn-auto-region';
const LS_TUNING = 'dgn-auto-tuning';

type Region = typeof DEFAULT_REGION;
type Hit = { n: number; at: string };

function unpack(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(MASK_N);
  for (let i = 0; i < MASK_N; i++)
    out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

export default function AutoCountPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<HTMLCanvasElement>(null); // colour crop preview
  const maskRef = useRef<HTMLCanvasElement>(null); // binarised preview
  const tplRef = useRef<HTMLCanvasElement>(null); // template, for aligning
  const workRef = useRef<HTMLCanvasElement | null>(null); // offscreen sampler
  const lastHitRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [cutoff, setCutoff] = useState(DEFAULT_CUTOFF);
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);
  const [cooldown, setCooldown] = useState(DEFAULT_COOLDOWN);
  const [live, setLive] = useState(0);
  const [count, setCount] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const tpl = useMemo(() => {
    const on = unpack(TPL_ON);
    const off = unpack(TPL_OFF);
    let nOn = 0;
    let nOff = 0;
    for (let i = 0; i < MASK_N; i++) {
      nOn += on[i];
      nOff += off[i];
    }
    return { on, off, nOn, nOff };
  }, []);

  // Restore tuning from the last session. This has to run in an effect rather
  // than a lazy state initialiser: localStorage does not exist during the
  // server render, and seeding state from it there would desync hydration.
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

  // Paint the template once so the region box can be lined up by eye.
  useEffect(() => {
    const c = tplRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const img = ctx.createImageData(MASK_W, MASK_H);
    for (let i = 0; i < MASK_N; i++) {
      const v = tpl.on[i] ? 255 : 0;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = tpl.on[i] ? 190 : 0;
      img.data[i * 4 + 2] = 0;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [tpl]);

  /**
   * Score the current frame: how much of the template's text is lit, times how
   * much of its dark area stayed dark. The second factor is what stops a bright
   * scene — which would light every text pixel by accident — from matching.
   */
  const sample = useCallback((): number | null => {
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

    const data = wctx.getImageData(0, 0, MASK_W, MASK_H).data;
    let onHit = 0;
    let offHit = 0;
    const mc = maskRef.current;
    const mctx = mc?.getContext('2d');
    const out = mctx?.createImageData(MASK_W, MASK_H);

    for (let i = 0; i < MASK_N; i++) {
      const p = i * 4;
      // Rec. 601 luma — cheaper than a colour-space conversion, good enough here.
      const luma =
        0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      const litPx = luma >= cutoff ? 1 : 0;
      if (tpl.on[i] && litPx) onHit++;
      if (tpl.off[i] && !litPx) offHit++;
      if (out) {
        const v = litPx ? 255 : 0;
        out.data[p] = v;
        out.data[p + 1] = v;
        out.data[p + 2] = v;
        out.data[p + 3] = 255;
      }
    }
    if (mctx && out) mctx.putImageData(out, 0, 0);

    const crop = cropRef.current;
    const cctx = crop?.getContext('2d');
    if (crop && cctx)
      cctx.drawImage(video, sx, sy, sw, sh, 0, 0, crop.width, crop.height);

    return (onHit / tpl.nOn) * (offHit / tpl.nOff);
  }, [region, cutoff, tpl]);

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

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = sample();
      if (s === null) return;
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
        <span className="text-xs text-muted">
          {running ? 'กำลังเฝ้าดู…' : 'ยังไม่ได้จับหน้าจอ'}
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
              min={20}
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
            onClick={() => {
              setRegion(DEFAULT_REGION);
              setCutoff(DEFAULT_CUTOFF);
              setMinScore(DEFAULT_MIN_SCORE);
              setCooldown(DEFAULT_COOLDOWN);
            }}
            className="self-end rounded-base border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            คืนค่าเริ่มต้น
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

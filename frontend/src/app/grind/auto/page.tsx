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
//
// 140 rather than something brighter because "START" is rendered in orange-gold,
// which has a much lower luma than the white "MISSION": at 190 the darker "RT"
// dropped out and the template kept only "MISSION STA". The fuller template also
// survives the blur that comes with capturing a small game window.
const DEFAULT_CUTOFF = 140;

// Scanning happens on a downscaled frame, which dims thin strokes further, so
// the hunt uses a more forgiving cutoff than the final check.
const COARSE_CUTOFF = 110;

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
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA6O8cGHwQODAQAAAA7O+eOP8YeDAQAAAA/PnXPOeY/HAQAAAI/PHDDAHMzHAQAAAI3HHHDADMzHAAAAgM3m+PBBDszOAAAAgG3n8MFDBszMAAAAgD1jwAFnBu5sAAAAwDhzwAFnBmd8AAAAwJhzxwxznmN4AAAAwIgz//wx/HF4AAAAYIAxfvgw+DA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHz4DwTwAAAAAAAAAP/8Hwb4j/8BAAAAgP/8Dwb43/8BAAAAgOPhAQ8cHBwAAAAAwMHggA8cHAwAAAAAwAHggA8cHA4AAAAAwANgwA0cHA4AAAAAwB9w4AwcDwYAAAAAgD9wYBz+BwYAAAAAAHwwcBz+AwcAAAAAAHg4+B/+AAMAAAAAAHA4/B/mAAMAAAAAOHAYHDznAAMAAAAAeDgYDjjngQEAAAAA8D8cDzjHgQEAAAAA8B8MBzjDgwEAAAAAwAMMAAACAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TPL_OFF =
  '//////////////////////////////////////////////////FxDj54Pvx8/v////ExBhxwDnh8/v////AwYowxhnA4/v///3Aw488/4zM4/v///3I4448/8zM4////fzIZBw8W8TMR////f5IYDz4Y8TMT////f8KcP/6Y+RED////P8eMP/6Y+ZiD////P2eMOPOMYZyH////P3fMAAPOA46H////n3/OgQfPB8/H/////////////////////////////////////////4MH8PsP/P///////wAD4PkHcAD+////fwAD8PkHIAD+////fxwe/vDj4+P/////Pz4ff/Dj4/P/////P/4ff/Dj4/H/////P/yfP/Lj4/H/////P+CPH/Pj8Pn/////f8CPn+MB+Pn//////4PPj+MB/Pj//////4fHB+AB//z//////4/HA+AZ//z/////x4/n48MY//z/////h8fn8ccYfv7/////D8Dj8Mc4fv7/////D+Dz+Mc8fP7/////P/zz///9/f//////////////////////////////////';

// Across fullscreen and three simulated window sizes the banner scores 0.79-0.91
// while the best false match on town, combat and result frames reaches 0.43, so
// the default sits between the two with room on each side.
const DEFAULT_MIN_SCORE = 0.6;

// Runs are ~164s apart; this only has to outlast the ~2s the banner is up.
const DEFAULT_COOLDOWN = 60;

// Banner width-to-height ratio (470x180). Candidate boxes keep it so the crop
// always lands on the template's own proportions.
const TPL_ASPECT = 470 / 180;

// Width the whole frame is reduced to while hunting for the banner. 480 was too
// coarse: with the game in a 1280-wide window the banner shrinks to ~78px there
// and the strokes blur away entirely.
const SEARCH_W = 960;

const LS_REGION = 'dgn-auto-region';
const LS_TUNING = 'dgn-auto-tuning';
const LS_LOCKED = 'dgn-auto-locked';

// Bumped whenever the defaults above change meaningfully. Saved tuning from an
// older version is discarded rather than applied: a stored cutoff of 190 would
// silently clip "START" again and undo the fix, on exactly the machines that
// had already run the old build.
const TUNING_VERSION = 2;

type Region = typeof DEFAULT_REGION;
type Hit = { n: number; at: string };

function unpack(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(MASK_N);
  for (let i = 0; i < MASK_N; i++)
    out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

/** Every `step`-th pixel of a template — cheap enough to slide over a whole frame. */
function subsample(mask: Uint8Array, step: number) {
  const w = Math.floor(MASK_W / step);
  const h = Math.floor(MASK_H / step);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out[y * w + x] = mask[y * step * MASK_W + x * step];
  return { mask: out, w, h, n: out.reduce((a: number, b) => a + b, 0) };
}

/**
 * Score one candidate box: how much of the template's text is lit, times how
 * much of its dark area stayed dark. Samples the template grid out of `gray`
 * with nearest-neighbour, so any box size can be tested without rescaling.
 */
function scoreBox(
  gray: Uint8Array,
  gw: number,
  ox: number,
  oy: number,
  bw: number,
  bh: number,
  on: Uint8Array,
  off: Uint8Array,
  nOn: number,
  nOff: number,
  tw: number,
  th: number,
  cutoff: number,
): number {
  let onHit = 0;
  let offHit = 0;
  for (let ty = 0; ty < th; ty++) {
    const row = (((oy + ((ty + 0.5) * bh) / th) | 0) * gw) | 0;
    const trow = ty * tw;
    for (let tx = 0; tx < tw; tx++) {
      const gx = (ox + ((tx + 0.5) * bw) / tw) | 0;
      const lit = gray[row + gx] >= cutoff ? 1 : 0;
      const i = trow + tx;
      if (on[i] && lit) onHit++;
      if (off[i] && !lit) offHit++;
    }
  }
  return (onHit / nOn) * (offHit / nOff);
}

export default function AutoCountPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<HTMLCanvasElement>(null); // colour crop preview
  const maskRef = useRef<HTMLCanvasElement>(null); // binarised preview
  const tplRef = useRef<HTMLCanvasElement>(null); // template, for aligning
  const workRef = useRef<HTMLCanvasElement | null>(null); // offscreen sampler
  const scanRef = useRef<HTMLCanvasElement | null>(null); // offscreen whole-frame
  const lastHitRef = useRef(0);
  const tickRef = useRef(0);
  const seqRef = useRef(0); // run number, so history entries cannot collide

  const [running, setRunning] = useState(false);
  // Until the banner has been found once, the region is a guess; after that the
  // box is pinned and only the cheap fixed-region check runs.
  const [locked, setLocked] = useState(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [cutoff, setCutoff] = useState(DEFAULT_CUTOFF);
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);
  const [cooldown, setCooldown] = useState(DEFAULT_COOLDOWN);
  const [live, setLive] = useState(0);
  // Highest score seen since the counter was reset — a run that only just clears
  // the threshold looks identical to a solid one without this.
  const [peak, setPeak] = useState(0);
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
    return { on, off, nOn, nOff, cOn: subsample(on, 3), cOff: subsample(off, 3) };
  }, []);

  // Restore tuning from the last session. This has to run in an effect rather
  // than a lazy state initialiser: localStorage does not exist during the
  // server render, and seeding state from it there would desync hydration.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot restore on mount */
    try {
      const r = localStorage.getItem(LS_REGION);
      if (r) setRegion(JSON.parse(r));
      if (localStorage.getItem(LS_LOCKED) === '1') setLocked(true);
      const t = localStorage.getItem(LS_TUNING);
      if (t) {
        const v = JSON.parse(t);
        if (v.v === TUNING_VERSION) {
          if (typeof v.cutoff === 'number') setCutoff(v.cutoff);
          if (typeof v.minScore === 'number') setMinScore(v.minScore);
          if (typeof v.cooldown === 'number') setCooldown(v.cooldown);
        }
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
    localStorage.setItem(LS_LOCKED, locked ? '1' : '0');
  }, [locked]);
  useEffect(() => {
    localStorage.setItem(
      LS_TUNING,
      JSON.stringify({ v: TUNING_VERSION, cutoff, minScore, cooldown }),
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

  /**
   * Find the banner anywhere in the frame, at any size. The game may sit in a
   * window with title bar and letterboxing, so its content rectangle — and with
   * it the banner's position and scale — cannot be assumed from the capture.
   *
   * Coarse pass slides a 1-in-3 template over the whole frame; the winner is
   * then refined with the full template. Only run while unlocked.
   */
  const searchFrame = useCallback((): { score: number; region: Region } | null => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const SW = SEARCH_W;
    const SH = Math.round((SW * video.videoHeight) / video.videoWidth);
    const c = scanRef.current ?? (scanRef.current = document.createElement('canvas'));
    c.width = SW;
    c.height = SH;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, SW, SH);
    const d = ctx.getImageData(0, 0, SW, SH).data;
    const gray = new Uint8Array(SW * SH);
    for (let i = 0; i < gray.length; i++) {
      const p = i * 4;
      gray[i] = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) | 0;
    }

    // Coarse pass: a geometric ladder of banner widths, because the game window
    // can be anything from a small window to the whole screen and relative size
    // error is what matters.
    const { cOn, cOff } = tpl;
    let best = { s: -1, x: 0, y: 0, w: 0, h: 0 };
    for (let bw = 80; bw <= 340; bw = Math.round(bw * 1.12)) {
      const bh = bw / TPL_ASPECT;
      if (bh >= SH) break;
      for (let oy = 0; oy + bh <= SH; oy += 5)
        for (let ox = 0; ox + bw <= SW; ox += 5) {
          const s = scoreBox(gray, SW, ox, oy, bw, bh, cOn.mask, cOff.mask, cOn.n, cOff.n, cOn.w, cOn.h, COARSE_CUTOFF);
          if (s > best.s) best = { s, x: ox, y: oy, w: bw, h: bh };
        }
    }
    if (best.s < 0) return null;

    // Fine pass: full template, real cutoff, around the winner.
    let fine = { s: -1, x: best.x, y: best.y, w: best.w, h: best.h };
    for (let f = 0.88; f <= 1.13; f += 0.04) {
      const bw = best.w * f;
      const bh = bw / TPL_ASPECT;
      for (let oy = best.y - 6; oy <= best.y + 6; oy++)
        for (let ox = best.x - 6; ox <= best.x + 6; ox++) {
          if (ox < 0 || oy < 0 || ox + bw > SW || oy + bh > SH) continue;
          const s = scoreBox(gray, SW, ox, oy, bw, bh, tpl.on, tpl.off, tpl.nOn, tpl.nOff, MASK_W, MASK_H, cutoff);
          if (s > fine.s) fine = { s, x: ox, y: oy, w: bw, h: bh };
        }
    }
    return {
      score: fine.s,
      region: {
        x: (fine.x / SW) * 100,
        y: (fine.y / SH) * 100,
        w: (fine.w / SW) * 100,
        h: (fine.h / SH) * 100,
      },
    };
  }, [tpl, cutoff]);

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
      let s: number | null;
      if (locked) {
        s = sample();
      } else {
        // Searching is far heavier than the fixed check, so only every other
        // tick — the banner is up for ~2s, which is plenty.
        if (tickRef.current++ % 2) return;
        const found = searchFrame();
        s = found?.score ?? null;
        // A confident hit means we have also just located the box: pin it, and
        // keep painting previews from here on.
        if (found && found.score >= minScore) {
          setRegion(found.region);
          setLocked(true);
        }
      }
      if (s === null) return;
      setLive(s);
      setPeak((p) => (s > p ? s : p));
      const now = Date.now();
      if (s >= minScore && now - lastHitRef.current > cooldown * 1000) {
        lastHitRef.current = now;
        // The run number lives in a ref, not in the count updater: React may
        // invoke an updater more than once, and nesting setHits inside it
        // duplicated history entries.
        seqRef.current += 1;
        const n = seqRef.current;
        setCount(n);
        setHits((h) =>
          [{ n, at: new Date().toLocaleTimeString() }, ...h].slice(0, 50),
        );
      }
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [running, locked, sample, searchFrame, minScore, cooldown]);

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
        <button
          onClick={() => {
            setLocked(false);
            setLive(0);
          }}
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
                setPeak(0);
                lastHitRef.current = 0;
                seqRef.current = 0;
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

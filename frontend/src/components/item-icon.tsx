import type { GameItemIcon } from '@/lib/items';

// Atlas sheets default to 480x480 with a 12x12 grid (40px cells); a few
// odd-sized sheets carry their [w, h] in icon.s.
const DEFAULT_SHEET = 480;

/**
 * Renders one cell of an item icon atlas via background-position, so a page of
 * results loads a handful of sprite sheets instead of one image per item.
 */
export function ItemIcon({
  icon,
  size = 40,
  className = '',
}: {
  icon: GameItemIcon;
  size?: number;
  className?: string;
}) {
  const [sheetW, sheetH] = icon.s ?? [DEFAULT_SHEET, DEFAULT_SHEET];
  const cellW = sheetW / icon.u;
  const cellH = sheetH / icon.v;
  const idx = Math.max(0, icon.i - 1); // 1-based, row-major
  const col = idx % icon.u;
  const row = Math.floor(idx / icon.u);
  // Scale the (possibly non-square) cell to fit the box.
  const scale = Math.min(size / cellW, size / cellH);

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        style={{
          width: cellW * scale,
          height: cellH * scale,
          backgroundImage: `url(/item-atlas/${icon.a}.webp)`,
          backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
          backgroundPosition: `-${col * cellW * scale}px -${row * cellH * scale}px`,
          imageRendering: scale > 1 ? 'pixelated' : 'auto',
        }}
      />
    </span>
  );
}

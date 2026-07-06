'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react';
import { Currency } from '@/components/currency';
import { formatGoldShort, formatCoins } from '@/lib/currency';
import type { Session } from '@/types';

const intlLocale = (locale: string) => (locale === 'th' ? 'th-TH' : 'en-US');

interface GoldChartProps {
  sessions: Session[];
}

type ChartMode = 'daily' | 'weekly' | 'perSession';
type ChartType = 'bar' | 'line' | 'pie';

// Gold contributed by a single character within one bucket (day/week/session).
interface CharacterGold {
  name: string;
  gold: number;
}

// One bar/point/slice: its label, total gold, and the per-character breakdown
// that makes up that total (shown on hover).
interface ChartDatum {
  label: string;
  value: number;
  breakdown: CharacterGold[];
}

export function GoldChart({ sessions }: GoldChartProps) {
  const t = useTranslations('goldChart');
  const locale = useLocale();
  const [mode, setMode] = useState<ChartMode>('daily');
  const [chartType, setChartType] = useState<ChartType>('bar');

  const unknownLabel = t('unknownCharacter');
  const chartData = useMemo(() => {
    if (mode === 'daily') return getDailyData(sessions, locale, unknownLabel);
    if (mode === 'weekly') return getWeeklyData(sessions, locale, unknownLabel);
    return getPerSessionData(sessions, unknownLabel);
  }, [sessions, mode, locale, unknownLabel]);

  const maxValue = Math.max(...chartData.map((d) => d.value), 1);
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  const activeBars = chartData.filter((d) => d.value > 0);
  const average = activeBars.length > 0 ? Math.round(total / activeBars.length) : 0;
  const peak = Math.max(...chartData.map((d) => d.value), 0);

  return (
    <div>
      {/* Header with toggles */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-medium text-foreground">{t('title')}</h2>
        <div className="flex items-center gap-2">
          {/* Chart type */}
          <div className="flex items-center gap-0.5 bg-raised rounded-base p-0.5">
            {([
              { key: 'bar', Icon: BarChart3 },
              { key: 'line', Icon: LineChartIcon },
              { key: 'pie', Icon: PieChartIcon },
            ] as const).map(({ key, Icon }) => (
              <button
                key={key}
                onClick={() => setChartType(key)}
                className={`rounded-sm px-2 py-1 transition-colors duration-150 ${
                  chartType === key
                    ? 'bg-surface outline outline-1 outline-[rgba(255,255,255,0.08)]'
                    : 'opacity-40 hover:opacity-100'
                }`}
                title={key}
              >
                <Icon className="w-3.5 h-3.5 text-foreground" />
              </button>
            ))}
          </div>
          {/* Data mode */}
          <div className="flex items-center gap-0.5 bg-raised rounded-base p-0.5">
            {([
              { key: 'daily', tkey: 'daily' },
              { key: 'weekly', tkey: 'weekly' },
              { key: 'perSession', tkey: 'session' },
            ] as const).map(({ key, tkey }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ${
                  mode === key
                    ? 'bg-surface text-foreground outline outline-1 outline-[rgba(255,255,255,0.08)]'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {t(tkey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart area */}
      {chartType === 'bar' && <BarChart data={chartData} maxValue={maxValue} />}
      {chartType === 'line' && <LineChart data={chartData} maxValue={maxValue} />}
      {chartType === 'pie' && <PieChart data={chartData} total={total} />}

      {/* Summary */}
      <div className="flex gap-6 mt-4 pt-3 border-t border-[rgba(255,255,255,0.05)]">
        <div>
          <span className="text-[10px] text-muted">{t('total')}</span>
          <div className="text-sm"><Currency copper={total} className="text-sm" /></div>
        </div>
        <div>
          <span className="text-[10px] text-muted">{t('average')}</span>
          <div className="text-sm"><Currency copper={average} className="text-sm" /></div>
        </div>
        <div>
          <span className="text-[10px] text-muted">{t('peak')}</span>
          <div className="text-sm"><Currency copper={peak} className="text-sm" /></div>
        </div>
      </div>
    </div>
  );
}

// Hover card: per-character gold breakdown plus the bucket total. Shown via the
// parent column's `group-hover` (pointer-events off so it never blocks hovering).
function ChartTooltip({ datum }: { datum: ChartDatum }) {
  const t = useTranslations('goldChart');
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 group-hover:block">
      <div className="w-max min-w-[140px] max-w-[220px] rounded-base border border-border bg-surface px-3 py-2 shadow-card">
        <p className="mb-1.5 whitespace-nowrap text-[11px] font-medium text-foreground">
          {datum.label}
        </p>
        {datum.breakdown.length > 0 ? (
          <div className="space-y-1">
            {datum.breakdown.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="truncate text-muted">{b.name}</span>
                <span className="whitespace-nowrap tabular-nums text-foreground">
                  {formatCoins(b.gold)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted">{t('noData')}</p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.08)] pt-1.5 text-[11px]">
          <span className="text-muted">{t('total')}</span>
          <span className="whitespace-nowrap font-semibold tabular-nums text-gold">
            {formatCoins(datum.value)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===== BAR CHART =====
function BarChart({ data, maxValue }: { data: ChartDatum[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-1 h-[180px]">
      {data.map((bar, i) => {
        const height = (bar.value / maxValue) * 100;
        return (
          <div
            key={i}
            className="group relative flex-1 flex flex-col items-center gap-1.5 min-w-0"
          >
            <div className="w-full flex flex-col items-center justify-end h-[140px]">
              {bar.value > 0 && data.length <= 14 && (
                <span className="text-[9px] text-muted mb-0.5 truncate max-w-full">
                  {formatGold(bar.value)}
                </span>
              )}
              <div
                className="w-full max-w-[32px] rounded-t-sm bg-[var(--blue)] transition-all duration-200 group-hover:brightness-125"
                style={{ height: `${Math.max(height, 2)}%`, opacity: bar.value > 0 ? 1 : 0.15 }}
              />
            </div>
            <span className="text-[9px] text-muted truncate max-w-full">{bar.label}</span>
            {bar.value > 0 && <ChartTooltip datum={bar} />}
          </div>
        );
      })}
    </div>
  );
}

// ===== LINE CHART =====
function LineChart({ data, maxValue }: { data: ChartDatum[]; maxValue: number }) {
  const t = useTranslations('goldChart');
  const width = 600;
  const height = 160;
  const padding = 20;

  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1 || 1)) * (width - padding * 2),
    y: height - padding - (d.value / maxValue) * (height - padding * 2),
    datum: d,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="h-[180px] overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        {/* Area fill */}
        <path d={areaPath} fill="var(--blue)" opacity="0.1" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots (larger transparent hit area so the tooltip is easy to trigger) */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              fill="var(--blue)"
              opacity={p.datum.value > 0 ? 1 : 0.3}
            />
            <circle cx={p.x} cy={p.y} r="10" fill="transparent">
              <title>{tooltipText(p.datum, t('total'))}</title>
            </circle>
          </g>
        ))}
      </svg>
      {/* X-axis labels */}
      <div className="flex justify-between px-5 -mt-2">
        {data.length <= 15 ? (
          data.map((d, i) => (
            <span key={i} className="text-[9px] text-muted">{d.label}</span>
          ))
        ) : (
          <>
            <span className="text-[9px] text-muted">{data[0]?.label}</span>
            <span className="text-[9px] text-muted">{data[Math.floor(data.length / 2)]?.label}</span>
            <span className="text-[9px] text-muted">{data[data.length - 1]?.label}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ===== PIE CHART =====
function PieChart({ data, total }: { data: ChartDatum[]; total: number }) {
  const t = useTranslations('goldChart');
  const filtered = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  // Group small slices
  const topItems = filtered.slice(0, 6);
  const otherValue = filtered.slice(6).reduce((sum, d) => sum + d.value, 0);
  const slices = otherValue > 0 ? [...topItems, { label: t('other'), value: otherValue }] : topItems;

  const colors = [
    'var(--blue)',
    '#5D8CD7',
    '#A4C6F7',
    'var(--success)',
    'var(--warning)',
    '#9333EA',
    'var(--muted)',
  ];

  // Calculate pie slices
  let currentAngle = 0;
  const pieSlices = slices.map((s, i) => {
    const angle = total > 0 ? (s.value / total) * 360 : 0;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...s, startAngle, angle, color: colors[i % colors.length] };
  });

  return (
    <div className="flex items-center gap-6 h-[180px]">
      {/* SVG Pie */}
      <div className="w-[160px] h-[160px] flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {pieSlices.map((slice, i) => {
            if (slice.angle === 0) return null;
            const startRad = ((slice.startAngle - 90) * Math.PI) / 180;
            const endRad = ((slice.startAngle + slice.angle - 90) * Math.PI) / 180;
            const largeArc = slice.angle > 180 ? 1 : 0;
            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);

            // Full circle case
            if (slice.angle >= 359.9) {
              return (
                <circle key={i} cx="50" cy="50" r="40" fill={slice.color} />
              );
            }

            return (
              <path
                key={i}
                d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={slice.color}
              >
                <title>{`${slice.label}: ${formatCoins(slice.value)} (${total > 0 ? Math.round((slice.value / total) * 100) : 0}%)`}</title>
              </path>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 overflow-auto flex-1">
        {pieSlices.map((slice, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-xs flex-shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-xs text-foreground truncate">{slice.label}</span>
            <span className="text-xs text-muted ml-auto flex-shrink-0">
              {formatGold(slice.value)} ({total > 0 ? Math.round((slice.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Data generators =====

// Build a datum from a character→gold map: breakdown sorted high→low, total summed.
function makeDatum(label: string, charGold: Map<string, number>): ChartDatum {
  const breakdown = [...charGold.entries()]
    .map(([name, gold]) => ({ name, gold }))
    .filter((b) => b.gold > 0)
    .sort((a, b) => b.gold - a.gold);
  const value = breakdown.reduce((sum, b) => sum + b.gold, 0);
  return { label, value, breakdown };
}

function getDailyData(sessions: Session[], locale: string, unknownLabel: string): ChartDatum[] {
  const days: { key: string; label: string }[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    days.push({
      key: date.toISOString().split('T')[0],
      label: date.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short' }),
    });
  }

  const byDay = new Map<string, Map<string, number>>();
  for (const day of days) byDay.set(day.key, new Map());

  for (const session of sessions) {
    if (!session.started_at) continue;
    const dateKey = new Date(session.started_at).toISOString().split('T')[0];
    const charGold = byDay.get(dateKey);
    if (!charGold) continue;
    const name = session.characters?.name ?? unknownLabel;
    charGold.set(name, (charGold.get(name) ?? 0) + Number(session.gold_earned));
  }

  return days.map((d) => makeDatum(d.label, byDay.get(d.key)!));
}

function getWeeklyData(sessions: Session[], locale: string, unknownLabel: string): ChartDatum[] {
  const weeks: { start: Date; label: string }[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i * 7 - start.getDay());
    weeks.push({
      start,
      label: start.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short' }),
    });
  }

  return weeks.map((week, idx) => {
    const end = idx < weeks.length - 1 ? weeks[idx + 1].start : new Date();
    const charGold = new Map<string, number>();
    for (const s of sessions) {
      if (!s.started_at) continue;
      const d = new Date(s.started_at);
      if (d >= week.start && d < end) {
        const name = s.characters?.name ?? unknownLabel;
        charGold.set(name, (charGold.get(name) ?? 0) + Number(s.gold_earned));
      }
    }
    return makeDatum(week.label, charGold);
  });
}

function getPerSessionData(sessions: Session[], unknownLabel: string): ChartDatum[] {
  const recent = sessions
    .filter((s) => s.started_at)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime())
    .slice(-20);

  return recent.map((s, i) => {
    const name = s.characters?.name ?? unknownLabel;
    const gold = Number(s.gold_earned);
    return {
      label: `#${i + 1}`,
      value: gold,
      breakdown: gold > 0 ? [{ name, gold }] : [],
    };
  });
}

// Multi-line text for the native SVG tooltip (line chart): each character's
// gold, then the total.
function tooltipText(d: ChartDatum, totalLabel: string): string {
  const lines = d.breakdown.map((b) => `${b.name}: ${formatCoins(b.gold)}`);
  lines.push(`${totalLabel}: ${formatCoins(d.value)}`);
  return `${d.label}\n${lines.join('\n')}`;
}

// Bar/pie labels show gold-major (e.g. "12g", "1.2Kg") since values are copper.
function formatGold(value: number): string {
  return formatGoldShort(value);
}

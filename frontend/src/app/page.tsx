import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import { VisitorCounter } from '@/components/visitor-counter';
import { Reveal } from '@/components/reveal';
import { ArrowRight, Package, ChevronDown, Check, Sparkles } from 'lucide-react';

// Demo bar heights (%) for the dashboard-preview chart. Index 4 is the peak.
const CHART = [42, 58, 71, 49, 88, 63, 77];

// Demo skill tree for the simulator preview: real Warrior icons from
// /public/skill-icons on the same 62px grid the simulator uses.
const SKILL_CELL = 62;
const SKILL_ICON = 44;
const MOCK_SKILLS = [
  { icon: 1, x: 0, y: 0, cur: 5, max: 5 },
  { icon: 2, x: 1, y: 0, cur: 3, max: 5 },
  { icon: 3, x: 2, y: 0, cur: 1, max: 1 },
  { icon: 5, x: 3, y: 0, cur: 0, max: 5, locked: true },
  { icon: 7, x: 0, y: 1, cur: 2, max: 5, plus: true },
  { icon: 9, x: 2, y: 1, cur: 0, max: 3, locked: true },
];
// prereq arrows: parent grid pos -> child grid pos (same column, row below)
const MOCK_ARROWS = [
  { x: 0, from: 0, to: 1 },
  { x: 2, from: 0, to: 1 },
];

export default function HomePage() {
  const t = useTranslations('landing');

  return (
    <main className="relative min-h-screen overflow-hidden bg-root">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 z-0 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(224,165,60,0.16),transparent_70%)] blur-3xl" />

      {/* Language switcher */}
      <div className="absolute right-4 top-4 z-20 sm:right-7 sm:top-6">
        <LanguageSwitcher />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-container px-4 pb-4 pt-16 text-center sm:px-7 laptop:pt-24">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold-dim backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          {t('badge')}
        </span>

        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt={`${t('title')} ${t('titleAccent')}`}
            width={866}
            height={288}
            priority
            className="mb-6 h-auto w-full max-w-[440px]"
          />
        </div>

        <h1 className="mx-auto max-w-[720px] bg-gradient-to-b from-white to-[#9a9ca6] bg-clip-text text-3xl font-extrabold leading-[1.15] tracking-tight text-transparent laptop:text-5xl">
          {t('heroHeadline')}{' '}
          <span className="bg-gradient-to-b from-gold-strong to-gold-dim bg-clip-text text-transparent">
            {t('heroHeadlineAccent')}
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-[600px] text-base text-muted laptop:text-lg">
          {t('subtitle')}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-base bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-[#1b1407] shadow-button transition-transform duration-150 hover:scale-[1.03] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            {t('ctaPrimary')}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/skills"
            className="inline-flex items-center justify-center gap-2 rounded-base bg-gold-soft px-6 py-3 text-sm font-semibold text-gold-strong transition-all duration-150 hover:scale-[1.03] hover:bg-gold/25 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            <Sparkles className="h-4 w-4" />
            {t('ctaSkills')}
          </Link>
        </div>

        <p className="mt-5 text-xs text-muted">{t('trustLine')}</p>
        <p className="mt-1 text-xs text-muted">{t('ctaSkillsHint')}</p>

        {/* Product previews */}
        <div className="mt-14 space-y-6 laptop:mt-16">
          <Reveal>
            <DashboardPreview />
          </Reveal>
          <Reveal delay={120}>
            <GrindPreview />
          </Reveal>
          <Reveal delay={240}>
            <SessionsPreview />
          </Reveal>
          <Reveal delay={360}>
            <SkillsPreview />
          </Reveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <section className="relative z-10 mx-auto max-w-container px-4 pb-16 pt-6 sm:px-7">
        <Reveal>
          <p className="text-center text-xs text-muted">
            {t('footerNote', { year: new Date().getFullYear() })}
          </p>
          <p className="mt-2 text-center text-[11px] text-muted/80">
            {t('privacyNote')}
          </p>
          <VisitorCounter />
        </Reveal>
      </section>
    </main>
  );
}

function DashboardPreview() {
  const t = useTranslations('landing');
  const stats = [
    { label: t('previewTotalGold'), value: '1,240', unit: 'g', gold: true },
    { label: t('previewGoldHour'), value: '312', unit: 'g', gold: false },
    { label: t('previewSessions'), value: '48', unit: '', gold: false },
    {
      label: t('previewTopDungeon'),
      value: t('previewDungeonName'),
      unit: '',
      gold: false,
    },
  ];
  const peak = Math.max(...CHART);

  return (
    <div className="mx-auto max-w-[880px] overflow-hidden rounded-lg border border-border bg-surface text-left shadow-card">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgba(224,165,60,0.75)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]/60" />
        <span className="ml-2 text-[11px] text-muted">{t('previewLabel')}</span>
      </div>

      <div className="p-4 laptop:p-6">
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 laptop:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-base bg-raised p-3.5">
              <p className="text-[11px] uppercase tracking-wider text-muted">
                {s.label}
              </p>
              <p
                className={`mt-1.5 truncate text-lg font-bold tracking-tight ${
                  s.gold ? 'text-gold' : 'text-foreground'
                }`}
                title={s.value}
              >
                {s.value}
                {s.unit && (
                  <span className="text-xs font-semibold opacity-80">
                    {s.unit}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="mt-3 rounded-base bg-raised p-4">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-muted">
            {t('previewChartLabel')}
          </p>
          <div className="flex h-32 items-end gap-2 laptop:gap-3">
            {CHART.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-t-sm ${
                  h === peak ? 'bg-gold-strong' : 'bg-[rgba(224,165,60,0.45)]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrindPreview() {
  const t = useTranslations('landing');
  const g = useTranslations('grind');
  const field =
    'flex items-center justify-between rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground';
  const label = 'mb-1.5 text-[11px] uppercase tracking-wider text-muted';
  const drops = [
    { name: t('previewItem1'), qty: 3, price: '15' },
    { name: t('previewItem2'), qty: 12, price: '4' },
  ];

  return (
    <div className="mx-auto max-w-[880px] overflow-hidden rounded-lg border border-border bg-surface text-left shadow-card">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgba(224,165,60,0.75)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]/60" />
        <span className="ml-2 text-[11px] text-muted">
          {t('previewGrindLabel')}
        </span>
      </div>

      <div className="p-4 laptop:p-6">
        {/* Fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className={label}>{g('character')}</p>
            <div className={field}>
              {t('previewCharacterName')}
              <ChevronDown className="h-4 w-4 text-muted" />
            </div>
          </div>
          <div>
            <p className={label}>{g('dungeon')}</p>
            <div className={field}>
              {t('previewDungeonName')}
              <ChevronDown className="h-4 w-4 text-muted" />
            </div>
          </div>
          <div>
            <p className={label}>{g('duration')}</p>
            <div className={field}>{t('previewDuration')}</div>
          </div>
          <div>
            <p className={label}>{g('goldDrop')}</p>
            <div className={field}>
              <span className="font-semibold text-gold">
                120<span className="text-xs opacity-80">g</span>
              </span>
            </div>
          </div>
        </div>

        {/* Item drops */}
        <p className={`mt-4 ${label}`}>{g('itemDrops')}</p>
        <div className="space-y-2">
          {drops.map((it) => (
            <div
              key={it.name}
              className="flex items-center justify-between rounded-base bg-raised px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-gold-soft text-gold">
                  <Package className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-foreground">{it.name}</span>
                <span className="shrink-0 text-muted">×{it.qty}</span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-gold">
                {it.price}
                <span className="text-xs opacity-80">g</span>
              </span>
            </div>
          ))}
        </div>

        {/* Summary + save */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className={label}>{g('valuePerHour')}</p>
            <p className="text-lg font-bold tracking-tight text-gold">
              234<span className="text-xs opacity-80">g</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-base bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-[#1b1407] shadow-button">
            <Check className="h-4 w-4" />
            {g('saveSession')}
          </span>
        </div>
      </div>
    </div>
  );
}

function SkillsPreview() {
  const t = useTranslations('landing');
  const s = useTranslations('skills');
  const cols = Math.max(...MOCK_SKILLS.map((k) => k.x)) + 1;
  const rows = Math.max(...MOCK_SKILLS.map((k) => k.y)) + 1;
  const W = cols * SKILL_CELL;
  const H = rows * SKILL_CELL;
  const spSpent = 86;

  return (
    <div className="mx-auto max-w-[880px] overflow-hidden rounded-lg border border-border bg-surface text-left shadow-card">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgba(224,165,60,0.75)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]/60" />
        <span className="ml-2 text-[11px] text-muted">
          {t('previewSkillsLabel')}
        </span>
      </div>

      <div className="p-4 laptop:p-6">
        {/* SP budget bar (mirrors the simulator's control bar) */}
        <div className="flex flex-wrap items-center gap-4 rounded-base bg-raised p-3">
          <div className="min-w-[88px] rounded-base bg-surface px-4 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">
              {s('spUsed')}
            </p>
            <p className="text-lg font-bold tabular-nums text-gold">
              {spSpent}
              <span className="text-sm text-muted">/230</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              {s('charLevel')}
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">12</p>
          </div>
          <span className="ml-auto hidden items-center gap-2 rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button sm:inline-flex">
            {s('saveShare')}
          </span>
        </div>

        {/* One tier panel of the tree */}
        <div className="mt-3 rounded-[6px] border border-border bg-surface p-3 shadow-sm">
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-[15px] font-semibold text-foreground">
              {t('previewSkillsClass')}
            </h3>
            <span className="text-[11px] font-medium text-muted">
              {spSpent} SP
            </span>
          </div>
          <div className="relative mx-auto" style={{ width: W, height: H }}>
            <svg
              className="pointer-events-none absolute inset-0"
              width={W}
              height={H}
              aria-hidden
            >
              <defs>
                <marker
                  id="landing-arw"
                  markerWidth="7"
                  markerHeight="7"
                  refX="5.5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill="var(--gold-dim)" />
                </marker>
              </defs>
              {MOCK_ARROWS.map((a) => {
                const cx = a.x * SKILL_CELL + SKILL_ICON / 2;
                return (
                  <path
                    key={a.x}
                    d={`M${cx},${a.from * SKILL_CELL + SKILL_ICON} L${cx},${a.to * SKILL_CELL - 2}`}
                    fill="none"
                    stroke="var(--gold-dim)"
                    strokeWidth="2"
                    markerEnd="url(#landing-arw)"
                  />
                );
              })}
            </svg>
            {MOCK_SKILLS.map((k) => (
              <div
                key={k.icon}
                className="absolute select-none"
                style={{ left: k.x * SKILL_CELL, top: k.y * SKILL_CELL, width: SKILL_ICON }}
              >
                <div className="relative h-11 w-11 rounded-[6px]">
                  <div
                    className={`h-full w-full overflow-hidden rounded-[6px] border ${
                      k.cur > 0
                        ? 'border-[var(--gold)] ring-1 ring-[var(--gold)]'
                        : 'border-border'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/skill-icons/${k.icon}.webp`}
                      alt=""
                      draggable={false}
                      className={`h-full w-full object-cover ${k.locked ? 'opacity-60 grayscale' : ''}`}
                    />
                  </div>
                  {k.plus && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--gold-dim)] bg-[var(--gold)] text-[11px] font-bold leading-none text-[var(--root)] shadow">
                      +
                    </span>
                  )}
                </div>
                <div className="mx-auto mt-1 w-11 rounded-[3px] bg-[var(--root)] text-center text-[10px] font-bold leading-[15px] tabular-nums">
                  <span
                    className={
                      k.cur >= k.max
                        ? 'text-gold'
                        : k.cur > 0
                          ? 'text-[var(--gold-strong)]'
                          : 'text-foreground'
                    }
                  >
                    {k.cur}
                  </span>
                  <span className="text-muted">/{k.max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionsPreview() {
  const t = useTranslations('landing');
  const rows = [
    {
      dungeon: t('previewDungeonName'),
      char: t('previewCharacterName'),
      gold: '1,240',
      when: t('previewToday'),
      dur: '1h 20m',
      drops: 2,
    },
    {
      dungeon: t('previewDungeon2'),
      char: t('previewCharacter2'),
      gold: '860',
      when: t('previewYesterday'),
      dur: '55m',
      drops: 1,
    },
    {
      dungeon: t('previewDungeonName'),
      char: t('previewCharacterName'),
      gold: '1,050',
      when: t('previewDaysAgo'),
      dur: '1h 05m',
      drops: 3,
    },
  ];

  return (
    <div className="mx-auto max-w-[880px] overflow-hidden rounded-lg border border-border bg-surface text-left shadow-card">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgba(224,165,60,0.75)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]/60" />
        <span className="ml-2 text-[11px] text-muted">
          {t('previewSessionsLabel')}
        </span>
      </div>

      <div className="space-y-2.5 p-4 laptop:p-6">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-base border border-border bg-raised px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {r.dungeon} <span className="text-muted">· {r.char}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {r.when} · {r.dur} · {t('previewDrops', { count: r.drops })}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-gold">
              {r.gold}
              <span className="text-xs opacity-80">g</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

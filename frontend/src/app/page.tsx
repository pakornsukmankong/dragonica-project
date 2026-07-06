import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  Coins,
  TrendingUp,
  Package,
  LayoutDashboard,
  Users,
  Languages,
  ArrowRight,
  ArrowDown,
  Heart,
  PlaySquare,
  MessageCircle,
  ChevronDown,
  Check,
} from 'lucide-react';

const FEATURES = [
  { icon: Coins, title: 'featGoldTitle', desc: 'featGoldDesc' },
  { icon: TrendingUp, title: 'featEffTitle', desc: 'featEffDesc' },
  { icon: Package, title: 'featDropTitle', desc: 'featDropDesc' },
  { icon: LayoutDashboard, title: 'featDashTitle', desc: 'featDashDesc' },
  { icon: Users, title: 'featMultiTitle', desc: 'featMultiDesc' },
  { icon: Languages, title: 'featLangTitle', desc: 'featLangDesc' },
] as const;

const STEPS = ['step1', 'step2', 'step3'] as const;

// Demo bar heights (%) for the dashboard-preview chart. Index 4 is the peak.
const CHART = [42, 58, 71, 49, 88, 63, 77];

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={`${t('title')} ${t('titleAccent')}`}
            className="mb-6 w-full max-w-[440px]"
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
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-base border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-150 hover:border-gold hover:text-gold focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            {t('ctaSecondary')}
            <ArrowDown className="h-4 w-4" />
          </a>
        </div>

        <p className="mt-5 text-xs text-muted">{t('trustLine')}</p>

        {/* Product previews */}
        <div className="mt-14 space-y-6 laptop:mt-16">
          <DashboardPreview />
          <GrindPreview />
          <SessionsPreview />
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="relative z-10 mx-auto max-w-container px-4 py-16 sm:px-7 laptop:py-24">
        <SectionHeading title={t('featuresTitle')} subtitle={t('featuresSubtitle')} />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 laptop:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-base border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(224,165,60,0.35)] hover:shadow-gold"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-base bg-gold-soft text-gold">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">{t(title)}</h3>
              <p className="mt-1.5 text-sm text-muted">{t(desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section
        id="how-it-works"
        className="relative z-10 mx-auto max-w-container scroll-mt-20 px-4 py-16 sm:px-7 laptop:py-24"
      >
        <SectionHeading title={t('howTitle')} subtitle={t('howSubtitle')} />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((key, i) => (
            <div
              key={key}
              className="relative rounded-base border border-border bg-surface p-6"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-soft text-sm font-bold text-gold shadow-gold">
                {i + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {t(`${key}Title`)}
              </h3>
              <p className="mt-1.5 text-sm text-muted">{t(`${key}Desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== COMMUNITY ===== */}
      <section className="relative z-10 mx-auto max-w-container px-4 py-16 sm:px-7 laptop:py-24">
        <SectionHeading
          title={t('communityTitle')}
          subtitle={t('communitySubtitle')}
        />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/support"
            className="group flex items-start gap-4 rounded-base border border-border bg-surface p-6 transition-all duration-200 hover:border-[rgba(224,165,60,0.35)] hover:shadow-gold"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-base bg-gold-soft text-gold">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t('supportersTitle')}
              </h3>
              <p className="mt-1.5 text-sm text-muted">{t('supportersDesc')}</p>
            </div>
          </Link>
          <Link
            href="/support"
            className="group flex items-start gap-4 rounded-base border border-border bg-surface p-6 transition-all duration-200 hover:border-[rgba(224,165,60,0.35)] hover:shadow-gold"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center gap-1 rounded-base bg-gold-soft text-gold">
              <PlaySquare className="h-5 w-5" />
            </span>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {t('communityYtTitle')}
                <MessageCircle className="h-4 w-4 text-gold-dim" />
              </h3>
              <p className="mt-1.5 text-sm text-muted">{t('communityYtDesc')}</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="relative z-10 mx-auto max-w-container px-4 pb-20 sm:px-7">
        <div className="relative overflow-hidden rounded-lg border border-[rgba(224,165,60,0.25)] bg-gold-soft px-6 py-12 text-center">
          <div className="pointer-events-none absolute -bottom-24 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(224,165,60,0.18),transparent_70%)] blur-3xl" />
          <div className="relative">
            <h2 className="text-xl font-bold tracking-tight text-foreground laptop:text-2xl">
              {t('finalCtaTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-[440px] text-sm text-muted">
              {t('finalCtaSubtitle')}
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-base bg-[var(--blue)] px-7 py-3 text-sm font-semibold text-[#1b1407] shadow-button transition-transform duration-150 hover:scale-[1.03] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
            >
              {t('ctaPrimary')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted">
          {t('footerNote', { year: new Date().getFullYear() })}
        </p>
        <p className="mt-2 text-center text-[11px] text-muted/80">
          {t('privacyNote')}
        </p>
      </section>
    </main>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center">
      <h2 className="text-xl font-bold tracking-tight text-foreground laptop:text-2xl">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-[520px] text-sm text-muted">{subtitle}</p>
    </div>
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

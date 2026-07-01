import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Swords, Coins, TrendingUp, Package } from 'lucide-react';

const FEATURES = [
  { icon: Coins, key: 'featureGold' },
  { icon: TrendingUp, key: 'featureEfficiency' },
  { icon: Package, key: 'featureDrops' },
] as const;

export default function HomePage() {
  const t = useTranslations('landing');
  return (
    <main className="relative min-h-screen overflow-hidden bg-root">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(224,165,60,0.18),transparent_70%)] blur-3xl" />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-container flex-col items-center justify-center px-4 py-20 text-center sm:px-7">
        {/* Badge */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold-dim backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          {t('badge')}
        </span>

        {/* Brand mark */}
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
          <Swords className="h-8 w-8" />
        </span>

        <h1 className="bg-gradient-to-b from-white to-[#9a9ca6] bg-clip-text text-3xl font-extrabold tracking-tight text-transparent laptop:text-4xl">
          {t('title')}{' '}
          <span className="bg-gradient-to-b from-gold-strong to-gold-dim bg-clip-text text-transparent">
            {t('titleAccent')}
          </span>
        </h1>

        <p className="mt-4 max-w-[640px] text-base text-muted">
          {t('subtitle')}
        </p>

        {/* Feature chips */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {FEATURES.map(({ icon: Icon, key }) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 rounded-base border border-border bg-surface px-3 py-2 text-xs text-foreground"
            >
              <Icon className="h-4 w-4 text-gold" />
              {t(key)}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-base bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-[#1b1407] shadow-button transition-transform duration-150 hover:scale-[1.03] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            <Swords className="h-4 w-4" />
            {t('getStarted')}
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-base border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-150 hover:border-gold hover:text-gold focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            {t('openDashboard')}
          </Link>
        </div>
      </section>
    </main>
  );
}

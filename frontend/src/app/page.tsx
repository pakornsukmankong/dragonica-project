import Link from 'next/link';
import { Swords, Coins, TrendingUp, Package } from 'lucide-react';

const FEATURES = [
  { icon: Coins, label: 'Track gold & EXP per run' },
  { icon: TrendingUp, label: 'Gold/hour efficiency stats' },
  { icon: Package, label: 'Log every item drop' },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-root">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(224,165,60,0.18),transparent_70%)] blur-3xl" />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-container flex-col items-center justify-center px-4 py-20 text-center sm:px-7">
        {/* Badge */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold-dim backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Dragonica Tools
        </span>

        {/* Brand mark */}
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
          <Swords className="h-8 w-8" />
        </span>

        <h1 className="bg-gradient-to-b from-white to-[#9a9ca6] bg-clip-text text-3xl font-extrabold tracking-tight text-transparent laptop:text-4xl">
          Dragonica{' '}
          <span className="bg-gradient-to-b from-gold-strong to-gold-dim bg-clip-text text-transparent">
            Grind Tracker
          </span>
        </h1>

        <p className="mt-4 max-w-[640px] text-base text-muted">
          Log your grinding sessions, gold, and item drops. Analyze your
          efficiency per dungeon and optimize every run.
        </p>

        {/* Feature chips */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-base border border-border bg-surface px-3 py-2 text-xs text-foreground"
            >
              <Icon className="h-4 w-4 text-gold" />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-base bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-[#1b1407] shadow-button transition-transform duration-150 hover:scale-[1.03] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            <Swords className="h-4 w-4" />
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-base border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-150 hover:border-gold hover:text-gold focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            Open Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
